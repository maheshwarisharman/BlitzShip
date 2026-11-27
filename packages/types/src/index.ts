export interface BuildJob {
    id: number;
    repoId?: string;
    repoName: string;
    repoUrl: string;
    // Optional so jobs queued before this field existed still build (from the default branch)
    buildBranch?: string;
    gitToken?: string;
    buildCommand: string;
    buildOutDir: string;
    envVars?: Record<string, string>;
    user_id: string
}
