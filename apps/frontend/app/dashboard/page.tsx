"use client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Github, MoreHorizontal, ExternalLink, Loader2, AlertCircle, X, Check } from "lucide-react";
import axios from "axios"
import  {useEffect, useState} from "react"
import { useAuth } from "@clerk/nextjs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";

export default function DashboardPage() {
    const { getToken, userId } = useAuth();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
    const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    const [projects, setProjects] = useState<any[]>([])
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
        setIsFetchingProjects(true)
        try {
            const token = await getToken();
            const response = await axios.get(`${API_BASE_URL}/projects/all`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            setProjects(response.data.data)
        } catch (error) {
            console.error("Failed to fetch projects")
        } finally {
            setIsFetchingProjects(false)
        }
    }

    useEffect(() => {
      fetchProject()
    }, [])

    const handleAddNewProject = async () => {
        setIsLoadingNewProject(true);
        setErrorMsg(null);
        try {
            const token = await getToken();
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

    const handleImportClick = (repo: any) => {
        setSelectedRepo(repo);
        setProjectConfig({
            name: repo.name,
            description: repo.description || "",
            github_url: repo.html_url,
            build_cmd: "npm run build",
            output_dir: "dist",
            repoName: repo.full_name,
            build_branch: repo.default_branch || "main",
            primary_domain: "",
            project_envs: []
        });
        setEnvKey("");
        setEnvVal("");
        setDomainAvailable(null);
        setDomainError(null);
        setIsModalOpen(false); // Close repos modal
        setConfigModalOpen(true); // Open config modal
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

            // Success — close modal and refresh projects list
            setConfigModalOpen(false);
            fetchProject();
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col justify-between overflow-hidden bg-background border-border shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-4">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 animate-pulse"></div>
                    <div className="h-5 w-32 bg-neutral-800 rounded animate-pulse"></div>
                  </div>
                  <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex-1">
                <div className="flex flex-col gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neutral-800 animate-pulse"></div>
                    <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse"></div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-5 border-t border-border bg-neutral-950/30 flex items-center justify-between">
                <div className="h-4 w-28 bg-neutral-800 rounded animate-pulse"></div>
                <div className="h-5 w-16 bg-neutral-800 rounded animate-pulse"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 w-full border border-border/40 rounded-xl bg-neutral-900/10 hover:border-border/60 transition-colors">
          <div className="w-12 h-12 rounded-full bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center">
            <Github className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center max-w-sm">
            <h3 className="font-medium text-base text-foreground">No projects found</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">You haven't deployed any projects yet. Import a GitHub repository to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.name} className="flex flex-col justify-between overflow-hidden bg-background border-border shadow-sm hover:border-neutral-700 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 mb-1">
                    {/* Framework icon placeholder */}
                    <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-[10px]">
                      N
                    </div>
                    <Link href={`/project/${project.project_id}`}>
                      <CardTitle className="text-sm font-semibold tracking-tight hover:underline cursor-pointer">{project.name}</CardTitle>
                    </Link>
                  </div>
                  <CardDescription className="text-[13px] text-muted-foreground font-medium flex items-center gap-1.5 hover:text-foreground hover:underline cursor-pointer transition-colors max-w-fit">
                    {project.primary_domain} <ExternalLink className="w-3 h-3" />
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex-1">
                <div className="flex flex-col gap-3 text-sm mt-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-[13px]">Production</span>
                    <span className="text-neutral-600 px-1">•</span>
                    <span className="text-[13px]">{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-5 border-t border-border bg-neutral-950/30 text-xs text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono truncate max-w-[70%]">
                  <Github className="w-4 h-4 text-foreground shrink-0" />
                  <span className="truncate">{project.repoName}</span>
                </div>
                <div className="flex items-center gap-1.5 border border-border px-2 py-0.5 rounded-md bg-transparent text-[11px] font-mono shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-muted-foreground"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {project.build_branch}
                </div>
              </CardFooter>
            </Card>
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
                          value={projectConfig.primary_domain} 
                          onChange={(e) => {
                             setProjectConfig({...projectConfig, primary_domain: e.target.value});
                             if (domainAvailable !== null) setDomainAvailable(null);
                             if (domainError !== null) setDomainError(null);
                          }} 
                          className={`flex-1 border-border bg-neutral-900/50 font-mono text-sm h-9 ${domainAvailable === false ? 'border-red-500/50 focus-visible:ring-red-500/50' : domainAvailable === true ? 'border-green-500/50 focus-visible:ring-green-500/50' : ''}`} 
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
                      <p className="text-[14px]">https://<span className="font-semibold">{projectConfig.primary_domain}</span>.dev.blitznative.com</p>
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
                      <Input 
                        value={projectConfig.build_branch} 
                        onChange={(e) => setProjectConfig({...projectConfig, build_branch: e.target.value})} 
                        className="border-border bg-neutral-900/50 font-mono text-sm h-9" 
                        placeholder="main" 
                      />
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
