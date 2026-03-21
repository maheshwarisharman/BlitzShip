"use client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Github, MoreHorizontal, ExternalLink } from "lucide-react";
import axios from "axios"
import  {useEffect, useState} from "react"

export default function DashboardPage() {

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

    const [projects, setProjects] = useState([])


    const fetchProject = async () => {
        const projects = await axios.get(`https://nonstimulative-donnetta-horotelic.ngrok-free.dev/projects/all`)
        setProjects(projects.data.data)
    }

    useEffect(() => {
      fetchProject()
    }, [])

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
        <Button className="h-10 px-4 bg-foreground text-background hover:bg-neutral-200 font-medium w-full sm:w-auto">
          Add New...
        </Button>
      </div>

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
    </div>
  );
}
