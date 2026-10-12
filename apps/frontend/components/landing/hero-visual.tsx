"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import heroCloud from "../../assets/hero-cloud-computer.jpg";
import { useReducedMotion } from "./use-reduced-motion";

/* ───────────────────────── deploy terminal ───────────────────────── */

type Line = { text: string; tone?: "dim" | "ok" | "live" | "cmd"; time?: string };

const DEPLOY_LINES: Line[] = [
  { text: "git push origin main", tone: "cmd" },
  { text: "webhook received from GitHub", tone: "dim" },
  { text: "cloned acme/storefront@a41f9c2", tone: "ok" },
  { text: "isolated build container up", tone: "ok" },
  { text: "npm install", tone: "ok", time: "12.4s" },
  { text: "npm run build", tone: "ok", time: "8.1s" },
  { text: "uploaded 42 files to the edge", tone: "ok" },
  { text: "live → acme.blitzship.app", tone: "live" },
];

function DeployTerminal() {
  const reduce = useReducedMotion();
  const [animatedCount, setCount] = useState(0);
  const count = reduce ? DEPLOY_LINES.length : animatedCount;

  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      timer = setTimeout(
        () => {
          setCount(n);
          step(n >= DEPLOY_LINES.length ? 0 : n + 1);
        },
        n === 0 ? 4200 : n === 1 ? 900 : 620,
      );
    };
    step(1);
    return () => clearTimeout(timer);
  }, [reduce]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-ink font-mono text-[11px] leading-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="ml-2 truncate text-[10px] uppercase tracking-[0.14em] text-white/40">
          deploy · acme/storefront
        </span>
      </div>
      <div className="h-[178px] space-y-px px-3 py-2.5">
        {DEPLOY_LINES.slice(0, count).map((line, i) => (
          <div key={i} className="flex items-baseline gap-2 animate-rise [animation-duration:0.35s]">
            <span
              className={
                line.tone === "cmd"
                  ? "text-white/40"
                  : line.tone === "live"
                    ? "text-bolt-soft"
                    : line.tone === "ok"
                      ? "text-bolt"
                      : "text-white/30"
              }
            >
              {line.tone === "cmd" ? "$" : line.tone === "live" ? "●" : line.tone === "ok" ? "✓" : "·"}
            </span>
            <span
              className={
                line.tone === "live"
                  ? "font-medium text-white"
                  : line.tone === "cmd"
                    ? "text-white"
                    : "text-white/65"
              }
            >
              {line.text}
            </span>
            {line.time && <span className="ml-auto text-white/30">{line.time}</span>}
          </div>
        ))}
        {count < DEPLOY_LINES.length && (
          <span className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-bolt animate-blink" />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── feature carousel ───────────────────────── */

const SLIDES = [
  {
    title: "ZERO CONFIG",
    body: "Point BlitzShip at a repo. We install, build and ship it. No YAML, no servers.",
    // which of the 9 diamonds are lit
    lit: [0, 4, 8],
  },
  {
    title: "PUSH TO DEPLOY",
    body: "Every push to your branch fires a GitHub webhook and a fresh deployment.",
    lit: [0, 1, 2, 4, 7],
  },
  {
    title: "YOUR NAME, OUR DOMAIN",
    body: "Claim yourname.blitzship.app for free. Live the second your build finishes.",
    lit: [3, 4, 5],
  },
  {
    title: "BRING YOUR OWN DOMAIN",
    body: "Add two CNAME records. We issue the SSL certificate and wire up the rest.",
    lit: [0, 2, 4, 6, 8],
  },
];

function FeatureCard({ index }: { index: number }) {
  const slide = SLIDES[index];
  return (
    <div className="w-full max-w-[250px] rounded-xl border border-bolt-soft/20 bg-[#0f2257] p-4">
      <div className="mb-6 grid w-fit grid-cols-3 gap-x-2 gap-y-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className={`size-2.5 rotate-45 border transition-colors duration-300 ${
              slide.lit.includes(i) ? "border-bolt-soft bg-bolt-soft" : "border-bolt-soft/45"
            }`}
          />
        ))}
      </div>
      <div key={index} className="animate-rise [animation-duration:0.45s]">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-white">
          {slide.title}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-bolt-soft/80">{slide.body}</p>
      </div>
    </div>
  );
}

/* ───────────────────────── composed panel ───────────────────────── */

export function HeroVisual() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length),
    [],
  );

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5200);
    return () => clearInterval(id);
  }, [paused, index]);

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-white/[0.07] bg-navy lg:min-h-0">
      <Image
        src={heroCloud}
        alt="A retro computer floating inside a cloud made of ASCII characters"
        fill
        priority
        sizes="(min-width: 1024px) 55vw, 100vw"
        className="select-none object-cover object-center"
      />

      {/* corner registration marks */}
      {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((pos) => (
        <span key={pos} className={`pointer-events-none absolute ${pos} font-mono text-[10px] text-bolt-soft/40`}>
          +
        </span>
      ))}

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-end sm:inset-x-6 sm:bottom-6">
        <div className="pointer-events-auto w-full max-w-[310px]">
          <DeployTerminal />
        </div>
      </div>

      <div
        className="absolute inset-x-4 top-4 flex items-start justify-between gap-4 sm:inset-x-6 sm:top-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <FeatureCard index={index} />
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous feature"
            onClick={() => go(-1)}
            className="grid size-10 place-items-center rounded-lg border border-bolt-soft/25 bg-[#0f2257] text-bolt-soft transition hover:bg-bolt hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next feature"
            onClick={() => go(1)}
            className="grid size-10 place-items-center rounded-lg border border-bolt-soft/25 bg-[#0f2257] text-bolt-soft transition hover:bg-bolt hover:text-white"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
