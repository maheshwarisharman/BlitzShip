import { z } from "zod";

export const createDeploymentSchema = z.object({
    project_id: z.number()
})

export const createNewProjectSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    github_url: z.url(),
    repoId: z.union([z.string(), z.number().transform(String)]),
    build_cmd: z.string(),
    output_dir: z.string(),
    repoName: z.string(),
    build_branch: z.string(),
    primary_domain: z.string(),
    project_envs: z.record(z.string(), z.string()).optional()
})