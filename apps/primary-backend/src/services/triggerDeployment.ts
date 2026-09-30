import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { prisma } from '@repo/db'
import { decryptEnvMap } from '@repo/env-crypto'
import type { BuildJob } from '@repo/types'

const sqs = new SQSClient({ region: process.env.AWS_REGION })
const QUEUE_URL = process.env.SQS_QUEUE_URL!

/**
 * Creates a Deployment row, builds the SQS job payload, and queues it.
 * This is the single source of truth for dispatching a build — used by both
 * the manual deploy route and the GitHub webhook push handler.
 *
 * @param project_id  The project to deploy (must already exist in DB)
 * @returns           The newly-created deployment_id
 */
export async function triggerDeployment(project_id: number): Promise<{ deployment_id: number }> {
    const project = await prisma.project.findUniqueOrThrow({
        where: { project_id }
    })

    const deployment = await prisma.deployment.create({
        data: { project_id }
    })

    const encryptedEnv = project.project_env
        ? (project.project_env as Record<string, string>)
        : {}

    // Decrypt in-memory — plaintext values are never re-persisted
    const envVars: Record<string, string> = Object.keys(encryptedEnv).length > 0
        ? decryptEnvMap(encryptedEnv)
        : {}

    const job: BuildJob = {
        id: deployment.deployment_id,
        repoId: project.repoId,
        repoName: project.repoName,
        repoUrl: project.github_url,
        buildCommand: project.build_cmd,
        buildOutDir: project.output_dir,
        user_id: project.user_id,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
    }

    await sqs.send(
        new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(job),
        })
    )

    console.log(`[deploy] Queued build job ${job.id} for project "${job.repoName}" (project_id: ${project_id})`)

    return { deployment_id: deployment.deployment_id }
}
