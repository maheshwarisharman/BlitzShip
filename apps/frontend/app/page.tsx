import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, GitBranch, GitCommitHorizontal } from "lucide-react";
import { BoltMark, Wordmark } from "@/components/landing/logo";
import { HeroVisual } from "@/components/landing/hero-visual";
import { DomainPlayground } from "@/components/landing/domain-playground";
import { Reveal } from "@/components/landing/reveal";

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Domains", href: "#domains" },
  { label: "Platform", href: "#platform" },
];

const TICKER = ["git push", "clone", "install", "build", "upload", "live"];

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.18em] text-white/45";

export default function Home() {
  return (
    <div className="min-h-screen bg-ink p-3 text-foreground selection:bg-bolt selection:text-white sm:p-4">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3">
        {/* ───────────────────────── header ───────────────────────── */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="flex h-16 items-center justify-between rounded-2xl border border-line bg-panel px-5">
            <Link href="/" aria-label="BlitzShip home">
              <Wordmark />
            </Link>
          </div>

          <div className="flex h-16 items-center justify-end gap-2 rounded-2xl border border-line bg-panel-2 px-3 lg:justify-between lg:px-4">
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-lg bg-white px-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-bolt hover:text-white"
            >
              Login / Sign in
            </Link>
          </div>
        </header>

        {/* ───────────────────────── hero ───────────────────────── */}
        <section className="grid gap-3 lg:h-[calc(100svh-6.5rem)] lg:min-h-[700px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="flex flex-col rounded-2xl border border-line bg-panel">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center sm:px-10">
              <div className="flex gap-1.5 animate-rise">
                <span className="size-2 bg-white" />
                <span className="size-2 bg-white" />
                <span className="size-2 bg-bolt" />
              </div>

              <h1
                className="mt-8 font-mono text-[clamp(2.2rem,4.6vw,3.9rem)] font-normal uppercase leading-[1.04] tracking-tight animate-rise"
                style={{ animationDelay: "80ms" }}
              >
                From git push
                <span className="block py-1 font-serif text-[1.3em] normal-case italic leading-[0.95] tracking-normal text-bolt-soft">
                  to live site
                </span>
                in a blitz
              </h1>

              <p
                className="mt-8 max-w-md text-[15px] leading-relaxed text-white/60 animate-rise"
                style={{ animationDelay: "180ms" }}
              >
                Connect your GitHub account, pick a repo, and BlitzShip builds and ships your React app. Live on{" "}
                <span className="font-mono text-[13px] text-white">yourname.blitzship.app</span>, or on your own
                domain with SSL taken care of.
              </p>

              <div
                className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-rise"
                style={{ animationDelay: "280ms" }}
              >
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center gap-2 rounded-lg bg-bolt px-6 font-mono text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-white hover:text-ink"
                >
                  Start deploying
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-lg border border-white/15 px-6 font-mono text-xs uppercase tracking-[0.14em] text-white/80 transition-colors hover:border-white hover:text-white"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="border-t border-line px-6 py-5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                Ships anything that builds to static files
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/30">
                <span className="text-lg font-semibold tracking-tight">React</span>
                <span className="font-display text-lg font-bold uppercase tracking-[0.2em]">Vite</span>
                <span className="font-mono text-base">TypeScript</span>
                <span className="font-serif text-xl italic">Tailwind</span>
                <span className="text-lg font-medium tracking-tighter">shadcn/ui</span>
              </div>
            </div>
          </div>

          <HeroVisual />
        </section>

        {/* ───────────────────────── ticker ───────────────────────── */}
        <div className="overflow-hidden rounded-2xl bg-bolt py-4 text-ink" aria-hidden>
          <div className="flex w-max animate-marquee whitespace-nowrap font-mono text-sm font-medium uppercase tracking-[0.2em]">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center">
                {Array.from({ length: 3 }).flatMap((_, rep) =>
                  TICKER.map((word, i) => (
                    <span key={`${rep}-${i}`} className="flex items-center">
                      <span className="px-6">{word}</span>
                      {i === TICKER.length - 1 ? (
                        <BoltMark className="size-4 text-ink" />
                      ) : (
                        <ArrowRight className="size-4 opacity-60" />
                      )}
                    </span>
                  )),
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ───────────────────────── how it works ───────────────────────── */}
        <section id="how" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-5 sm:p-8 lg:p-12">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className={eyebrow}>/01 — How it works</p>
                <h2 className="mt-4 max-w-2xl font-mono text-[clamp(1.9rem,3.8vw,3.2rem)] uppercase leading-[1.05] tracking-tight">
                  Three steps.
                  <br />
                  <span className="font-serif text-[1.25em] normal-case italic text-bolt-soft">zero</span> yak shaving.
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-relaxed text-white/55">
                No Dockerfiles to write, no pipelines to babysit. If your project builds locally, it builds on
                BlitzShip.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-3 lg:grid-cols-3">
            {/* 01 */}
            <Reveal>
              <article className="flex h-full flex-col rounded-xl border border-line bg-panel-2 p-5 transition-colors hover:border-bolt/60">
                <span className="font-serif text-5xl italic text-bolt">01</span>
                <h3 className="mt-6 font-mono text-sm uppercase tracking-[0.14em]">Connect GitHub</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Install the BlitzShip GitHub app once and choose which repositories we can see.
                </p>
                <div className="mt-8 space-y-1.5 rounded-lg border border-line bg-ink p-2 font-mono text-xs">
                  {[
                    ["acme/storefront", true],
                    ["acme/dashboard-ui", false],
                    ["you/portfolio", false],
                  ].map(([repo, on]) => (
                    <div
                      key={repo as string}
                      className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                        on ? "bg-bolt/15 text-white" : "text-white/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <GitBranch className="size-3.5" />
                        {repo as string}
                      </span>
                      {on ? (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-bolt-soft">
                          <Check className="size-3" strokeWidth={3} /> Connected
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">Import</span>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>

            {/* 02 */}
            <Reveal delay={90}>
              <article className="flex h-full flex-col rounded-xl border border-line bg-panel-2 p-5 transition-colors hover:border-bolt/60">
                <span className="font-serif text-5xl italic text-bolt">02</span>
                <h3 className="mt-6 font-mono text-sm uppercase tracking-[0.14em]">Tune the build</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Set your build command and output folder, and add environment variables in the built-in editor.
                </p>
                <div className="mt-8 divide-y divide-line rounded-lg border border-line bg-ink font-mono text-xs">
                  {[
                    ["Build command", "npm run build"],
                    ["Output directory", "dist"],
                    ["VITE_API_URL", "••••••••••"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="text-white/40">{k}</span>
                      <span className="rounded bg-white/[0.06] px-2 py-1 text-white/85">{v}</span>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>

            {/* 03 */}
            <Reveal delay={180}>
              <article className="flex h-full flex-col rounded-xl border border-line bg-panel-2 p-5 transition-colors hover:border-bolt/60">
                <span className="font-serif text-5xl italic text-bolt">03</span>
                <h3 className="mt-6 font-mono text-sm uppercase tracking-[0.14em]">Ship it</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Hit deploy. Watch the logs stream by. Your site goes live and stays in sync with every push.
                </p>
                <div className="mt-8 rounded-lg border border-line bg-ink p-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full rounded-full bg-bolt animate-pulse-ring" />
                        <span className="relative inline-flex size-2 rounded-full bg-bolt" />
                      </span>
                      Ready
                    </span>
                    <span className="text-white/35">8.1s build</span>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-bolt-soft">
                    acme.blitzship.app <ArrowUpRight className="size-3" />
                  </p>
                  <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-white/45">
                    <GitCommitHorizontal className="size-3.5" />
                    <span className="text-white/70">a41f9c2</span> fix cart total
                  </p>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── domains ───────────────────────── */}
        <section id="domains" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-5 sm:p-8 lg:p-12">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className={eyebrow}>/02 — Domains</p>
                <h2 className="mt-4 font-mono text-[clamp(1.9rem,3.8vw,3.2rem)] uppercase leading-[1.05] tracking-tight">
                  Your name.
                  <br />
                  <span className="font-serif text-[1.25em] normal-case italic text-bolt-soft">or yours.</span>
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-relaxed text-white/55">
                Launch on a free <span className="font-mono text-[13px] text-white">name.blitzship.app</span>{" "}
                address in seconds, then bring your own domain whenever you are ready. Try it below.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <DomainPlayground />
          </Reveal>
        </section>

        {/* ───────────────────────── platform ───────────────────────── */}
        <section id="platform" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-5 sm:p-8 lg:p-12">
          <Reveal>
            <p className={eyebrow}>/03 — Platform</p>
            <h2 className="mt-4 font-mono text-[clamp(1.9rem,3.8vw,3.2rem)] uppercase leading-[1.05] tracking-tight">
              Boring infra.
              <br />
              <span className="font-serif text-[1.25em] normal-case italic text-bolt-soft">Exciting</span> results.
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-3 md:grid-cols-6">
            {/* isolated builds */}
            <Reveal className="md:col-span-3">
              <article className="h-full rounded-xl border border-line bg-panel-2 p-6 transition-colors hover:border-bolt/60">
                <p className={eyebrow}>Isolated builds</p>
                <h3 className="mt-3 text-2xl tracking-tight">
                  Every build gets its own <span className="font-serif italic text-bolt-soft">container.</span>
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                  Your code is built inside a fresh Docker container that is thrown away the moment it finishes.
                  Nothing leaks between projects.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                  {[
                    ["build-a41f", "running", true],
                    ["build-77c2", "removed", false],
                    ["build-e09b", "removed", false],
                  ].map(([id, state, live]) => (
                    <div
                      key={id as string}
                      className={`rounded-lg border p-3 ${
                        live ? "border-bolt bg-bolt/10 text-white" : "border-line bg-ink text-white/30"
                      }`}
                    >
                      <div className="mb-5 flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${live ? "bg-bolt" : "bg-white/20"}`} />
                        <span>{state as string}</span>
                      </div>
                      <span className={live ? "" : "line-through"}>{id as string}</span>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>

            {/* build logs */}
            <Reveal delay={90} className="md:col-span-3">
              <article className="h-full rounded-xl border border-line bg-panel-2 p-6 transition-colors hover:border-bolt/60">
                <p className={eyebrow}>Build logs</p>
                <h3 className="mt-3 text-2xl tracking-tight">
                  Every line, <span className="font-serif italic text-bolt-soft">saved.</span>
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                  Full build output for every deployment, so when something breaks you can see exactly where and why.
                </p>
                <div className="mt-8 rounded-lg border border-line bg-ink p-4 font-mono text-[11px] leading-6 text-white/55">
                  <p><span className="text-white/25">01</span> &nbsp;added 312 packages in 12s</p>
                  <p><span className="text-white/25">02</span> &nbsp;vite v5 building for production…</p>
                  <p><span className="text-white/25">03</span> &nbsp;✓ 148 modules transformed</p>
                  <p><span className="text-white/25">04</span> &nbsp;<span className="text-bolt-soft">dist/index.html  0.46 kB</span></p>
                  <p><span className="text-white/25">05</span> &nbsp;<span className="text-white">✓ built in 8.1s</span></p>
                </div>
              </article>
            </Reveal>

            {/* push to deploy */}
            <Reveal className="md:col-span-2">
              <article className="h-full rounded-xl border border-line bg-panel-2 p-6 transition-colors hover:border-bolt/60">
                <p className={eyebrow}>Push to deploy</p>
                <h3 className="mt-3 text-xl tracking-tight">Commit. Done.</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  A GitHub webhook kicks off a new deployment on every push. No buttons required.
                </p>
                <div className="mt-8 flex items-center">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center">
                      <span
                        className={`size-3 rounded-full border-2 ${
                          n === 4 ? "border-bolt bg-bolt" : "border-white/30 bg-transparent"
                        }`}
                      />
                      {n < 4 && <span className="h-px w-8 bg-white/20 sm:w-10" />}
                    </div>
                  ))}
                  <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bolt-soft">new</span>
                </div>
              </article>
            </Reveal>

            {/* env */}
            <Reveal delay={90} className="md:col-span-2">
              <article className="h-full rounded-xl border border-line bg-panel-2 p-6 transition-colors hover:border-bolt/60">
                <p className={eyebrow}>Environment</p>
                <h3 className="mt-3 text-xl tracking-tight">Secrets, sorted.</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Edit environment variables right in the dashboard. They are baked into your next build.
                </p>
                <div className="mt-8 space-y-1 rounded-lg border border-line bg-ink p-3 font-mono text-[11px] text-white/55">
                  <p>VITE_API_URL=<span className="text-white/25">••••••••</span></p>
                  <p>VITE_STRIPE_KEY=<span className="text-white/25">••••••••</span></p>
                </div>
              </article>
            </Reveal>

            {/* edge */}
            <Reveal delay={180} className="md:col-span-2">
              <article className="h-full rounded-xl border border-line bg-panel-2 p-6 transition-colors hover:border-bolt/60">
                <p className={eyebrow}>Delivery</p>
                <h3 className="mt-3 text-xl tracking-tight">Served from the edge.</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Build output lands on S3 and is delivered worldwide through a CDN, over HTTPS.
                </p>
                <div className="mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                  <span className="rounded-md border border-line bg-ink px-2.5 py-1.5 text-white/60">S3</span>
                  <span className="h-px flex-1 bg-white/20" />
                  <span className="rounded-md bg-bolt px-2.5 py-1.5 text-white">CDN</span>
                  <span className="h-px flex-1 bg-white/20" />
                  <span className="rounded-md border border-line bg-ink px-2.5 py-1.5 text-white/60">You</span>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── final CTA ───────────────────────── */}
        <Reveal>
          <section className="relative overflow-hidden rounded-2xl bg-bolt px-6 py-16 text-ink sm:px-12 sm:py-24">
            <BoltMark className="pointer-events-none absolute -right-10 -top-10 size-[420px] rotate-6 text-[#2459d6] sm:-right-4 sm:size-[560px]" />
            <div className="relative max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">/04 — Your turn</p>
              <h2 className="mt-5 font-mono text-[clamp(2.4rem,6.4vw,5.6rem)] uppercase leading-[0.98] tracking-tight">
                Ship your
                <span className="block py-1 font-serif text-[1.25em] normal-case italic leading-[0.95] text-white">
                  first deploy
                </span>
                today
              </h2>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-lg bg-ink px-7 py-4 font-mono text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-white hover:text-ink"
                >
                  Start deploying
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-lg border border-ink/40 px-7 py-4 font-mono text-xs uppercase tracking-[0.14em] transition-colors hover:border-ink hover:bg-ink hover:text-white"
                >
                  I have an account
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ───────────────────────── footer ───────────────────────── */}
        <footer className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 pt-8 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Wordmark />
            <nav className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="transition-colors hover:text-white">
                  {item.label}
                </a>
              ))}
              <Link href="/login" className="transition-colors hover:text-white">
                Sign in
              </Link>
            </nav>
          </div>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
            &copy; {new Date().getFullYear()} BlitzShip. All rights reserved.
          </p>
          <div
            aria-hidden
            className="pointer-events-none -mb-[0.2em] mt-2 select-none text-center font-display text-[clamp(4rem,19vw,16rem)] font-bold leading-[0.85] tracking-tighter text-white/[0.045]"
          >
            blitzship
          </div>
        </footer>
      </div>
    </div>
  );
}
