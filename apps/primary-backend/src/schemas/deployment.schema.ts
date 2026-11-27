import { z } from "zod";
import { normalizeOutputDir, OUTPUT_DIR_RULES_MESSAGE } from "../utils/outputDir.js";

export const outputDirSchema = z
    .string()
    .refine((value) => normalizeOutputDir(value) !== null, { message: OUTPUT_DIR_RULES_MESSAGE })
    .transform((value) => normalizeOutputDir(value)!)

// Branch names are passed to `git clone --branch`, so a leading "-" must never be accepted
export const branchSchema = z
    .string()
    .trim()
    .min(1, { message: "Branch is required" })
    .max(255)
    .refine((value) => !value.startsWith("-"), { message: "Invalid branch name" })

export const createDeploymentSchema = z.object({
    project_id: z.number()
})

export const createNewProjectSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    github_url: z.url(),
    repoId: z.union([z.string(), z.number().transform(String)]),
    build_cmd: z.string(),
    output_dir: outputDirSchema,
    repoName: z.string(),
    build_branch: branchSchema,
    primary_domain: z.string(),
    project_envs: z.record(z.string(), z.string()).optional()
})
