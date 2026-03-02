export interface BuildJob {
    id: number;
    repoName: string;
    repoUrl: string;
    gitToken?: string;
    buildCommand: string;
    buildOutDir: string;
    envVars?: Record<string, string>;
    user_id: string
}
