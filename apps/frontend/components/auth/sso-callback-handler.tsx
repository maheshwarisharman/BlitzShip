"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { BoltMark, Wordmark } from "@/components/landing/logo";
import { getClerkErrorMessage, resolveSafeRedirect } from "./clerk-helpers";

interface SsoCallbackHandlerProps {
  defaultMode?: "sign-in" | "sign-up";
}

export function SsoCallbackHandler({ defaultMode = "sign-in" }: SsoCallbackHandlerProps) {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    if (!clerk.loaded || hasRun.current) return;
    hasRun.current = true;

    const processCallback = async () => {
      try {
        if (signIn.status === "complete") {
          const { error } = await signIn.finalize({
            navigate: ({ decorateUrl }) =>
              resolveSafeRedirect(decorateUrl, "/dashboard", (path) => router.replace(path)),
          });
          if (error) setCallbackError(getClerkErrorMessage(error));
          return;
        }

        if (signUp.isTransferable) {
          const { error: createErr } = await signIn.create({ transfer: true });
          if (createErr) {
            setCallbackError(getClerkErrorMessage(createErr));
            return;
          }
          if ((signIn as { status: string }).status === "complete") {
            const { error: finalizeErr } = await signIn.finalize({
              navigate: ({ decorateUrl }) =>
                resolveSafeRedirect(decorateUrl, "/dashboard", (path) => router.replace(path)),
            });
            if (finalizeErr) setCallbackError(getClerkErrorMessage(finalizeErr));
            return;
          }
          router.replace("/login");
          return;
        }

        if (
          signIn.status === "needs_first_factor" &&
          !signIn.supportedFirstFactors?.every((f) => f.strategy === "enterprise_sso")
        ) {
          router.replace("/login");
          return;
        }

        if (signIn.isTransferable) {
          const { error: createErr } = await signUp.create({ transfer: true });
          if (createErr) {
            setCallbackError(getClerkErrorMessage(createErr));
            return;
          }
          if (signUp.status === "complete") {
            const { error: finalizeErr } = await signUp.finalize({
              navigate: ({ decorateUrl }) =>
                resolveSafeRedirect(decorateUrl, "/post-signup", (path) => router.replace(path)),
            });
            if (finalizeErr) setCallbackError(getClerkErrorMessage(finalizeErr));
            return;
          }
          router.replace("/signup");
          return;
        }

        if (signUp.status === "complete") {
          const { error } = await signUp.finalize({
            navigate: ({ decorateUrl }) =>
              resolveSafeRedirect(decorateUrl, "/post-signup", (path) => router.replace(path)),
          });
          if (error) setCallbackError(getClerkErrorMessage(error));
          return;
        }

        if (
          signIn.status === "needs_second_factor" ||
          signIn.status === "needs_client_trust" ||
          signIn.status === "needs_new_password"
        ) {
          router.replace("/login");
          return;
        }

        if (signUp.status === "missing_requirements" && signUp.id) {
          router.replace("/signup");
          return;
        }

        const existingSessionId =
          signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
        if (existingSessionId) {
          await clerk.setActive({
            session: existingSessionId,
            navigate: ({ decorateUrl }) =>
              resolveSafeRedirect(
                decorateUrl,
                defaultMode === "sign-up" ? "/post-signup" : "/dashboard",
                (path) => router.replace(path),
              ),
          });
          return;
        }

        router.replace(defaultMode === "sign-up" ? "/signup" : "/login");
      } catch (err) {
        setCallbackError(getClerkErrorMessage(err, "Unable to complete single sign-on."));
      }
    };

    void processCallback();
  }, [clerk, clerk.loaded, signIn, signUp, router, defaultMode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 text-center">
        <div className="mx-auto flex justify-center">
          <Wordmark />
        </div>

        {callbackError ? (
          <div className="mt-6 space-y-4">
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-left text-xs text-red-300"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
              <span>{callbackError}</span>
            </div>
            <button
              type="button"
              onClick={() => router.replace(defaultMode === "sign-up" ? "/signup" : "/login")}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-4 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              <ArrowLeft className="size-4" />
              Back to {defaultMode === "sign-up" ? "sign up" : "sign in"}
            </button>
          </div>
        ) : (
          <div className="mt-7 flex flex-col items-center">
            <div className="relative size-12">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-bolt" />
              <div className="absolute inset-0 grid place-items-center">
                <BoltMark className="size-5 text-bolt" />
              </div>
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
              Completing authentication
            </p>
            <p className="mt-1.5 text-xs text-white/40">
              Verifying your provider session with Clerk…
            </p>
          </div>
        )}

        <div id="clerk-captcha" className="mt-4" />
      </div>
    </div>
  );
}
