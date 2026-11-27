"use client";

import { useEffect, useState } from "react";
import { BoltMark } from "@/components/landing/logo";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";
import { cn } from "@/lib/utils";

const LINES = [
  "Confirming your session",
  "Syncing your workspace",
  "Loading deployments",
] as const;

/** Creeps toward the end and holds, so the bar never sits at 100% before navigation. */
const STOPS = [16, 42, 68, 86, 94] as const;

export function SessionHandoff() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setStep((current) => (current >= STOPS.length - 1 ? current : current + 1));
    }, 620);
    return () => window.clearInterval(id);
  }, [reduce]);

  const progress = reduce ? 100 : STOPS[Math.min(step, STOPS.length - 1)];
  const line = reduce ? "Loading deployments" : LINES[Math.min(step, LINES.length - 1)];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-background text-foreground"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-background via-background/90 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bolt/10 blur-3xl" />

      <div
        className={cn(
          "relative flex w-full max-w-sm flex-col items-center px-6 text-center",
          !reduce && "animate-in fade-in duration-300",
        )}
      >
        <p className="sr-only">Signing you in and opening your dashboard.</p>

        <div className="relative size-[72px]" aria-hidden>
          <svg viewBox="0 0 72 72" className="absolute inset-0 size-full">
            <circle
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/10"
            />
          </svg>
          <div
            className={cn(
              "absolute inset-0",
              !reduce && "animate-spin [animation-duration:1.05s]",
            )}
          >
            <svg viewBox="0 0 72 72" className="size-full -rotate-90">
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="var(--color-bolt)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="56 145"
              />
            </svg>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <BoltMark className="size-7 text-bolt" />
          </div>
        </div>

        <p className="mt-5 font-display text-lg font-semibold tracking-tight">
          blitzship<span className="text-bolt">.</span>
        </p>

        <h1 className="mt-6 font-mono text-[13px] font-medium uppercase tracking-[0.18em] text-white/85">
          Opening your{" "}
          <span className="font-serif text-[1.35em] font-normal normal-case italic tracking-normal text-bolt-soft">
            dashboard
          </span>
        </h1>

        <div className="relative mt-7 h-px w-48 bg-white/10" aria-hidden>
          <div
            className="absolute inset-y-0 left-0 bg-bolt shadow-[0_0_12px_1px_var(--color-bolt)]"
            style={{
              width: `${progress}%`,
              transition: reduce ? "none" : "width 680ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        <p
          key={line}
          aria-hidden
          className={cn(
            "mt-4 min-h-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40",
            !reduce && "animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards",
          )}
        >
          {line}
        </p>
      </div>
    </div>
  );
}
