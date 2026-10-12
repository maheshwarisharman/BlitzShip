"use client"

import Link from "next/link"
import { useRef, type CSSProperties, type MouseEvent } from "react"
import { ArrowUpRight, FolderOutput, GitBranch, Github, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Project {
  project_id: number
  name: string
  description: string
  user_id: string
  created_at: string
  github_url: string
  repoId: string
  build_cmd: string
  output_dir: string
  repoName: string
  build_branch: string
  primary_domain: string
  production_deployment_id: number | null
}

const ROOT_DOMAIN = "blitzship.app"

/** Deterministic hue (0-359) so every project keeps its own colour identity. */
function hueFromString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 360
  }
  return hash
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ]
  for (const [secs, label] of units) {
    if (diff >= secs) return `${Math.floor(diff / secs)}${label} ago`
  }
  return "just now"
}

export function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  const ref = useRef<HTMLElement>(null)
  const hue = hueFromString(project.name)
  const isLive = project.production_deployment_id != null
  const owner = project.repoName?.split("/")[0] ?? ""
  const siteUrl = `https://${project.primary_domain}.${ROOT_DOMAIN}`

  // Feeds the cursor-following spotlight (see the overlay div below).
  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }

  const accent = (l: number, a = 1) => `hsl(${hue} 85% ${l}% / ${a})`

  return (
    <article
      ref={ref}
      onMouseMove={handleMouseMove}
      style={
        {
          animationDelay: `${index * 70}ms`,
          "--accent-glow": accent(60, 0.16),
        } as CSSProperties
      }
      className={cn(
        "group relative isolate flex flex-col overflow-hidden rounded-[28px] p-5",
        "bg-card ring-1 ring-white/[0.06] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_40px_-24px_rgba(0,0,0,0.8)]",
        "transition-all duration-300 hover:-translate-y-1 hover:ring-white/15",
        "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-backwards"
      )}
    >
      {/* Per-project colour wash, top-left */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full blur-3xl transition-opacity duration-500 opacity-70 group-hover:opacity-100"
        style={{ background: "var(--accent-glow)" }}
      />
      {/* Cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,0.07), transparent 70%)",
        }}
      />

      {/* Header: logo tile + visit pill */}
      <div className="flex items-start justify-between">
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold uppercase text-white shadow-lg ring-1 ring-white/20 font-display"
          style={{
            background: `linear-gradient(140deg, ${accent(62)}, hsl(${(hue + 55) % 360} 80% 45%))`,
            boxShadow: `0 8px 24px -8px ${accent(55, 0.7)}`,
          }}
        >
          {project.name.charAt(0)}
          {isLive && (
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </span>
          )}
        </div>

        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${project.name}`}
          className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-foreground"
        >
          Visit
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Meta + title */}
      <div className="mt-6 flex items-center gap-2 text-[13px]">
        <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground/90">{owner}</span>
        <span className="shrink-0 text-muted-foreground/70">{timeAgo(project.created_at)}</span>
      </div>

      <h3 className="mt-2 truncate font-display text-[26px] font-semibold leading-tight tracking-tight">
        {project.name}
      </h3>

      {project.description && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      )}

      {/* Chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>
          <GitBranch className="h-3 w-3" />
          <span className="font-mono">{project.build_branch}</span>
        </Chip>
        <Chip>
          <Terminal className="h-3 w-3" />
          <span className="font-mono">{project.build_cmd}</span>
        </Chip>
        <Chip>
          <FolderOutput className="h-3 w-3" />
          <span className="font-mono">/{project.output_dir}</span>
        </Chip>
      </div>

      {/* Spacer keeps footers aligned across cards of different heights */}
      <div className="min-h-8 flex-1" />

      {/* Footer */}
      <div className="mt-2 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-tight">
            <span className="font-semibold">{project.primary_domain}</span>
            <span className="text-muted-foreground">.{ROOT_DOMAIN}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isLive ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            {isLive ? `Production · #${project.production_deployment_id}` : "No production deploy"}
          </p>
        </div>

        {/* Stretched link: the whole card navigates to the project page */}
        <Link
          href={`/project/${project.project_id}`}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-all after:absolute after:inset-0 after:content-[''] hover:gap-2.5 hover:bg-white"
        >
          Open
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-foreground/80">
      {children}
    </span>
  )
}

export function ProjectCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className="flex min-h-[300px] flex-col rounded-[28px] bg-card p-5 ring-1 ring-white/[0.06] animate-in fade-in duration-500 fill-mode-backwards"
    >
      <div className="flex items-start justify-between">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/[0.07]" />
        <div className="h-8 w-16 animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
      <div className="mt-6 h-4 w-36 animate-pulse rounded bg-white/[0.05]" />
      <div className="mt-3 h-7 w-48 animate-pulse rounded bg-white/[0.08]" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="h-6 w-14 animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
      <div className="flex-1" />
      <div className="mt-6 flex items-end justify-between border-t border-white/[0.07] pt-4">
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="h-10 w-20 animate-pulse rounded-xl bg-white/[0.08]" />
      </div>
    </div>
  )
}
