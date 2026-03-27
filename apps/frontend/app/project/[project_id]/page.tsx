"use client"
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, ExternalLink, GitBranch, Terminal, Globe, Loader2, ArrowLeft, ArrowUpRight, Activity, CheckCircle, XCircle, Clock, Rocket } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { getToken } = useAuth();
    
    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

    useEffect(() => {
        const fetchProject = async () => {
            if (!params.project_id) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                const token = await getToken();
                const response = await axios.post(`${API_BASE_URL}/projects/single`, {
                    project_id: Number(params.project_id)
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                
                if (response.data.success || response.data.data) {
                    setProject(response.data.data || response.data); 
                } else {
                    setError("Failed to fetch project details.");
                }
            } catch (err: any) {
                console.error("Error fetching project:", err);
                setError(err?.response?.data?.message || err?.message || "An error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProject();
    }, [params.project_id, getToken, API_BASE_URL]);

    const handleDeploy = async () => {
        if (!params.project_id) return;
        try {
            setIsDeploying(true);
            const token = await getToken();
            await axios.post(`${API_BASE_URL}/deploy/create-deployment`, {
                project_id: Number(params.project_id)
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            window.location.reload();
        } catch (err: any) {
            console.error("Error triggering deployment:", err);
            alert("Failed to trigger deployment: " + (err?.response?.data?.message || err?.message || "Unknown error"));
        } finally {
            setIsDeploying(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 w-full animate-pulse max-w-5xl mx-auto px-4 py-8">
                <div className="h-8 w-1/4 bg-neutral-800 rounded"></div>
                <div className="h-64 rounded-xl bg-neutral-900 border border-neutral-800"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-48 rounded-xl bg-neutral-900 border border-neutral-800"></div>
                    <div className="h-48 rounded-xl bg-neutral-900 border border-neutral-800"></div>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <div className="bg-red-500/10 p-4 rounded-full mb-4 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Project Error</h2>
                <p className="text-muted-foreground mb-6 max-w-md">{error || "The project you are looking for does not exist."}</p>
                <Button onClick={() => router.push('/dashboard')} variant="outline">
                    Return to Dashboard
                </Button>
            </div>
        );
    }

    const formatVisitUrl = (domain: string) => {
        if (!domain) return "";
        return domain.startsWith("http") ? domain : `https://${domain}`;
    };

    return (
        <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-12 pt-4 px-4 sm:px-6">
            {/* Header Section */}
            <div className="flex flex-col gap-5">
                <div>
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-2.5 py-0.5 pointer-events-none">
                                Active
                            </Badge>
                        </div>
                        {project.description && (
                            <p className="text-muted-foreground text-sm max-w-2xl">{project.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <a href={project.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors group">
                                <Github className="w-4 h-4" />
                                <span className="underline decoration-transparent group-hover:decoration-foreground transition-colors">{project.repoName}</span>
                            </a>
                            <span className="flex items-center gap-1.5">
                                <GitBranch className="w-4 h-4" />
                                {project.build_branch}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                        <Button 
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className="h-9 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white font-medium border border-transparent shadow-sm"
                        >
                            {isDeploying ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin opacity-70" />
                            ) : (
                                <Rocket className="w-4 h-4 mr-2 opacity-70" />
                            )}
                            {isDeploying ? "Deploying..." : "Trigger Deployment"}
                        </Button>
                        <a href={project.github_url} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="h-9 whitespace-nowrap">
                                <Github className="w-4 h-4 mr-2" />
                                Repository
                            </Button>
                        </a>
                        {project.primary_domain && (
                            <a href={formatVisitUrl(project.primary_domain)} target="_blank" rel="noreferrer">
                                <Button className="h-9 whitespace-nowrap bg-foreground text-background hover:bg-neutral-200 font-medium border border-transparent">
                                    Visit <ArrowUpRight className="w-4 h-4 ml-1.5 opacity-70" />
                                </Button>
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Deployment Overview */}
                <Card className="col-span-1 md:col-span-2 bg-background border-border shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-muted-foreground" />
                            Production Deployment
                        </CardTitle>
                        <CardDescription>
                            The latest successful deployment of your default branch.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-6">
                        {/* Domain Preview Mock */}
                        <div className="w-full md:w-5/12 aspect-video bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col items-center justify-center overflow-hidden relative group">
                            <Globe className="w-10 h-10 text-neutral-700 relative z-10 mb-2" />
                            <span className="text-xs font-medium text-neutral-500">Preview Available</span>
                            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 to-transparent z-10 flex border-t border-neutral-800/50">
                                <p className="text-[11px] text-neutral-400 truncate font-mono">{project.primary_domain || "No domain linked"}</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center gap-5">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Domains</span>
                                <a href={formatVisitUrl(project.primary_domain)} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-foreground flex items-center gap-1.5 group">
                                    {project.primary_domain || "Not configured"} 
                                    {project.primary_domain && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </a>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Branch</span>
                                <div className="text-sm font-mono flex items-center gap-1.5">
                                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground" /> 
                                    {project.build_branch}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Created At</span>
                                <span className="text-sm text-muted-foreground">{new Date(project.created_at).toLocaleDateString()} at {new Date(project.created_at).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Configuration Details */}
                <Card className="col-span-1 bg-background border-border shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold">Build Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Framework</span>
                            <div className="text-sm font-medium flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-[9px]">
                                    {project.name ? project.name.charAt(0).toUpperCase() : "N"}
                                </div>
                                Auto-detected
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                            <span className="text-xs font-medium text-muted-foreground">Build Command</span>
                            <div className="bg-neutral-900/70 text-neutral-300 font-mono text-xs p-2.5 rounded-md border border-neutral-800 flex items-center gap-2 overflow-x-auto">
                                <Terminal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                {project.build_cmd || "npm run build"}
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                            <span className="text-xs font-medium text-muted-foreground">Output Directory</span>
                            <div className="bg-neutral-900/70 text-neutral-300 font-mono text-xs p-2.5 rounded-md border border-neutral-800 flex items-center gap-2 overflow-x-auto">
                                <Terminal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                {project.output_dir || "dist"}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                {/* Environment Variables & Details */}
                <Card className="col-span-1 md:col-span-3 bg-background border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-lg font-semibold">Environment Variables</CardTitle>
                            <CardDescription>Variables applied to the environments for this project.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="hidden sm:flex">Manage</Button>
                    </CardHeader>
                    <CardContent>
                        {project.project_env && Object.keys(project.project_env).length > 0 ? (
                            <div className="border border-border rounded-lg overflow-hidden">
                                <div className="grid grid-cols-2 bg-neutral-900/80 p-3 text-xs font-medium text-muted-foreground border-b border-border">
                                    <div>KEY</div>
                                    <div>VALUE</div>
                                </div>
                                <div className="divide-y divide-border">
                                    {Object.entries(project.project_env).map(([key, value]) => (
                                        <div key={key} className="grid grid-cols-2 p-3 text-sm hover:bg-neutral-900/30 transition-colors">
                                            <div className="font-mono text-foreground truncate pr-4">{key}</div>
                                            <div className="font-mono text-muted-foreground truncate">{value as string}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 border border-dashed border-border rounded-lg bg-neutral-900/20">
                                <p className="text-sm text-muted-foreground">No environment variables configured.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Deployments History */}
                <Card className="col-span-1 md:col-span-3 bg-background border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-lg font-semibold">Deployments</CardTitle>
                            <CardDescription>Recent deployment history for this project.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {project.deployments && project.deployments.length > 0 ? (
                            <div className="border border-border rounded-lg overflow-hidden">
                                <div className="grid grid-cols-12 bg-neutral-900/80 p-3 text-xs font-medium text-muted-foreground border-b border-border">
                                    <div className="col-span-3 md:col-span-3">STATUS</div>
                                    <div className="col-span-4 md:col-span-3">PREVIEW URL</div>
                                    <div className="hidden md:block md:col-span-3">BRANCH</div>
                                    <div className="col-span-3 md:col-span-2 text-right">DATE</div>
                                    <div className="col-span-2 md:col-span-1 text-right">LOGS</div>
                                </div>
                                <div className="divide-y divide-border">
                                    {[...project.deployments].reverse().map((deployment: any) => (
                                        <div key={deployment.deployment_id} className="grid grid-cols-12 p-3 text-sm hover:bg-neutral-900/30 transition-colors items-center">
                                            <div className="col-span-3 md:col-span-3 flex items-center gap-2">
                                                {deployment.is_build_success === true ? (
                                                    <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-foreground">Ready</span></>
                                                ) : deployment.is_build_success === false ? (
                                                    <><XCircle className="w-4 h-4 text-red-500" /><span className="text-foreground">Failed</span></>
                                                ) : (
                                                    <><Clock className="w-4 h-4 text-yellow-500" /><span className="text-foreground">Building</span></>
                                                )}
                                            </div>
                                            <div className="col-span-4 md:col-span-3 font-mono text-muted-foreground truncate pr-4">
                                                {deployment.preview_url ? (
                                                    <a href={formatVisitUrl(deployment.preview_url)} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors hover:underline flex items-center gap-1.5">
                                                        <span className="truncate">{deployment.preview_url}</span>
                                                        <ExternalLink className="w-3 h-3 opacity-70 flex-shrink-0" />
                                                    </a>
                                                ) : (
                                                    <span className="opacity-50">-</span>
                                                )}
                                            </div>
                                            <div className="hidden md:flex md:col-span-3 font-mono text-muted-foreground items-center gap-1.5 truncate">
                                                <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span className="truncate">{project.build_branch || "main"}</span>
                                            </div>
                                            <div className="col-span-3 md:col-span-2 text-muted-foreground text-right truncate text-xs flex items-center justify-end">
                                                {new Date(deployment.created_at).toLocaleDateString()}
                                            </div>
                                            <div className=" md:col-span-1 flex items-center justify-end">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                            <Terminal className="w-4 h-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-6xl w-[95vw] h-[60vh] max-h-[90vh] flex flex-col bg-neutral-950 border-neutral-800">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center gap-2">
                                                                <Terminal className="w-5 h-5" /> 
                                                                Build Logs
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                Deployment ID: {deployment.deployment_id}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="flex-1 overflow-y-auto bg-black p-4 rounded-md border border-neutral-800 font-mono text-xs text-neutral-300 whitespace-pre-wrap">
                                                            {deployment.build_logs || "No build logs available."}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 border border-dashed border-border rounded-lg bg-neutral-900/20">
                                <p className="text-sm text-muted-foreground">No deployment history available.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
