"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";

type Mode = "platform" | "custom";

const cleanName = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "")
    .slice(0, 24);

const cleanDomain = (v: string) =>
  v
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, 40);

const PIPELINE = ["DNS records added", "SSL certificate issued", "Live on your domain"];

export function DomainPlayground() {
  const [mode, setMode] = useState<Mode>("platform");
  const [name, setName] = useState("acme");
  const [domain, setDomain] = useState("acme.com");
  const [step, setStep] = useState(0);

  // Cycle the custom-domain pipeline so people can see the whole journey.
  useEffect(() => {
    if (mode !== "custom") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(PIPELINE.length);
      return;
    }
    setStep(0);
    let n = 0;
    const id = setInterval(() => {
      n = n >= PIPELINE.length + 1 ? 0 : n + 1;
      setStep(n);
    }, 1500);
    return () => clearInterval(id);
  }, [mode]);

  const shownName = name || "yourname";
  const shownDomain = domain || "yourbrand.com";
  const host = mode === "platform" ? `${shownName}.blitzship.app` : shownDomain;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
      {/* controls */}
      <div className="flex flex-col rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <div className="inline-flex w-fit rounded-lg border border-line bg-ink p-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          {(
            [
              ["platform", "blitzship.app"],
              ["custom", "Custom domain"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-md px-3.5 py-2 transition-colors ${
                mode === key ? "bg-bolt text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <label
            htmlFor="domain-input"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40"
          >
            {mode === "platform" ? "Pick your name" : "Your domain"}
          </label>

          {mode === "platform" ? (
            <div className="mt-2 flex items-center rounded-xl border border-white/15 bg-ink font-mono text-lg focus-within:border-bolt">
              <input
                id="domain-input"
                value={name}
                onChange={(e) => setName(cleanName(e.target.value))}
                placeholder="yourname"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-white outline-none placeholder:text-white/25"
              />
              <span className="pr-4 text-white/40">.blitzship.app</span>
            </div>
          ) : (
            <div className="mt-2 flex items-center rounded-xl border border-white/15 bg-ink font-mono text-lg focus-within:border-bolt">
              <span className="pl-4 text-white/40">https://</span>
              <input
                id="domain-input"
                value={domain}
                onChange={(e) => setDomain(cleanDomain(e.target.value))}
                placeholder="yourbrand.com"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent py-3.5 pl-1 pr-4 text-white outline-none placeholder:text-white/25"
              />
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-white/50">
            {mode === "platform"
              ? "Every project gets a free subdomain on our platform. Pick a name, and it is yours the moment your first build lands."
              : "Already own a domain? Add it to your project, drop two CNAME records at your registrar, and we handle the SSL certificate and the routing."}
          </p>
        </div>

        {/* pipeline / perks */}
        <div className="mt-auto pt-8">
          {mode === "custom" ? (
            <ol className="space-y-2.5">
              {PIPELINE.map((label, i) => {
                const done = step > i;
                const active = step === i;
                return (
                  <li key={label} className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.12em]">
                    <span
                      className={`grid size-5 place-items-center rounded-full border transition-colors ${
                        done
                          ? "border-bolt bg-bolt text-white"
                          : active
                            ? "border-bolt-soft text-bolt-soft"
                            : "border-white/15 text-transparent"
                      }`}
                    >
                      {done ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <span className={done ? "text-white" : active ? "text-bolt-soft" : "text-white/35"}>{label}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <ul className="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
              {["Free forever", "HTTPS included", "Instant routing", "No DNS needed"].map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="size-3.5 text-bolt" strokeWidth={3} /> {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* browser preview */}
      <div className="flex flex-col rounded-2xl border border-line bg-panel-2 p-3 sm:p-4">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-md bg-white/[0.05] px-3 py-1.5 font-mono text-xs text-white/80">
            <Lock className="size-3 shrink-0 text-bolt" />
            <span className="truncate">
              https://<span className="text-white">{host}</span>
            </span>
          </div>
        </div>

        <div className="relative mt-3 flex-1 overflow-hidden rounded-lg border border-line bg-ink p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-semibold tracking-tight">
              {(mode === "platform" ? shownName : shownDomain.split(".")[0] || "brand")}
              <span className="text-bolt">.</span>
            </span>
            <div className="hidden gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35 sm:flex">
              <span>Work</span>
              <span>About</span>
              <span>Contact</span>
            </div>
          </div>
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-bolt-soft">
            {mode === "platform" ? "Deployed on BlitzShip" : "Your domain · our infrastructure"}
          </p>
          <h4 className="mt-3 max-w-xs text-4xl leading-[1.02] tracking-tight sm:text-5xl">
            Hello,
            <br />
            <span className="font-serif italic">world.</span>
          </h4>
          <div className="mt-8 flex gap-2">
            <span className="h-9 w-28 rounded-md bg-bolt" />
            <span className="h-9 w-20 rounded-md border border-white/15" />
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2">
            <span className="h-14 rounded-md bg-white/[0.05]" />
            <span className="h-14 rounded-md bg-white/[0.05]" />
            <span className="h-14 rounded-md bg-white/[0.05]" />
          </div>

          {/* live ping */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-bolt animate-pulse-ring" />
              <span className="relative inline-flex size-2 rounded-full bg-bolt" />
            </span>
            {mode === "custom" && step < PIPELINE.length ? "Waiting for DNS" : "Live"}
          </div>
        </div>

        {mode === "custom" && (
          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-ink font-mono text-[11px]">
            {[
              ["CNAME", `_acm.${shownDomain}`, "…acm-validations.aws", "SSL validation"],
              ["CNAME", shownDomain, "…cloudfront.net", "Route traffic"],
            ].map(([type, hostname, value, purpose], i) => (
              <div
                key={purpose}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 ${
                  i === 0 ? "border-b border-line" : ""
                }`}
              >
                <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-bolt-soft">{type}</span>
                <span className="truncate text-white/80">
                  {hostname} <span className="text-white/30">→</span> <span className="text-white/50">{value}</span>
                </span>
                <span className="hidden text-[10px] uppercase tracking-[0.12em] text-white/35 sm:block">{purpose}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
