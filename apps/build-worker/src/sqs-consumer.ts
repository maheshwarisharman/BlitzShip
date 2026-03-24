import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    type Message,
} from '@aws-sdk/client-sqs';
import type { BuildJob } from '@repo/types';
import { runBuildInContainer } from './docker-builder.js';

const sqs = new SQSClient({ region: process.env.AWS_REGION });

const QUEUE_URL = process.env.SQS_QUEUE_URL!;
const POLL_INTERVAL_MS = 5_000;
const VISIBILITY_TIMEOUT = 900;
const PRIMARY_BACKEND_URL = process.env.PRIMARY_BACKEND_URL || 'http://localhost:4000';

export async function startBuildConsumer(): Promise<never> {
    console.log(`[sqs] Polling queue: ${QUEUE_URL}`);

    while (true) {
        const message = await pollMessage();

        if (!message) {
            await delay(POLL_INTERVAL_MS);
            continue;
        }

        try {
            const job = await parseJobFromMessage(message);
            console.log(`[sqs] Processing build job ${job.id} — ${job.repoName}`);
            await runBuildInContainer(job);
            console.log(`[sqs] Build job ${job.id} completed successfully`);
        } catch (e) {
            console.error(`[sqs] Failed to process message ${message.MessageId}:`, e);
        } finally {
            await acknowledgeMessage(message.ReceiptHandle!);
            console.log(`[sqs] Message ${message.MessageId} acknowledged`);
        }
    }
}

async function pollMessage(): Promise<Message | undefined> {
    try {
        const { Messages } = await sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20,
                VisibilityTimeout: VISIBILITY_TIMEOUT,
            })
        );
        return Messages?.[0];
    } catch (e) {
        console.error('[sqs] Error receiving message:', e);
        return undefined;
    }
}

async function parseJobFromMessage(message: Message): Promise<BuildJob> {
    if (!message.Body) {
        throw new Error(`Message ${message.MessageId} has no body`);
    }

    const payload = JSON.parse(message.Body);

    if (
        typeof payload.id !== 'number' ||
        typeof payload.repoName !== 'string' ||
        typeof payload.repoUrl !== 'string' ||
        typeof payload.buildCommand !== 'string' ||
        typeof payload.buildOutDir !== 'string'
    ) {
        throw new Error(
            `Message ${message.MessageId} contains an invalid BuildJob payload`
        );
    }

    //Generate the Github Installation Id
    try {
        const response = await fetch(`${PRIMARY_BACKEND_URL}/github/installation-token?user_id=${payload.user_id}`)
        const installation_id: any = await response.json()
        payload.gitToken = installation_id.data.token
    } catch(e) {
        console.error(`Error Generating a github Token: ${e}`)
        payload.gitToken = null
    }


    // Validate optional envVars — must be a plain object with string values
    if (payload.envVars !== undefined) {
        if (
            typeof payload.envVars !== 'object' ||
            payload.envVars === null ||
            Array.isArray(payload.envVars) ||
            !Object.values(payload.envVars).every((v: unknown) => typeof v === 'string')
        ) {
            throw new Error(
                `Message ${message.MessageId} contains invalid envVars — expected Record<string, string>`
            );
        }
    }

    return payload as BuildJob;
}

async function acknowledgeMessage(receiptHandle: string): Promise<void> {
    await sqs.send(
        new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: receiptHandle,
        })
    );
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
