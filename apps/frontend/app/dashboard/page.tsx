"use client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Github, MoreHorizontal, ExternalLink, Loader2, AlertCircle, X } from "lucide-react";
import axios from "axios"
import  {useEffect, useState} from "react"
import { useAuth } from "@clerk/nextjs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function DashboardPage() {
    const { getToken, userId } = useAuth();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
    const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    const [projects, setProjects] = useState([])
    const [githubRepos, setGithubRepos] = useState<any[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoadingNewProject, setIsLoadingNewProject] = useState(false)
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


    const fetchProject = async () => {
        const token = await getToken();
        const projects = await axios.get(`${API_BASE_URL}/projects/all`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        setProjects(projects.data.data)
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

      {/* Projects Grid */}
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
                  <CardTitle className="text-sm font-semibold tracking-tight">{project.name}</CardTitle>
                </div>
                <CardDescription className="text-[13px] text-muted-foreground font-medium flex items-center gap-1.5 hover:text-foreground hover:underline cursor-pointer transition-colors max-w-fit">
                  {project.url} <ExternalLink className="w-3 h-3" />
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
                  <span className="text-[13px]">{project.timeAgo}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-5 border-t border-border bg-neutral-950/30 text-xs text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono truncate max-w-[70%]">
                <Github className="w-4 h-4 text-foreground shrink-0" />
                <span className="truncate">{project.repo}</span>
              </div>
              <div className="flex items-center gap-1.5 border border-border px-2 py-0.5 rounded-md bg-transparent text-[11px] font-mono shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-muted-foreground"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {project.branch}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

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

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setConfigModalOpen(false)}>Cancel</Button>
                <Button className="bg-foreground text-background hover:bg-neutral-200 min-w-24">
                  Deploy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
