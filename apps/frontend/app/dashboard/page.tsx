"use client"
import { ProjectCard, ProjectCardSkeleton, type Project } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Github, Loader2, AlertCircle, X, Check, GitBranch } from "lucide-react";
import axios from "axios"
import  {useEffect, useRef, useState} from "react"
import { useAuth } from "@clerk/nextjs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { getToken, userId, isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
    const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    const [projects, setProjects] = useState<Project[]>([])
    const [skeletonCount, setSkeletonCount] = useState(3)
    const latestFetchIdRef = useRef(0)
    const [githubRepos, setGithubRepos] = useState<any[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoadingNewProject, setIsLoadingNewProject] = useState(false)
    const [isFetchingProjects, setIsFetchingProjects] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const [configModalOpen, setConfigModalOpen] = useState(false)
    const [selectedRepo, setSelectedRepo] = useState<any>(null)
    const [projectConfig, setProjectConfig] = useState({
        name: "",
        description: "",
        github_url: "",
        repoId: "",
        build_cmd: "npm run build",
        output_dir: "dist",
        repoName: "",
        build_branch: "main",
        primary_domain: "",
        project_envs: [] as { key: string, value: string }[]
    })

    const [envKey, setEnvKey] = useState("")
    const [envVal, setEnvVal] = useState("")
    const [isDeploying, setIsDeploying] = useState(false)
    const [deployError, setDeployError] = useState<string | null>(null)
    const [isCheckingDomain, setIsCheckingDomain] = useState(false);
    const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
    const [domainError, setDomainError] = useState<string | null>(null);
    const [branches, setBranches] = useState<string[]>([])
    const [isFetchingBranches, setIsFetchingBranches] = useState(false)

    const domainInputRef = useRef<HTMLInputElement>(null);
    const [domainTooltipOpen, setDomainTooltipOpen] = useState(false);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isDomainMissing = !projectConfig.primary_domain.trim();

    const triggerDomainTooltip = () => {
        setDomainTooltipOpen(true);
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        tooltipTimeoutRef.current = setTimeout(() => {
            setDomainTooltipOpen(false);
        }, 3000);

        setDomainError("Please enter the domain first");
        if (domainInputRef.current) {
            domainInputRef.current.focus();
            domainInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    const handleCheckDomain = async () => {
        if (!projectConfig.primary_domain.trim()) {
            setDomainAvailable(null);
            setDomainError(null);
            return;
        }
        
        setIsCheckingDomain(true);
        setDomainAvailable(null);
        setDomainError(null);

        try {
            const token = await getToken();
            if (!token) return;
            await axios.get(`${API_BASE_URL}/domain/search/${projectConfig.primary_domain}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setDomainAvailable(true);
        } catch (error: any) {
            if (error?.response?.status === 404) {
                setDomainAvailable(false);
            } else {
                setDomainError("Error checking domain availability");
            }
        } finally {
            setIsCheckingDomain(false);
        }
    };


    const fetchProject = async () => {
        const fetchId = ++latestFetchIdRef.current;
        setIsFetchingProjects(true)
        try {
            let token = await getToken();
            if (!token) {
                // If token is null immediately post-login navigation, give Clerk session a moment to synchronize
                await new Promise((resolve) => setTimeout(resolve, 300));
                token = await getToken();
            }
            if (!token) {
                console.warn("Unable to obtain Clerk auth token");
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/projects/all`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            if (fetchId === latestFetchIdRef.current) {
                setProjects(response.data.data || [])
            }
        } catch (error) {
            console.error("Failed to fetch projects", error)
        } finally {
            if (fetchId === latestFetchIdRef.current) {
                setIsFetchingProjects(false)
            }
        }
    }

    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            setIsFetchingProjects(false);
            router.push("/login");
            return;
        }
        fetchProject();
    }, [isLoaded, isSignedIn]);

    const handleAddNewProject = async () => {
        setIsLoadingNewProject(true);
        setErrorMsg(null);
        try {
            const token = await getToken();
            if (!token) {
                setErrorMsg("Authentication token not available. Please try again.");
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/github/is-github-linked`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            if (response.data.success) {
                // GitHub is already linked — open the import-repository flow
                const reposRes = await axios.get(`${API_BASE_URL}/github/get-repos?user_id=${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                if (reposRes.data.success) {
                    setGithubRepos(reposRes.data.data.reverse())
                    setIsModalOpen(true)
                } else {
                    setErrorMsg("Failed to fetch repositories.");
                }
            } else {
                // GitHub is not linked — send user to GitHub App installation page.
                // GitHub will redirect back to /github-callback with a `code` query param.
                window.location.href = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
            }
        } catch (error: any) {
            console.error("Error checking github link:", error)
            setErrorMsg(error?.response?.data?.message || error?.message || "An error occurred while connecting to GitHub.");
        } finally {
            setIsLoadingNewProject(false);
        }
    }

    const fetchBranches = async (repoFullName: string, defaultBranch: string) => {
        setIsFetchingBranches(true)
        setBranches([])
        try {
            const token = await getToken()
            if (!token) return;
            const res = await axios.get(
                `${API_BASE_URL}/github/get-branches?user_id=${userId}&repo=${encodeURIComponent(repoFullName)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            if (res.data.success) {
                const fetchedBranches: string[] = res.data.data
                setBranches(fetchedBranches)
                // Ensure the default branch stays selected if it's in the list
                if (!fetchedBranches.includes(defaultBranch) && fetchedBranches.length > 0) {
                    setProjectConfig(prev => ({ ...prev, build_branch: fetchedBranches[0] }))
                }
            }
        } catch (e) {
            console.error("Failed to fetch branches:", e)
            // Fall back to just showing the default branch
            setBranches([defaultBranch])
        } finally {
            setIsFetchingBranches(false)
        }
    }

    const handleImportClick = (repo: any) => {
        const defaultBranch = repo.default_branch || "main"
        setSelectedRepo(repo);
        setProjectConfig({
            name: repo.name,
            description: repo.description || "",
            github_url: repo.html_url,
            repoId: String(repo.id),
            build_cmd: "npm run build",
            output_dir: "dist",
            repoName: repo.full_name,
            build_branch: defaultBranch,
            primary_domain: "",
            project_envs: []
        });
        setEnvKey("");
        setEnvVal("");
        setDomainAvailable(null);
        setDomainError(null);
        setDomainTooltipOpen(false);
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        setIsModalOpen(false); // Close repos modal
        setConfigModalOpen(true); // Open config modal
        fetchBranches(repo.full_name, defaultBranch); // Fetch branches in background
    }

    const handleAddEnv = () => {
        if (envKey.trim() && envVal.trim()) {
            setProjectConfig(prev => ({
                ...prev,
                project_envs: [...prev.project_envs, { key: envKey.trim(), value: envVal.trim() }]
            }))
            setEnvKey("")
            setEnvVal("")
        }
    }

    const handleRemoveEnv = (index: number) => {
        setProjectConfig(prev => ({
            ...prev,
            project_envs: prev.project_envs.filter((_, i) => i !== index)
        }))
    }

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeployError(null);
        try {
            const token = await getToken();
            if (!token) {
                setDeployError("Authentication token not available. Please try again.");
                return;
            }
            const headers = { Authorization: `Bearer ${token}` };

            // Convert env array [{key,value}] → Record<string,string> expected by backend
            const envRecord = projectConfig.project_envs.reduce<Record<string, string>>(
                (acc, { key, value }) => { acc[key] = value; return acc; },
                {}
            );

            // Step 1 — create the project
            const createRes = await axios.post(
                `${API_BASE_URL}/deploy/create-project`,
                {
                    name: projectConfig.name,
                    description: projectConfig.description,
                    github_url: projectConfig.github_url,
                    repoId: projectConfig.repoId,
                    build_cmd: projectConfig.build_cmd,
                    output_dir: projectConfig.output_dir,
                    repoName: projectConfig.repoName,
                    build_branch: projectConfig.build_branch,
                    primary_domain: projectConfig.primary_domain,
                    project_envs: envRecord,
                },
                { headers }
            );

            const projectId: number = createRes.data.data.project_id;

            // Step 2 — trigger the first deployment
            await axios.post(
                `${API_BASE_URL}/deploy/create-deployment`,
                { project_id: projectId },
                { headers }
            );

            // Success — navigate to the new project page
            setConfigModalOpen(false);
            router.push(`/project/${projectId}`);
        } catch (error: any) {
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "An unexpected error occurred. Please try again.";
            setDeployError(msg);
        } finally {
            setIsDeploying(false);
        }
    }

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex w-full sm:w-auto items-center gap-3 relative">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            className="w-full sm:w-80 pl-9 h-10 border-border bg-background" 
          />
        </div>
        <Button 
          onClick={handleAddNewProject} 
          disabled={isLoadingNewProject}
          className="h-10 px-4 bg-foreground text-background hover:bg-neutral-200 font-medium w-full sm:w-auto"
        >
          {isLoadingNewProject ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Add New..."
          )}
        </Button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}

      {/* Projects Grid or Loading State */}
      {isFetchingProjects ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <ProjectCardSkeleton key={i} index={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center py-24 gap-5 w-full overflow-hidden rounded-[28px] border border-dashed border-white/10 bg-card/40">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative w-14 h-14 rounded-2xl bg-card ring-1 ring-white/10 flex items-center justify-center shadow-lg">
            <Github className="w-6 h-6 text-foreground" />
          </div>
          <div className="relative text-center max-w-sm">
            <h3 className="font-display font-semibold text-xl tracking-tight text-foreground">Nothing shipped yet</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Import a GitHub repository and your first deployment will be live in minutes.</p>
          </div>
          <Button
            onClick={handleAddNewProject}
            disabled={isLoadingNewProject}
            className="relative h-10 px-5 rounded-xl bg-foreground text-background hover:bg-white font-medium"
          >
            Import a repository
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project, i) => (
            <ProjectCard key={project.project_id} project={project} index={i} />
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Import GitHub Repository</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {githubRepos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No repositories found.</p>
            ) : (
              githubRepos.map((repo: any) => (
                <div key={repo.id} className="flex flex-row items-center justify-between p-4 border border-border rounded-md hover:bg-neutral-900 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Github className="w-4 h-4" /> {repo.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{repo.private ? "Private" : "Public"} • {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : ""}</span>
                  </div>
                  <Button variant="secondary" size="sm" className="h-8" onClick={() => handleImportClick(repo)}>
                    Import
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-background text-foreground border-border">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">Configure Project</DialogTitle>
          </DialogHeader>

          {selectedRepo && (
            <div className="flex flex-col gap-6">
              <div className="flex gap-4 items-center p-4 border border-border rounded-lg bg-neutral-900/30">
                <Github className="w-8 h-8" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">{selectedRepo.full_name}</span>
                  <span className="text-xs text-muted-foreground">{selectedRepo.private ? "Private" : "Public"} repository</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Project Name</label>
                  <Input 
                    value={projectConfig.name} 
                    onChange={(e) => setProjectConfig({...projectConfig, name: e.target.value})} 
                    className="border-border bg-background h-9" 
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input 
                    value={projectConfig.description} 
                    onChange={(e) => setProjectConfig({...projectConfig, description: e.target.value})} 
                    className="border-border bg-background h-9" 
                    placeholder="My awesome project..."
                  />
                </div>

                <div className="mt-2 border border-border rounded-lg bg-background p-4 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold tracking-tight">Domain Setup</h3>
                  <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">PRIMARY DOMAIN</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          ref={domainInputRef}
                          value={projectConfig.primary_domain} 
                          onChange={(e) => {
                             setProjectConfig({...projectConfig, primary_domain: e.target.value});
                             if (domainAvailable !== null) setDomainAvailable(null);
                             if (domainError !== null) setDomainError(null);
                             if (domainTooltipOpen) setDomainTooltipOpen(false);
                          }} 
                          placeholder="e.g. my-app"
                          className={`flex-1 border-border bg-neutral-900/50 font-mono text-sm h-9 ${domainAvailable === false || domainError ? 'border-red-500/50 focus-visible:ring-red-500/50' : domainAvailable === true ? 'border-green-500/50 focus-visible:ring-green-500/50' : ''}`} 
                        />
                        <Button
                          variant="secondary"
                          onClick={handleCheckDomain}
                          disabled={!projectConfig.primary_domain.trim() || isCheckingDomain}
                          className="h-9 px-4 shrink-0"
                        >
                          {isCheckingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                        </Button>
                      </div>
                      <p className="text-[14px]">https://<span className="font-semibold">{projectConfig.primary_domain || "..."}</span>.blitzship.app</p>
                      {domainAvailable === true && (
                        <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Domain is available
                        </span>
                      )}
                      {domainAvailable === false && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Domain is already taken
                        </span>
                      )}
                      {domainError && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {domainError}
                        </span>
                      )}
                  </div>
                </div>

                <div className="mt-2 border border-border rounded-lg bg-background p-4 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold tracking-tight">Build and Output Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">BUILD COMMAND</label>
                      <Input 
                        value={projectConfig.build_cmd} 
                        onChange={(e) => setProjectConfig({...projectConfig, build_cmd: e.target.value})} 
                        className="border-border bg-neutral-900/50 font-mono text-sm h-9" 
                        placeholder="npm run build"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">OUTPUT DIRECTORY</label>
                      <Input 
                        value={projectConfig.output_dir} 
                        onChange={(e) => setProjectConfig({...projectConfig, output_dir: e.target.value})} 
                        className="border-border bg-neutral-900/50 font-mono text-sm h-9" 
                        placeholder="dist" 
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">BRANCH TO DEPLOY</label>
                      <Select
                        value={projectConfig.build_branch}
                        onValueChange={(v) => setProjectConfig({ ...projectConfig, build_branch: v })}
                        disabled={isFetchingBranches || branches.length === 0}
                      >
                        <SelectTrigger className="border-border bg-neutral-900/50 font-mono text-sm h-9 w-full px-3">
                          {isFetchingBranches ? (
                            <span className="flex flex-1 items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                              Loading branches…
                            </span>
                          ) : (
                            <span className="flex flex-1 items-center gap-2">
                              <GitBranch className="w-3 h-3 text-muted-foreground shrink-0" />
                              <SelectValue placeholder="Select branch" />
                            </span>
                          )}
                        </SelectTrigger>
                        <SelectContent position="popper" className="bg-neutral-900 border-border w-[--radix-select-trigger-width]">
                          {branches.map((branch) => (
                            <SelectItem
                              key={branch}
                              value={branch}
                              className="font-mono text-sm cursor-pointer px-3 py-2"
                            >
                              {branch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>
                </div>
                <div className="mt-2 border border-border rounded-lg bg-background p-4 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold tracking-tight">Environment Variables</h3>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2">
                        <div className="w-1/3 flex flex-col gap-2">
                          <label className="text-xs font-medium text-muted-foreground w-full">KEY</label>
                          <Input 
                            value={envKey} 
                            onChange={(e) => setEnvKey(e.target.value)} 
                            className="border-border bg-neutral-900/50 font-mono text-sm h-9 w-full" 
                            placeholder="EXAMPLE_NAME"
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-xs font-medium text-muted-foreground w-full">VALUE</label>
                          <Input 
                            value={envVal} 
                            onChange={(e) => setEnvVal(e.target.value)} 
                            className="border-border bg-neutral-900/50 font-mono text-sm h-9 w-full" 
                            placeholder="some_db_url:8080"
                          />
                        </div>
                        <Button 
                          variant="secondary" 
                          onClick={handleAddEnv} 
                          className="mt-6 h-9" 
                          disabled={!envKey.trim() || !envVal.trim()}
                        >
                          Add
                        </Button>
                    </div>

                    {projectConfig.project_envs.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        {projectConfig.project_envs.map((env, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-1/3 bg-neutral-900/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono truncate">{env.key}</div>
                            <div className="flex-1 bg-neutral-900/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono truncate">{env.value}</div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveEnv(idx)} className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {deployError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{deployError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setConfigModalOpen(false)} disabled={isDeploying}>Cancel</Button>
                <Tooltip
                  open={isDomainMissing ? domainTooltipOpen : false}
                  onOpenChange={(open) => {
                    if (isDomainMissing) {
                      setDomainTooltipOpen(open);
                    }
                  }}
                >
                  <TooltipTrigger asChild>
                    <div
                      className={cn("inline-flex outline-none", isDomainMissing && "cursor-not-allowed")}
                      onClick={() => {
                        if (isDomainMissing) {
                          triggerDomainTooltip();
                        }
                      }}
                      tabIndex={isDomainMissing ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (isDomainMissing && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          triggerDomainTooltip();
                        }
                      }}
                    >
                      <Button
                        onClick={handleDeploy}
                        disabled={isDeploying || !projectConfig.name.trim() || domainAvailable !== true || isCheckingDomain}
                        className="bg-foreground text-background hover:bg-neutral-200 min-w-28"
                      >
                        {isDeploying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deploying...
                          </>
                        ) : (
                          "Deploy"
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {isDomainMissing && (
                    <TooltipContent side="top" align="center" className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-1.5 text-xs rounded-md shadow-xl">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Please enter the domain first</span>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
