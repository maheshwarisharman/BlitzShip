import { execa } from 'execa';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import type { BuildJob } from '@repo/types';
import { uploadDirectoryToS3 } from './upload-on-s3.js'
import { prisma } from '@repo/db'

const BUILDER_IMAGE = 'build-worker:latest';
const CONTAINER_WORKSPACE = '/workspace';


export async function runBuildInContainer(job: BuildJob) {

  const buildLogs: string[] = [];

  const onLog = (logLine: string) => {
    //TODO: Stream these logs in realtime through websockets to the frontend
    buildLogs.push(logLine);
    console.log(logLine);
  }

  const containerId = `build-${randomUUID()}`;
  const repoDir = `${CONTAINER_WORKSPACE}/${job.repoName}`;

  const localArtifactPath = path.join(os.tmpdir(), containerId);

  try {

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

    let cloneUrl = job.repoUrl

    if (job.gitToken) {
      cloneUrl = buildAuthenticatedUrl(job.repoName, job.gitToken)
    }


    //Clone the Git Repo inside running container
    await dockerExec(containerId, [
      'git', 'clone',
      '--depth', '1',
      '--single-branch',
      cloneUrl,
      repoDir,
    ])

    //install all the node dependencies
    await dockerExec(containerId, [
      'npm', 'ci',
      '--prefix', repoDir,
    ])

    // Write environment variables to .env file inside the container
    if (job.envVars && Object.keys(job.envVars).length > 0) {
      const envFileContent = Object.entries(job.envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await dockerExec(containerId, [
        'sh', '-c',
        `printf '%s' '${envFileContent.replace(/'/g, "'\\''")}' > ${repoDir}/.env`,
      ]);

      onLog(`[build] Injected ${Object.keys(job.envVars).length} env variable(s) into .env`);
    }

    //Run the Actual Build CMD
    await dockerExec(containerId, [
      job.buildCommand,
      '--prefix', repoDir,
    ], onLog)



    const artifactDirInContainer = `${repoDir}/${job.buildOutDir}`;
    await fs.mkdir(localArtifactPath, { recursive: true });

    await execa('docker', [
      'cp',
      `${containerId}:${artifactDirInContainer}`,
      localArtifactPath,
    ]);

    console.log("Artifacts are copied to:- ", path.join(localArtifactPath, job.buildOutDir))
    const tmpPath = path.join(localArtifactPath, job.buildOutDir);

    const uploadStatus = await uploadDirectoryToS3(tmpPath, job.id, 'vercelclone-test')
    if (uploadStatus) {
      await prisma.deployment.update({
        where: {
          deployment_id: job.id
        },
        data: {
          is_build_success: true,
          preview_url: `https://${job.id}.dev.blitznative.com`
        }
      })
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

  } finally {

    await writeLogsToDB(job.id, buildLogs)
    // await cleanupContainer(containerId);

  }

}

async function writeLogsToDB(deploymentId: number, logs: string[]) {

  const allLogs = logs.join()
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

async function dockerExec(containerId: string, cmd: string[], onLog?: (line: string) => void) {

  const child = execa('docker', ['exec', containerId, ...cmd], {
    all: true,
  })

  // Stream lines in real-time
  child.all?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    lines.forEach(line => onLog?.(line));
  })

  return child.catch(err => {
    throw new Error(
      `docker exec [${cmd[0]}] failed in container ${containerId}:\n${err.all}`
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