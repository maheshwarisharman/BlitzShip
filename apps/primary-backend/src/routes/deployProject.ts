import { Router } from "express";
import { prisma } from '@repo/db'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { validate } from '../middleware/validate.middleware.js'
import { createNewProjectSchema, createDeploymentSchema } from "../schemas/deployment.schema.js";
import type { BuildJob } from '@repo/types'

const router: Router = Router()

const sqs = new SQSClient({ region: process.env.AWS_REGION })
const QUEUE_URL = process.env.SQS_QUEUE_URL!

router.post('/create-project', validate(createNewProjectSchema), async (req, res) => {

    const body = req.body
    console.log(body)

    try {
        const project = await prisma.project.create({
            data: {
                user_id: body.user_id,
                name: body.name,
                description: body.description,
                github_url: body.github_url,
                build_cmd: body.build_cmd,
                output_dir: body.output_dir,
                repoName: body.repoName,
                build_branch: body.build_branch,
                primary_domain: body.primary_domain,
                project_env: body.project_envs
            }
        })
        res.status(200).json({
            message: "Project Created Successfully",
            data: project
        })

    } catch (e) {
        console.log(e)
        res.status(500).json({
            message: "Some Error occured",
            error: e
        })
    }
})

router.post('/create-deployment', validate(createDeploymentSchema), async (req, res) => {

    const body = req.body
    console.log(body);
    
    try {

        const deployment = await prisma.deployment.create({
            data: {
                project_id: body.project_id,
            }
        })

        const project = await prisma.project.findUniqueOrThrow({
            where: { project_id: body.project_id }
        })

        const envVars: Record<string, string> = project.project_env
            ? (project.project_env as Record<string, string>)
            : {}

        const job: BuildJob = {
            id: deployment.deployment_id,
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

        console.log(`[deploy] Queued build job ${job.id} for project "${job.repoName}"`)

        res.status(200).json({
            message: "Deployment created and build job queued",
            data: { deployment, jobId: job.id }
        })

    } catch (e) {
        console.log(e);
        
        res.status(500).json({
            message: "Some Error occured",
            error: e
        })
    }
})

export default router