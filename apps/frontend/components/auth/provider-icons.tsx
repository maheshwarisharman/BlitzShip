import type { OAuthStrategy } from "./clerk-helpers";

export function ProviderIcon({
  strategy,
  logoUrl,
  label,
}: {
  strategy: OAuthStrategy;
  logoUrl?: string | null;
  label: string;
}) {
  if (strategy === "oauth_github") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-current" aria-hidden>
        <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.1.73-.24.73-.53v-1.85c-3.03.66-3.67-1.45-3.67-1.45-.5-1.26-1.21-1.6-1.21-1.6-.99-.68.07-.66.07-.66 1.1.08 1.67 1.13 1.67 1.13.97 1.66 2.54 1.18 3.16.9.1-.7.38-1.18.69-1.45-2.42-.28-4.96-1.21-4.96-5.38 0-1.19.42-2.16 1.12-2.92-.11-.28-.49-1.4.1-2.91 0 0 .92-.29 3 1.12a10.4 10.4 0 0 1 5.5 0c2.08-1.41 3-1.12 3-1.12.6 1.51.22 2.63.1 2.91.7.76 1.12 1.73 1.12 2.92 0 4.18-2.55 5.1-4.98 5.37.39.34.74 1.01.74 2.04v3.02c0 .29.19.63.74.53A11 11 0 0 0 12 1.27Z" />
      </svg>
    );
  }

  if (strategy === "oauth_google") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden>
        <path
          fill="#EA4335"
          d="M12 5.04c1.64 0 3.11.56 4.27 1.67l3.2-3.2C17.53 1.69 14.99.6 12 .6 7.36.6 3.37 3.26 1.43 7.14l3.73 2.89C6.04 7.34 8.77 5.04 12 5.04Z"
        />
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44a5.5 5.5 0 0 1-2.39 3.61l3.69 2.86c2.15-1.98 3.75-4.91 3.75-8.66Z"
        />
        <path
          fill="#FBBC05"
          d="M5.16 14.97a6.9 6.9 0 0 1 0-4.94L1.43 7.14a11.4 11.4 0 0 0 0 10.72l3.73-2.89Z"
        />
        <path
          fill="#34A853"
          d="M12 23.4c3.08 0 5.67-1.02 7.56-2.77l-3.69-2.86c-1.02.69-2.33 1.1-3.87 1.1-3.23 0-5.96-2.18-6.94-5.11l-3.73 2.89C3.37 20.74 7.36 23.4 12 23.4Z"
        />
      </svg>
    );
  }

  if (strategy === "oauth_apple") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-current" aria-hidden>
        <path d="M16.37 12.64c-.02-2.25 1.84-3.34 1.92-3.39-1.05-1.53-2.68-1.74-3.25-1.76-1.37-.14-2.69.82-3.39.82-.71 0-1.78-.8-2.94-.78-1.5.02-2.89.88-3.66 2.22-1.57 2.72-.4 6.74 1.12 8.95.75 1.08 1.64 2.29 2.81 2.24 1.13-.05 1.56-.73 2.93-.73 1.37 0 1.75.73 2.95.7 1.22-.02 1.99-1.1 2.73-2.18.87-1.26 1.22-2.49 1.24-2.55-.03-.01-2.44-.94-2.46-3.54ZM14.14 6.13c.62-.76 1.04-1.8.93-2.85-.9.04-2 .6-2.64 1.35-.57.66-1.07 1.73-.94 2.75 1 .08 2.02-.5 2.65-1.25Z" />
      </svg>
    );
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={label} className="size-4 shrink-0 rounded-sm object-contain" />
    );
  }

  return (
    <span className="grid size-4 shrink-0 place-items-center rounded bg-white/10 font-mono text-[10px] font-semibold uppercase text-white">
      {label.charAt(0)}
    </span>
  );
}
