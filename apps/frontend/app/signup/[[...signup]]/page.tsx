"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { AuthPortal } from "@/components/auth/auth-portal";
import { SsoCallbackHandler } from "@/components/auth/sso-callback-handler";

export default function SignUpPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  const isSsoCallback = pathname?.endsWith("/sso-callback") ?? false;

  useEffect(() => {
    if (isSsoCallback) return;
    if (authLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, isSsoCallback, router]);

  if (isSsoCallback) {
    return <SsoCallbackHandler defaultMode="sign-up" />;
  }

  return (
    <AuthPortal
      initialMode="sign-up"
      ssoCallbackPath="/signup/sso-callback"
    />
  );
}
