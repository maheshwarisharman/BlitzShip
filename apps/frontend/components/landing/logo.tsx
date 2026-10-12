import { cn } from "@/lib/utils";

/**
 * The BlitzShip bolt, expressed as polygon points on a 0-100 grid.
 * Shared with the ASCII canvas so the hero bolt matches the logo exactly.
 */
export const BOLT_POINTS: ReadonlyArray<readonly [number, number]> = [
  [34, 2],
  [80, 2],
  [56, 38],
  [78, 38],
  [20, 98],
  [38, 52],
  [16, 52],
];

export function BoltMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      fill="currentColor"
    >
      <polygon points={BOLT_POINTS.map((p) => p.join(",")).join(" ")} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BoltMark className="size-6 text-bolt" />
      <span className="font-display text-xl font-semibold tracking-tight">
        blitzship<span className="text-bolt">.</span>
      </span>
    </span>
  );
}
