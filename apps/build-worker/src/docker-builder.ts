import { execa } from 'execa';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import type { BuildJob } from '@repo/types';
import { uploadDirectoryToS3 } from './upload-on-s3.js'
import { captureDeploymentSnapshot } from './snapshot.js'
import { prisma } from '@repo/db'
import { FALLBACK_OUTPUT_DIRS, normalizeOutputDir, pickInstallCommand } from './build-config.js'

const BUILDER_IMAGE = 'build-worker:latest';
const CONTAINER_WORKSPACE = '/workspace';

const BUCKET: string = process.env.S3_BUCKET ?? 'blitzship'


export async function runBuildInContainer(job: BuildJob) {

  const buildLogs: string[] = [];

  const onLog = (logLine: string) => {
    //TODO: Stream these logs in realtime through websockets to the frontend
    buildLogs.push(logLine);
    console.log(logLine);
  }

  const containerId = `build-${randomUUID()}`;
  const repoDir = `${CONTAINER_WORKSPACE}/repo`;

  const localArtifactPath = path.join(os.tmpdir(), containerId);

  try {

    const configuredOutDir = normalizeOutputDir(job.buildOutDir);
    if (!configuredOutDir) {
      throw new Error(`Invalid output directory "${job.buildOutDir}". It must be a relative path inside the repository.`);
    }

    await execa('docker', [
      'run',
      '--detach',
      '--name', containerId,
      '--memory', '2g',
      '--cpus', '1.5',
      '--security-opt', 'no-new-privileges',
      BUILDER_IMAGE,
      'sleep', 'infinity'
    ])

    // Resolve live repo name using repoId (immune to repo renaming or transfer)
    let repoFullName = job.repoName;
    if (job.repoId) {
      const liveName = await getLiveRepoFullName(job.repoId, job.gitToken);
      if (liveName) {
        if (liveName !== job.repoName) {
          onLog(`[git] Repository rename/transfer detected: "${job.repoName}" -> "${liveName}"`);
          try {
            await prisma.project.updateMany({
              where: { repoId: job.repoId },
              data: {
                repoName: liveName,
                github_url: `https://github.com/${liveName}`,
              },
            });
            onLog(`[git] Database updated with new repository name "${liveName}"`);
          } catch (dbErr) {
            console.error('[git] Failed to self-heal project repo reference in database:', dbErr);
          }
          job.repoName = liveName;
          job.repoUrl = `https://github.com/${liveName}`;
        }
        repoFullName = liveName;
      }
    }

    let cloneUrl = job.repoUrl;
    if (job.gitToken) {
      cloneUrl = buildAuthenticatedUrl(repoFullName, job.gitToken);
    } else if (repoFullName !== job.repoName) {
      cloneUrl = `https://github.com/${repoFullName}.git`;
    }

    onLog(`[git] Cloning ${repoFullName}${job.buildBranch ? ` (branch: ${job.buildBranch})` : ''}...`);

    //Clone the Git Repo inside running container
    await dockerExec(containerId, [
      'git', 'clone',
      '--depth', '1',
      '--single-branch',
      ...(job.buildBranch ? ['--branch', job.buildBranch] : []),
      cloneUrl,
      repoDir,
    ])

    //install all the node dependencies
    const installPlan = await resolveInstallPlan(containerId, repoDir);
    if (!installPlan.hasLockfile) {
      onLog(`[install] No ${installPlan.packageManager} lockfile found; installing without a lockfile`);
    }
    onLog(`[install] Running "${installPlan.command.join(' ')}"`);
    await dockerExec(containerId, installPlan.command, onLog, { workdir: repoDir })

    // Write environment variables to .env file inside the container.
    // Uses stdin piping instead of shell interpolation to safely handle any
    // special characters (quotes, newlines, backslashes) in values.
    if (job.envVars && Object.keys(job.envVars).length > 0) {
      const envFileContent = Object.entries(job.envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const writeProcess = execa('docker', [
        'exec', '-i', containerId,
        'sh', '-c', `cat > ${repoDir}/.env`,
      ]);
      writeProcess.stdin?.end(envFileContent);
      await writeProcess;

      onLog(`[build] Injected ${Object.keys(job.envVars).length} env variable(s) into .env`);
    }

    //Run the Actual Build CMD
    await dockerExec(containerId, [
      'sh', '-c',
      `cd ${repoDir} && ${job.buildCommand}`,
    ], onLog)

    const outputDir = await resolveOutputDir(containerId, repoDir, configuredOutDir, onLog);
    if (outputDir !== configuredOutDir) {
      await persistDetectedOutputDir(job.id, outputDir, onLog);
    }

    await fs.mkdir(localArtifactPath, { recursive: true });

    // Trailing "/." copies the directory's contents, so nested paths like "build/client" land at the root
    await execa('docker', [
      'cp',
      `${containerId}:${repoDir}/${outputDir}/.`,
      localArtifactPath,
    ]);

    console.log("Artifacts are copied to:- ", localArtifactPath)

    const uploadStatus = await uploadDirectoryToS3(localArtifactPath, job.id, BUCKET)
    if (uploadStatus) {
      const previewUrl = `https://${job.id}.blitzship.app`;

      // Wait briefly for CDN/S3 propagation before snapshotting
      await new Promise<void>((resolve) => setTimeout(resolve, 5_000));

      // Capture a 1280×800 visual screenshot of the live deployment
      // Non-fatal: if this fails the deployment is still marked successful
      const snapshotKey = await captureDeploymentSnapshot(job.id, previewUrl, BUCKET);

      await prisma.$transaction(async (tx) => {
        const deployment = await tx.deployment.update({
          where: {
            deployment_id: job.id,
          },
          data: {
            is_build_success: true,
            preview_url: previewUrl,
            snapshot_url: snapshotKey,  // S3 key — fetch via presigned URL when serving
          },
          select: {
            project_id: true,
            project: {
              select: {
                primary_domain: true,
              },
            },
          },
        });

        await tx.project.update({
          where: {
            project_id: deployment.project_id,
          },
          data: {
            production_deployment_id: job.id,
          },
        });

        if (deployment.project?.primary_domain) {
          await tx.domain.upsert({
            where: {
              domain_url: deployment.project.primary_domain,
            },
            update: {
              deployment_id: job.id,
              last_updated_at: new Date(),
            },
            create: {
              domain_url: deployment.project.primary_domain,
              deployment_id: job.id,
            },
          });
        }
      });

      return console.log("Directly Uploaded to s3 successfully!")
    }
    await prisma.deployment.update({
      where: {
        deployment_id: job.id
      },
      data: {
        is_build_success: false,
      }
    })
    return console.error("Upload Failed")

  } catch (e) {

    console.error("There was some error in building the project:- ", e)
    // Build logs are written from buildLogs in `finally`, so the failure reason must be added there
    onLog(`[error] ${e instanceof Error ? e.message : String(e)}`);
    await prisma.deployment.update({
      where: {
        deployment_id: job.id,
      },
      data: {
        is_build_success: false,
        build_logs: e || "Some Unknown Error Occured"
      },
    });

  } finally {

    await writeLogsToDB(job.id, buildLogs)
    await cleanupContainer(containerId);
    await fs.rm(localArtifactPath, { recursive: true, force: true });

  }

}

async function resolveInstallPlan(containerId: string, repoDir: string) {
  const { stdout } = await execa('docker', ['exec', containerId, 'ls', '-A', repoDir]);
  const rootFiles = stdout.split('\n').filter(Boolean);

  let packageManagerField: string | undefined;
  const packageJson = await execa('docker', ['exec', containerId, 'cat', `${repoDir}/package.json`], { reject: false });
  if (packageJson.exitCode === 0) {
    try {
      const parsed = JSON.parse(packageJson.stdout);
      if (typeof parsed?.packageManager === 'string') packageManagerField = parsed.packageManager;
    } catch {
      // npm reports the malformed package.json with a clearer message during install
    }
  }

  return pickInstallCommand(rootFiles, packageManagerField);
}

/**
 * Returns the configured output directory if it contains an index.html, otherwise the first
 * common output directory that does. Throws when none of them do.
 */
async function resolveOutputDir(
  containerId: string,
  repoDir: string,
  configuredOutDir: string,
  onLog: (line: string) => void
): Promise<string> {
  const candidates = [configuredOutDir, ...FALLBACK_OUTPUT_DIRS.filter((dir) => dir !== configuredOutDir)];

  for (const dir of candidates) {
    const check = await execa('docker', ['exec', containerId, 'test', '-f', `${repoDir}/${dir}/index.html`], { reject: false });
    if (check.exitCode === 0) {
      if (dir !== configuredOutDir) {
        onLog(`[build] Output directory "${configuredOutDir}" has no index.html; using "${dir}" instead`);
      }
      return dir;
    }
  }

  throw new Error(
    `Build finished but no index.html was found in "${configuredOutDir}" (also checked ${candidates.slice(1).join(', ')}). ` +
    `Set the correct output directory in the project's build settings.`
  );
}

async function persistDetectedOutputDir(deploymentId: number, outputDir: string, onLog: (line: string) => void) {
  try {
    await prisma.project.updateMany({
      where: { deployments: { some: { deployment_id: deploymentId } } },
      data: { output_dir: outputDir },
    });
    onLog(`[build] Project output directory updated to "${outputDir}"`);
  } catch (dbErr) {
    console.error('[build] Failed to persist detected output directory:', dbErr);
  }
}

async function writeLogsToDB(deploymentId: number, logs: string[]) {

  const allLogs = logs.join('\n')
  try {
    return await prisma.deployment.update({
      where: {
        deployment_id: deploymentId
      },
      data: {
        build_logs: allLogs
      }
    })
  } catch (e) {
    console.error(e);
    throw e
  }

}

async function dockerExec(
  containerId: string,
  cmd: string[],
  onLog?: (line: string) => void,
  options: { workdir?: string } = {}
) {

  const workdirArgs = options.workdir ? ['--workdir', options.workdir] : [];
  const child = execa('docker', ['exec', ...workdirArgs, containerId, ...cmd], {
    all: true,
  })

  // Stream lines in real-time
  child.all?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    lines.forEach(line => onLog?.(line));
  })

  return child.catch(err => {
    // When output was streamed through onLog it is already in the build logs, so don't repeat it
    const details = onLog ? `exit code ${err.exitCode}` : err.all;
    throw new Error(
      `docker exec [${cmd[0]}] failed in container ${containerId}:\n${details}`
    );
  })

}

async function cleanupContainer(containerId: string) {
  try {
    await execa('docker', ['rm', '--force', containerId]);
  } catch {
    console.warn(`[docker] Failed to remove container ${containerId} — may need manual cleanup`);
  }
}

function buildAuthenticatedUrl(repoName: string, gitToken?: string): string {

  const cloneUrl = `https://x-access-token:${gitToken}@github.com/${repoName}.git`
  return cloneUrl
}

async function getLiveRepoFullName(repoId: string, gitToken?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'BlitzShip-BuildWorker',
    };
    if (gitToken) {
      headers.Authorization = `Bearer ${gitToken}`;
    }

    const res = await fetch(`https://api.github.com/repositories/${repoId}`, { headers });
    if (!res.ok) {
      console.warn(`[git] GitHub API returned status ${res.status} when querying repoId ${repoId}`);
      return null;
    }

    const data: any = await res.json();
    return data.full_name || null;
  } catch (e) {
    console.warn(`[git] Failed to resolve repoId ${repoId} via GitHub API:`, e);
    return null;
  }
}