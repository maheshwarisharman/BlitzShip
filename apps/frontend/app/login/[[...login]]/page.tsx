"use client";

import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { AuthPortal } from "@/components/auth/auth-portal";
import { SsoCallbackHandler } from "@/components/auth/sso-callback-handler";
import { SessionHandoff } from "@/components/session-handoff";

export default function LoginPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const [latched, setLatched] = useState(false);
  const [completedSignUp, setCompletedSignUp] = useState(false);

  const isSsoCallback = pathname?.endsWith("/sso-callback") ?? false;
  const signInComplete = signIn.status === "complete";
  const sessionActive = authLoaded && Boolean(isSignedIn);
  const pending =
    !isSsoCallback && !completedSignUp && (sessionActive || signInComplete);

  if (pending && !latched) {
    setLatched(true);
  }

  const showHandoff =
    !isSsoCallback && !completedSignUp && (latched || pending);

  useEffect(() => {
    if (!showHandoff) return;
    router.prefetch("/dashboard");
  }, [showHandoff, router]);

  useEffect(() => {
    if (!sessionActive || isSsoCallback || completedSignUp) return;
    router.replace("/dashboard");
  }, [sessionActive, isSsoCallback, completedSignUp, router]);

  useEffect(() => {
    if (!latched || sessionActive || signInComplete) return;
    const timer = window.setTimeout(() => setLatched(false), 8000);
    return () => window.clearTimeout(timer);
  }, [latched, sessionActive, signInComplete]);

  if (isSsoCallback) {
    return <SsoCallbackHandler defaultMode="sign-in" />;
  }

  return (
    <>
      <AuthPortal
        initialMode="sign-in"
        ssoCallbackPath="/login/sso-callback"
        onAuthComplete={(completedMode) => {
          if (completedMode === "sign-up") {
            setCompletedSignUp(true);
            return;
          }
          setLatched(true);
        }}
      />
      {showHandoff && <SessionHandoff />}
    </>
  );
}
