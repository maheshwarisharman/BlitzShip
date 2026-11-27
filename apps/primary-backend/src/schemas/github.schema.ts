import { z } from "zod";
import { branchSchema } from "./deployment.schema.js";

export const githubAuthSchema = z.object({
        code: z.string(),
        user_id: z.string()
})

// Interpolated into GitHub API URLs, so restrict to GitHub's owner/name character set
export const repoFullNameSchema = z
        .string()
        .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, { message: "repo must be in the form owner/name" })

export const getBranchesQuerySchema = z.object({
        repo: repoFullNameSchema
})

export const detectConfigQuerySchema = z.object({
        repo: repoFullNameSchema,
        branch: branchSchema
})
