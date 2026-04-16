"use client";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  ExternalLink,
  GitBranch,
  Terminal,
  Globe,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Rocket,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  MoreVertical,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type Deployment = {
  deployment_id: number;
  is_build_success: boolean | null;
  preview_url: string | null;
  created_at: string;
  build_logs: string | null;
  is_production?: boolean;
};

type CustomDomainStatus =
  | "PENDING"
  | "ACTIVE"
  | "FAILED";

type CustomDomain = {
  id: string;
  domain: string;
  project_id: number;
  status: CustomDomainStatus;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

type Project = {
  project_id: number;
  name: string;
  description?: string | null;
  user_id: string;
  created_at: string;
  github_url: string;
  build_cmd: string;
  output_dir: string;
  repoName: string;
  build_branch: string;
  primary_domain: string;
  project_env?: Record<string, string> | null;
  deployments?: Deployment[];
};

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>([]);
  const [isLoadingCustomDomains, setIsLoadingCustomDomains] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState("");
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isMarkingProduction, setIsMarkingProduction] = useState<number | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    const fetchProject = async () => {
      if (!params.project_id) return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        const response = await axios.post(
          `${API_BASE_URL}/projects/single`,
          {
            project_id: Number(params.project_id),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data.success || response.data.data) {
          setProject(response.data.data || response.data);
        } else {
          setError("Failed to fetch project details.");
        }
      } catch (err: unknown) {
        console.error("Error fetching project:", err);
        const message = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message ||
            err.message
          : err instanceof Error
            ? err.message
            : "An error occurred.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [params.project_id, getToken, API_BASE_URL]);

  const sanitizeDomain = (input: string) =>
    input
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "")
      .toLowerCase()
      .trim();

  const fetchCustomDomains = useCallback(async () => {
    if (!params.project_id) return;

    try {
      setIsLoadingCustomDomains(true);
      const response = await axios.get(
        `${API_BASE_URL}/custom-domain/list/${Number(params.project_id)}`,
      );

      if (response.data?.success && Array.isArray(response.data?.data)) {
        setCustomDomains(response.data.data as CustomDomain[]);
      } else {
        setCustomDomains([]);
      }
    } catch (err) {
      console.error("Error fetching custom domains:", err);
      setCustomDomains([]);
    } finally {
      setIsLoadingCustomDomains(false);
    }
  }, [params.project_id, API_BASE_URL]);

  useEffect(() => {
    fetchCustomDomains();
  }, [fetchCustomDomains]);

  const statusBadgeStyles: Record<CustomDomainStatus, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const handleCopy = async (value: string, key: string) => {
    if (!value || value === "Pending") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(key);
      setTimeout(() => setCopiedValue(null), 1500);
    } catch (err) {
      console.error("Failed to copy DNS value:", err);
    }
  };

  const handleAddCustomDomain = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!params.project_id || !customDomain.trim()) return;

    setIsAddingDomain(true);
    setDomainError(null);
    setDomainMessage(null);

    try {
      const sanitizedDomain = sanitizeDomain(customDomain);
      const response = await axios.post(
        `${API_BASE_URL}/custom-domain/add-new-domain`,
        {
          domain: sanitizedDomain,
          project_id: Number(params.project_id),
        },
      );

      if (response.data?.success) {
        setDomainMessage(
          "Custom domain added successfully. Complete DNS verification to activate it.",
        );
        setCustomDomain("");
        await fetchCustomDomains();
      } else {
        setDomainError(
          response.data?.message || "Failed to add custom domain.",
        );
      }
    } catch (err: unknown) {
      console.error("Error adding custom domain:", err);
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : err instanceof Error
          ? err.message
          : "Failed to add custom domain.";
      setDomainError(message);
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleDeploy = async () => {
    if (!params.project_id) return;
    try {
      setIsDeploying(true);
      const token = await getToken();
      await axios.post(
        `${API_BASE_URL}/deploy/create-deployment`,
        {
          project_id: Number(params.project_id),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      window.location.reload();
    } catch (err: unknown) {
      console.error("Error triggering deployment:", err);
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
      alert("Failed to trigger deployment: " + message);
    } finally {
      setIsDeploying(false);
    }
  };

  const canDeleteProject =
    project?.name?.trim().toLowerCase() ===
      deleteConfirmName.trim().toLowerCase() &&
    deleteConfirmPhrase.trim().toLowerCase() === "delete my project";

  const handleDeleteProject = async () => {
    if (!params.project_id || !project || !canDeleteProject) return;

    setIsDeletingProject(true);
    setDeleteError(null);

    try {
      const token = await getToken();
      await axios.delete(`${API_BASE_URL}/projects/delete`, {
        data: {
          project_id: Number(params.project_id),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setIsDeleteModalOpen(false);
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Error deleting project:", err);
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : err instanceof Error
          ? err.message
          : "Failed to delete project.";
      setDeleteError(message);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleMarkProduction = async (deployment_id: number) => {
    try {
      setIsMarkingProduction(deployment_id);
      const token = await getToken();
      
      const payload = {
        deployment_id,
        domain_url: project?.primary_domain,
        is_custom_domain_present: customDomains.length > 0,
        custom_domain: customDomains.length > 0 ? customDomains[0].domain : undefined,
      };

      await axios.post(`${API_BASE_URL}/deploy/mark-production`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (project) {
        setProject({
          ...project,
          deployments: project.deployments?.map(dep => ({
            ...dep,
            is_production: dep.deployment_id === deployment_id
          }))
        });
      }
    } catch (err: unknown) {
      console.error("Error marking as production:", err);
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
      alert("Failed to mark deployment as production: " + message);
    } finally {
      setIsMarkingProduction(null);
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
        <p className="text-muted-foreground mb-6 max-w-md">
          {error || "The project you are looking for does not exist."}
        </p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const formatVisitUrl = (domain: string) => {
    if (!domain) return "";
    return domain.startsWith("http") ? domain : `https://${domain}.dev.blitznative.com`;
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-12 pt-4 px-4 sm:px-6">
      {/* Header Section */}
      <div className="flex flex-col gap-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="mb-2 -ml-3 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-500 border-green-500/20 px-2.5 py-0.5 pointer-events-none"
              >
                Active
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground text-sm max-w-2xl">
                {project.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <a
                href={project.github_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
              >
                <Github className="w-4 h-4" />
                <span className="underline decoration-transparent group-hover:decoration-foreground transition-colors">
                  {project.repoName}
                </span>
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
              <a
                href={formatVisitUrl(project.primary_domain)}
                target="_blank"
                rel="noreferrer"
              >
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
              <span className="text-xs font-medium text-neutral-500">
                Preview Available
              </span>
              <div className="absolute inset-x-0 bottom-0 p-2.5 bg-linear-to-t from-black/90 to-transparent z-10 flex border-t border-neutral-800/50">
                <p className="text-[11px] text-neutral-400 truncate font-mono">
                  {project.primary_domain || "No domain linked"}
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Domains
                </span>
                <a
                  href={formatVisitUrl(project.primary_domain)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline text-foreground flex items-center gap-1.5 group"
                >
                  {project.primary_domain || "Not configured"}
                  {project.primary_domain && (
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </a>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Branch
                </span>
                <div className="text-sm font-mono flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                  {project.build_branch}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Created At
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(project.created_at).toLocaleDateString()} at{" "}
                  {new Date(project.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Details */}
        <Card className="col-span-1 bg-background border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              Build Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Framework
              </span>
              <div className="text-sm font-medium flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-[9px]">
                  {project.name ? project.name.charAt(0).toUpperCase() : "N"}
                </div>
                Auto-detected
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground">
                Build Command
              </span>
              <div className="bg-neutral-900/70 text-neutral-300 font-mono text-xs p-2.5 rounded-md border border-neutral-800 flex items-center gap-2 overflow-x-auto">
                <Terminal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                {project.build_cmd || "npm run build"}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground">
                Output Directory
              </span>
              <div className="bg-neutral-900/70 text-neutral-300 font-mono text-xs p-2.5 rounded-md border border-neutral-800 flex items-center gap-2 overflow-x-auto">
                <Terminal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                {project.output_dir || "dist"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Domains */}
        <Card className="col-span-1 md:col-span-3 bg-background border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Domains</CardTitle>
            <CardDescription>
              Manage your default project URL and attach custom domains.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                CURRENT DOMAIN URL
              </span>
              {project.primary_domain ? (
                <a
                  href={formatVisitUrl(project.primary_domain)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-mono text-foreground hover:underline inline-flex items-center gap-1.5 w-fit"
                >
                  {project.primary_domain}.dev.blitznative.com
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not configured
                </span>
              )}
            </div>

            <form
              onSubmit={handleAddCustomDomain}
              className="flex flex-col gap-3 border-t border-border pt-4"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="custom-domain-input"
                  className="text-xs font-medium text-muted-foreground"
                >
                  ADD CUSTOM DOMAIN
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="custom-domain-input"
                    value={customDomain}
                    onChange={(e) => {
                      setCustomDomain(e.target.value);
                      if (domainError) setDomainError(null);
                      if (domainMessage) setDomainMessage(null);
                    }}
                    placeholder="example.com"
                    className="h-9 border-border bg-neutral-900/50 font-mono text-sm"
                  />
                  <Button
                    type="submit"
                    disabled={isAddingDomain || !customDomain.trim()}
                    className="h-9 whitespace-nowrap"
                  >
                    {isAddingDomain ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {isAddingDomain ? "Adding..." : "Add Domain"}
                  </Button>
                </div>
              </div>
              {domainMessage && (
                <p className="text-sm text-green-500">{domainMessage}</p>
              )}
              {domainError && (
                <p className="text-sm text-red-500">{domainError}</p>
              )}
            </form>

            <div className="border-t border-border pt-6 mt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  CUSTOM DOMAINS
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={fetchCustomDomains}
                  disabled={isLoadingCustomDomains}
                >
                  {isLoadingCustomDomains ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>

              {isLoadingCustomDomains ? (
                <div className="text-sm text-muted-foreground">
                  Loading custom domains...
                </div>
              ) : customDomains.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No custom domains added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {customDomains.map((domainItem) => (
                    <div
                      key={domainItem.id}
                      className="rounded-xl border border-border p-5 bg-neutral-900/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <a
                          href={formatVisitUrl(domainItem.domain)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-mono text-foreground hover:underline inline-flex items-center gap-1.5 w-fit"
                        >
                          {domainItem.domain}
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>
                        <Badge
                          variant="outline"
                          className={`${statusBadgeStyles[domainItem.status]} pointer-events-none`}
                        >
                          {domainItem.status}
                        </Badge>
                      </div>

                      {domainItem.status === "PENDING" && (
                        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-5">
                          <p className="text-xs text-yellow-500 font-medium mb-3">
                            DNS configuration required — point your domain to CloudFront
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="text-muted-foreground">TYPE</div>
                            <div className="text-muted-foreground">NAME</div>
                            <div className="text-muted-foreground">VALUE</div>

                            <div className="font-mono text-foreground">CNAME</div>
                            <div className="font-mono text-foreground break-all flex items-start gap-2">
                              <span className="break-all flex-1">
                                {domainItem.domain}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  handleCopy(
                                    domainItem.domain,
                                    `${domainItem.id}-name`,
                                  )
                                }
                              >
                                {copiedValue === `${domainItem.id}-name` ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                            <div className="font-mono text-foreground break-all flex items-start gap-2">
                              <span className="break-all flex-1">
                                {process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "your-distribution.cloudfront.net"}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  handleCopy(
                                    process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "your-distribution.cloudfront.net",
                                    `${domainItem.id}-value`,
                                  )
                                }
                              >
                                {copiedValue === `${domainItem.id}-value` ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-3">
                            Once DNS propagates, CloudFront will automatically issue and attach the SSL certificate.
                          </p>
                        </div>
                      )}

                      {domainItem.status === "ACTIVE" && (
                        <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <p className="text-xs text-green-500 font-medium">
                            Domain is active and serving traffic with SSL
                          </p>
                        </div>
                      )}

                      {domainItem.status === "FAILED" && (
                        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <p className="text-xs text-red-500 font-medium">
                            Domain setup failed. Please remove and try again.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables & Details */}
        <Card className="col-span-1 md:col-span-3 bg-background border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg font-semibold">
                Environment Variables
              </CardTitle>
              <CardDescription>
                Variables applied to the environments for this project.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              Manage
            </Button>
          </CardHeader>
          <CardContent>
            {project.project_env &&
            Object.keys(project.project_env).length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 bg-neutral-900/80 p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  <div>KEY</div>
                  <div>VALUE</div>
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(project.project_env).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-2 p-3 text-sm hover:bg-neutral-900/30 transition-colors"
                    >
                      <div className="font-mono text-foreground truncate pr-4">
                        {key}
                      </div>
                      <div className="font-mono text-muted-foreground truncate">
                        {value as string}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-lg bg-neutral-900/20">
                <p className="text-sm text-muted-foreground">
                  No environment variables configured.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deployments History */}
        <Card className="col-span-1 md:col-span-3 bg-background border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg font-semibold">
                Deployments
              </CardTitle>
              <CardDescription>
                Recent deployment history for this project.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {project.deployments && project.deployments.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-neutral-900/80 p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  <div className="col-span-3 md:col-span-3">STATUS</div>
                  <div className="col-span-4 md:col-span-3">PREVIEW URL</div>
                  <div className="hidden md:block md:col-span-3">BRANCH</div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    DATE
                  </div>
                  <div className="col-span-2 md:col-span-1 text-right">
                    ACTIONS
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {[...(project.deployments ?? [])]
                    .reverse()
                    .map((deployment: Deployment) => (
                      <div
                        key={deployment.deployment_id}
                        className="grid grid-cols-12 p-3 text-sm hover:bg-neutral-900/30 transition-colors items-center"
                      >
                        <div className="col-span-3 md:col-span-3 flex items-center gap-2">
                          {deployment.is_build_success === true ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              <span className="text-foreground mr-1">Ready</span>
                              {deployment.is_production && (
                                <Badge 
                                  variant="outline" 
                                  className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-1.5 py-0 h-[18px] text-[10px] pointer-events-none shrink-0"
                                >
                                  Prod
                                </Badge>
                              )}
                            </>
                          ) : deployment.is_build_success === false ? (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-foreground">Failed</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-yellow-500" />
                              <span className="text-foreground">Building</span>
                            </>
                          )}
                        </div>
                        <div className="col-span-4 md:col-span-3 font-mono text-muted-foreground truncate pr-4">
                          {deployment.preview_url ? (
                            <a
                              href={formatVisitUrl(deployment.preview_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-foreground transition-colors hover:underline flex items-center gap-1.5"
                            >
                              <span className="truncate">
                                {deployment.preview_url}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                            </a>
                          ) : (
                            <span className="opacity-50">-</span>
                          )}
                        </div>
                        <div className="hidden md:flex md:col-span-3 font-mono text-muted-foreground items-center gap-1.5 truncate">
                          <GitBranch className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {project.build_branch || "main"}
                          </span>
                        </div>
                        <div className="col-span-3 md:col-span-2 text-muted-foreground text-right truncate text-xs flex items-center justify-end">
                          {new Date(deployment.created_at).toLocaleDateString()}
                        </div>
                        <div className=" md:col-span-1 flex items-center justify-end gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
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
                                {deployment.build_logs ||
                                  "No build logs available."}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={isMarkingProduction === deployment.deployment_id}
                              >
                                {isMarkingProduction === deployment.deployment_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-300">
                              <DropdownMenuItem
                                className="cursor-pointer text-sm focus:bg-neutral-900 focus:text-white"
                                onClick={() => handleMarkProduction(deployment.deployment_id)}
                                disabled={isMarkingProduction === deployment.deployment_id || !deployment.is_build_success}
                              >
                                {isMarkingProduction === deployment.deployment_id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Globe className="w-4 h-4 mr-2" />
                                )}
                                Mark as Production
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-lg bg-neutral-900/20">
                <p className="text-sm text-muted-foreground">
                  No deployment history available.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="col-span-1 md:col-span-3 bg-background border-red-500/30 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Deleting this project is permanent and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-red-500/20 pt-4">
            <div className="text-sm text-muted-foreground">
              Delete{" "}
              <span className="font-semibold text-foreground">
                {project.name}
              </span>{" "}
              and all its deployment history.
            </div>
            <Dialog
              open={isDeleteModalOpen}
              onOpenChange={(open) => {
                setIsDeleteModalOpen(open);
                if (!open) {
                  setDeleteConfirmName("");
                  setDeleteConfirmPhrase("");
                  setDeleteError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" className="h-9 whitespace-nowrap">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl bg-[#0a0a0a] border-neutral-800 p-0 overflow-hidden sm:rounded-2xl">
                <div className="p-6">
                  <DialogHeader className="gap-4">
                    <DialogTitle className="text-2xl font-bold text-white">
                      Delete Project
                    </DialogTitle>
                    <DialogDescription className="text-neutral-300 text-[15px] leading-relaxed">
                      This will permanently delete the project and related
                      resources like Deployments, Domains and Environment
                      Variables.
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="border-t border-neutral-800 p-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-2.5">
                    <label
                      htmlFor="delete-project-confirm-name"
                      className="text-[15px] text-neutral-200"
                    >
                      To confirm, type{" "}
                      <span className="font-semibold">
                        &ldquo;{project.name}&rdquo;
                      </span>
                    </label>
                    <Input
                      id="delete-project-confirm-name"
                      value={deleteConfirmName}
                      onChange={(e) => {
                        setDeleteConfirmName(e.target.value);
                        if (deleteError) setDeleteError(null);
                      }}
                      className="h-11 border-neutral-800 bg-black text-white text-[15px] focus-visible:ring-1 focus-visible:ring-neutral-700 rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <label
                      htmlFor="delete-project-confirm-phrase"
                      className="text-[15px] text-neutral-200"
                    >
                      To confirm, type{" "}
                      <span className="font-semibold">
                        &ldquo;delete my project&rdquo;
                      </span>
                    </label>
                    <Input
                      id="delete-project-confirm-phrase"
                      value={deleteConfirmPhrase}
                      onChange={(e) => {
                        setDeleteConfirmPhrase(e.target.value);
                        if (deleteError) setDeleteError(null);
                      }}
                      className="h-11 border-neutral-800 bg-black text-white text-[15px] focus-visible:ring-1 focus-visible:ring-neutral-700 rounded-lg"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-800 p-6">
                  <div className="bg-[#291415] border border-[#5c1c24] rounded-lg p-4 flex items-center gap-3 text-[#ff4d4d]">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-[15px]">
                      Deleting {project.name} cannot be undone.
                    </p>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-500 mt-4">{deleteError}</p>
                  )}
                </div>

                <div className="border-t border-neutral-800 p-4 sm:px-6 flex items-center justify-between bg-[#0a0a0a]">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-neutral-700 hover:bg-neutral-800 hover:text-white bg-transparent h-10 px-5 text-[15px] rounded-lg"
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDeleteConfirmName("");
                      setDeleteConfirmPhrase("");
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-10 px-5 bg-[#e5484d] hover:bg-[#c93f44] text-white text-[15px] font-medium border-0 rounded-lg"
                    disabled={!canDeleteProject || isDeletingProject}
                    onClick={handleDeleteProject}
                  >
                    {isDeletingProject && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {isDeletingProject ? "Deleting..." : "Delete Project"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
