"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Wordmark } from "@/components/landing/logo";
import { cn } from "@/lib/utils";
import { OtpInput } from "./otp-input";
import { ProviderIcon } from "./provider-icons";
import {
  evaluatePasswordRules,
  getClerkEnvConfig,
  getClerkErrorMessage,
  getProviderLabel,
  resolveSafeRedirect,
  type OAuthStrategy,
  type SignInSecondFactor,
} from "./clerk-helpers";

export type AuthMode = "sign-in" | "sign-up";

type SignInStep =
  | "credentials"
  | "email-code"
  | "forgot-email"
  | "forgot-code"
  | "forgot-new-password"
  | "mfa"
  | "new-password";

type SignUpStep = "form" | "verify" | "missing-fields";

interface AuthPortalProps {
  initialMode?: AuthMode;
  ssoCallbackPath?: string;
  onAuthComplete?: (mode: AuthMode) => void;
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-line bg-ink px-3 text-sm text-white placeholder:text-white/30 transition-colors outline-none focus:border-bolt focus:ring-2 focus:ring-bolt/25 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "block text-xs font-medium text-white/75";

export function AuthPortal({
  initialMode = "sign-in",
  ssoCallbackPath = "/login/sso-callback",
  onAuthComplete,
}: AuthPortalProps) {
  const router = useRouter();
  const clerk = useClerk();
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [signInStep, setSignInStep] = useState<SignInStep>("credentials");
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("form");

  // Sign-in form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useEmailCodeOnly, setUseEmailCodeOnly] = useState(false);
  const [signInCode, setSignInCode] = useState("");

  // Forgot-password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [signOutOtherSessions, setSignOutOtherSessions] = useState(true);

  // MFA / Client trust state
  const [mfaStrategy, setMfaStrategy] = useState<
    "totp" | "email_code" | "phone_code" | "backup_code"
  >("totp");
  const [mfaCode, setMfaCode] = useState("");
  const mfaSentRef = useRef<string | null>(null);

  // Sign-up form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<"email" | "phone">("email");
  const [signUpCode, setSignUpCode] = useState("");

  // Shared UI state
  const [localError, setLocalError] = useState<string | null>(null);
  const [showClerkErrors, setShowClerkErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const envConfig = useMemo(
    () => getClerkEnvConfig(clerk),
    // Re-evaluate once Clerk finishes bootstrapping its environment config
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clerk, clerk.loaded],
  );

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Resume interrupted Clerk flows (e.g., returning from OAuth with MFA or missing fields)
  useEffect(() => {
    if (!clerk.loaded) return;

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      setMode("sign-in");
      setSignInStep("mfa");
      return;
    }

    if (signIn.status === "needs_new_password") {
      setMode("sign-in");
      setSignInStep("new-password");
      return;
    }

    if (signUp.status === "missing_requirements" && signUp.id) {
      setMode("sign-up");
      if (signUp.unverifiedFields.includes("email_address")) {
        setVerifyTarget("email");
        setSignUpStep("verify");
      } else if (signUp.unverifiedFields.includes("phone_number")) {
        setVerifyTarget("phone");
        setSignUpStep("verify");
      } else if (signUp.missingFields.length > 0) {
        setSignUpStep("missing-fields");
      }
    }
  }, [
    clerk.loaded,
    signIn.status,
    signUp.status,
    signUp.id,
    signUp.unverifiedFields,
    signUp.missingFields,
  ]);

  // Select default second factor & send OTP if needed when entering MFA
  useEffect(() => {
    if (!clerk.loaded || signInStep !== "mfa") return;
    const factors = signIn.supportedSecondFactors ?? [];
    if (factors.length === 0) return;

    const available = factors.map((f) => f.strategy);
    const preferred = available.includes(mfaStrategy)
      ? mfaStrategy
      : available.includes("totp")
        ? "totp"
        : available.includes("email_code")
          ? "email_code"
          : available.includes("phone_code")
            ? "phone_code"
            : "backup_code";

    if (preferred !== mfaStrategy) {
      setMfaStrategy(preferred);
    }

    const sendKey = `${signIn.id ?? "s"}:${preferred}`;
    if (
      (preferred === "email_code" || preferred === "phone_code") &&
      mfaSentRef.current !== sendKey
    ) {
      mfaSentRef.current = sendKey;
      const sendFn =
        preferred === "email_code"
          ? signIn.mfa.sendEmailCode
          : signIn.mfa.sendPhoneCode;
      void sendFn().then(({ error }) => {
        if (error) {
          setLocalError(getClerkErrorMessage(error));
        } else {
          setResendCooldown(30);
        }
      });
    }
  }, [clerk.loaded, signInStep, signIn.id, signIn.supportedSecondFactors, mfaStrategy, signIn.mfa]);

  const isBusy =
    submitting ||
    oauthLoading !== null ||
    signInFetchStatus === "fetching" ||
    signUpFetchStatus === "fetching";

  const activeErrorMessage = useMemo(() => {
    if (localError) return localError;
    if (!showClerkErrors) return null;
    if (mode === "sign-in") {
      if (signInErrors.global && signInErrors.global.length > 0) {
        return getClerkErrorMessage(signInErrors.global[0]);
      }
      if (signInStep === "email-code" || signInStep === "forgot-code" || signInStep === "mfa") {
        if (signInErrors.fields.code) return signInErrors.fields.code.longMessage || signInErrors.fields.code.message;
      }
    } else {
      if (signUpErrors.global && signUpErrors.global.length > 0) {
        return getClerkErrorMessage(signUpErrors.global[0]);
      }
      if (signUpErrors.fields.captcha) {
        return signUpErrors.fields.captcha.longMessage || signUpErrors.fields.captcha.message;
      }
    }
    return null;
  }, [localError, showClerkErrors, mode, signInErrors, signUpErrors, signInStep]);

  const clearErrors = () => {
    setLocalError(null);
    setShowClerkErrors(false);
  };

  const switchMode = async (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    clearErrors();
    setSignInStep("credentials");
    setSignUpStep("form");
    setSignInCode("");
    setSignUpCode("");
    setMfaCode("");
    mfaSentRef.current = null;
    setMode(nextMode);
    if (clerk.loaded) {
      if (nextMode === "sign-in" && signUp.id) {
        await signUp.reset();
      } else if (nextMode === "sign-up" && signIn.id) {
        await signIn.reset();
      }
    }
  };

  const finalizeSignIn = async () => {
    onAuthComplete?.("sign-in");
    const { error } = await signIn.finalize({
      navigate: ({ decorateUrl }) =>
        resolveSafeRedirect(decorateUrl, "/dashboard", (path) => router.replace(path)),
    });
    if (error) {
      setLocalError(getClerkErrorMessage(error));
    }
  };

  const finalizeSignUp = async () => {
    onAuthComplete?.("sign-up");
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) =>
        resolveSafeRedirect(decorateUrl, "/post-signup", (path) => router.replace(path)),
    });
    if (error) {
      setLocalError(getClerkErrorMessage(error));
    }
  };

  const handleSignInNextStep = async () => {
    if (signIn.status === "complete") {
      await finalizeSignIn();
      return;
    }
    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      setMfaCode("");
      mfaSentRef.current = null;
      setSignInStep("mfa");
      return;
    }
    if (signIn.status === "needs_new_password") {
      setNewPassword("");
      setConfirmNewPassword("");
      setSignInStep("new-password");
      return;
    }
    if (signIn.status === "needs_first_factor") {
      const hasEmailCode = signIn.supportedFirstFactors?.some(
        (f) => f.strategy === "email_code",
      );
      if (hasEmailCode) {
        const { error } = await signIn.emailCode.sendCode();
        if (error) {
          setLocalError(getClerkErrorMessage(error));
          return;
        }
        setSignInCode("");
        setResendCooldown(30);
        setSignInStep("email-code");
      } else {
        setLocalError("Additional verification is required to sign in.");
      }
    }
  };

  const handleOAuth = async (strategy: OAuthStrategy) => {
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setOauthLoading(strategy);
    try {
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${ssoCallbackPath}`
          : ssoCallbackPath;

      if (mode === "sign-in") {
        const { error } = await signIn.sso({
          strategy,
          redirectUrl: "/dashboard",
          redirectCallbackUrl: callbackUrl,
        });
        if (error) setLocalError(getClerkErrorMessage(error));
      } else {
        const { error } = await signUp.sso({
          strategy,
          redirectUrl: "/post-signup",
          redirectCallbackUrl: callbackUrl,
        });
        if (error) setLocalError(getClerkErrorMessage(error));
      }
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setOauthLoading(null);
    }
  };

  const handlePasskeySignIn = async () => {
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setSubmitting(true);
    try {
      const { error } = await signIn.passkey({ flow: "discoverable" });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignInNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setShowClerkErrors(true);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setLocalError("Enter your email address or username.");
      return;
    }

    setSubmitting(true);
    try {
      if (useEmailCodeOnly || !envConfig.passwordEnabled) {
        const { error: createErr } = await signIn.create({ identifier: trimmedId });
        if (createErr) {
          setLocalError(getClerkErrorMessage(createErr));
          return;
        }
        const { error: sendErr } = await signIn.emailCode.sendCode();
        if (sendErr) {
          setLocalError(getClerkErrorMessage(sendErr));
          return;
        }
        setSignInCode("");
        setResendCooldown(30);
        setSignInStep("email-code");
        return;
      }

      if (!password) {
        setLocalError("Enter your password.");
        return;
      }

      const { error } = await signIn.password({
        identifier: trimmedId,
        password,
      });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignInNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySignInCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setShowClerkErrors(true);

    if (signInCode.length < 6) {
      setLocalError("Enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signIn.emailCode.verifyCode({ code: signInCode });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignInNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();

    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setLocalError("Enter your account email address.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: createErr } = await signIn.create({ identifier: trimmed });
      if (createErr) {
        setLocalError(getClerkErrorMessage(createErr));
        return;
      }
      const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendErr) {
        setLocalError(getClerkErrorMessage(sendErr));
        return;
      }
      setResetCode("");
      setResendCooldown(30);
      setSignInStep("forgot-code");
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();

    if (resetCode.length < 6) {
      setLocalError("Enter the 6-digit reset code.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: resetCode,
      });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      setNewPassword("");
      setConfirmNewPassword("");
      setSignInStep("forgot-new-password");
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();

    if (newPassword !== confirmNewPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: signOutOtherSessions,
      });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignInNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();

    const code = mfaCode.trim();
    if (!code) {
      setLocalError("Enter your verification code.");
      return;
    }

    setSubmitting(true);
    try {
      let res: { error: unknown };
      if (mfaStrategy === "totp") {
        res = await signIn.mfa.verifyTOTP({ code });
      } else if (mfaStrategy === "email_code") {
        res = await signIn.mfa.verifyEmailCode({ code });
      } else if (mfaStrategy === "phone_code") {
        res = await signIn.mfa.verifyPhoneCode({ code });
      } else {
        res = await signIn.mfa.verifyBackupCode({ code });
      }

      if (res.error) {
        setLocalError(getClerkErrorMessage(res.error));
        return;
      }
      await handleSignInNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpNextStep = async () => {
    if (signUp.status === "complete") {
      await finalizeSignUp();
      return;
    }

    if (signUp.unverifiedFields.includes("email_address")) {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      setVerifyTarget("email");
      setSignUpCode("");
      setResendCooldown(30);
      setSignUpStep("verify");
      return;
    }

    if (signUp.unverifiedFields.includes("phone_number")) {
      const { error } = await signUp.verifications.sendPhoneCode();
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      setVerifyTarget("phone");
      setSignUpCode("");
      setResendCooldown(30);
      setSignUpStep("verify");
      return;
    }

    if (signUp.missingFields.length > 0) {
      setSignUpStep("missing-fields");
    }
  };

  const handleSignUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setShowClerkErrors(true);

    if (envConfig.legalConsentEnabled && !legalAccepted) {
      setLocalError("Please accept the terms to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const commonPayload = {
        ...(envConfig.firstNameEnabled && firstName.trim()
          ? { firstName: firstName.trim() }
          : {}),
        ...(envConfig.lastNameEnabled && lastName.trim()
          ? { lastName: lastName.trim() }
          : {}),
        ...(envConfig.usernameEnabled && username.trim()
          ? { username: username.trim() }
          : {}),
        ...(envConfig.legalConsentEnabled ? { legalAccepted } : {}),
      };

      if (envConfig.passwordEnabled) {
        const res = await signUp.password({
          ...commonPayload,
          emailAddress: signUpEmail.trim(),
          ...(envConfig.phoneEnabled && signUpPhone.trim()
            ? { phoneNumber: signUpPhone.trim() }
            : {}),
          password: signUpPassword,
        } as Parameters<typeof signUp.password>[0]);
        if (res.error) {
          setLocalError(getClerkErrorMessage(res.error));
          return;
        }
      } else {
        const { error } = await signUp.create({
          ...commonPayload,
          ...(envConfig.emailEnabled && signUpEmail.trim()
            ? { emailAddress: signUpEmail.trim() }
            : {}),
          ...(envConfig.phoneEnabled && signUpPhone.trim()
            ? { phoneNumber: signUpPhone.trim() }
            : {}),
        });
        if (error) {
          setLocalError(getClerkErrorMessage(error));
          return;
        }
      }

      await handleSignUpNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySignUpCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setShowClerkErrors(true);

    if (signUpCode.length < 6) {
      setLocalError("Enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } =
        verifyTarget === "email"
          ? await signUp.verifications.verifyEmailCode({ code: signUpCode })
          : await signUp.verifications.verifyPhoneCode({ code: signUpCode });

      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignUpNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMissingFieldsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded || isBusy) return;
    clearErrors();
    setShowClerkErrors(true);

    setSubmitting(true);
    try {
      const needsCreate =
        signUp.missingFields.includes("username") ||
        signUp.missingFields.includes("email_address") ||
        signUp.missingFields.includes("phone_number");

      const { error } = needsCreate
        ? await signUp.create({
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
            ...(username.trim() ? { username: username.trim() } : {}),
            ...(signUpEmail.trim() ? { emailAddress: signUpEmail.trim() } : {}),
            ...(signUpPhone.trim() ? { phoneNumber: signUpPhone.trim() } : {}),
            ...(envConfig.legalConsentEnabled ? { legalAccepted } : {}),
          })
        : await signUp.update({
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
            ...(envConfig.legalConsentEnabled ? { legalAccepted } : {}),
          });
      if (error) {
        setLocalError(getClerkErrorMessage(error));
        return;
      }
      await handleSignUpNextStep();
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!clerk.loaded || resendCooldown > 0 || isBusy) return;
    clearErrors();
    setSubmitting(true);
    try {
      let res: { error: unknown } = { error: null };
      if (mode === "sign-in") {
        if (signInStep === "email-code") {
          res = await signIn.emailCode.sendCode();
        } else if (signInStep === "forgot-code") {
          res = await signIn.resetPasswordEmailCode.sendCode();
        } else if (signInStep === "mfa") {
          res =
            mfaStrategy === "phone_code"
              ? await signIn.mfa.sendPhoneCode()
              : await signIn.mfa.sendEmailCode();
        }
      } else if (signUpStep === "verify") {
        res =
          verifyTarget === "email"
            ? await signUp.verifications.sendEmailCode()
            : await signUp.verifications.sendPhoneCode();
      }
      if (res.error) {
        setLocalError(getClerkErrorMessage(res.error));
      } else {
        setResendCooldown(30);
      }
    } catch (err) {
      setLocalError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const passwordAnalysis = useMemo(
    () => evaluatePasswordRules(signUpPassword, envConfig.passwordSettings),
    [signUpPassword, envConfig.passwordSettings],
  );

  const newPasswordAnalysis = useMemo(
    () => evaluatePasswordRules(newPassword, envConfig.passwordSettings),
    [newPassword, envConfig.passwordSettings],
  );

  const identifierLabel =
    envConfig.emailFirstFactor && envConfig.usernameFirstFactor
      ? "Email or username"
      : envConfig.usernameFirstFactor && !envConfig.emailFirstFactor
        ? "Username"
        : "Email address";

  const identifierPlaceholder =
    envConfig.emailFirstFactor && envConfig.usernameFirstFactor
      ? "you@company.com or username"
      : envConfig.usernameFirstFactor && !envConfig.emailFirstFactor
        ? "username"
        : "you@company.com";

  const isPrimaryEntryStep =
    (mode === "sign-in" && signInStep === "credentials") ||
    (mode === "sign-up" && signUpStep === "form");

  const showSocialButtons =
    isPrimaryEntryStep && envConfig.socialStrategies.length > 0;

  const availableSecondFactors = (signIn.supportedSecondFactors ?? []).filter(
    (factor): factor is Extract<
      SignInSecondFactor,
      { strategy: "totp" | "email_code" | "phone_code" | "backup_code" }
    > =>
      factor.strategy === "totp" ||
      factor.strategy === "email_code" ||
      factor.strategy === "phone_code" ||
      factor.strategy === "backup_code",
  );

  return (
    <div className="flex min-h-screen flex-col bg-ink text-foreground selection:bg-bolt selection:text-white">
      {/* Top SaaS utility bar */}
      <header className="border-b border-line bg-ink">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="BlitzShip home" className="inline-flex items-center">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white"
            >
              Back to site
            </Link>
          </div>
        </div>
      </header>

      {/* Main auth workspace */}
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 items-center px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          {/* Left architectural SaaS context panel */}
          <aside className="hidden flex-col justify-between rounded-2xl border border-line bg-panel p-8 lg:flex">
            <div>

              <h1 className="mt-6 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-white">
                Deploy React apps from{" "}
                <span className="font-serif font-normal italic text-bolt-soft">
                  git push
                </span>{" "}
                to live edge in seconds.
              </h1>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
                Sign in to inspect build logs, roll back production releases, and manage
                custom domains with automatic TLS.
              </p>

              <div className="mt-8 space-y-3">
                <div className="flex items-start gap-3.5 rounded-xl border border-line bg-panel-2 p-4">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink text-bolt">
                    <GitBranch className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      GitHub App Integration
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                      Automatic branch previews and production builds on every push.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-line bg-panel-2 p-4">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink text-bolt">
                    <Terminal className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Isolated Build Containers
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                      Deterministic installs, live log streaming, and framework detection.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-line bg-panel-2 p-4">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink text-bolt">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Custom Domains &amp; Edge SSL
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                      Instant <span className="font-mono text-white/75">.blitzship.app</span>{" "}
                      subdomains or bring your own domain.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-line pt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
              <span>Secured by Clerk</span>
              <span>TLS 1.3 · Zero-trust sessions</span>
            </div>
          </aside>

          {/* Right auth card */}
          <section
            aria-label="Authentication"
            className="mx-auto flex w-full max-w-[460px] flex-col justify-center rounded-2xl border border-line bg-panel p-6 sm:p-8 lg:max-w-none"
          >
            {/* Mode switcher on primary entry steps */}
            {isPrimaryEntryStep && (
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="grid grid-cols-2 rounded-xl border border-line bg-ink p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sign-in"}
                  disabled={isBusy}
                  onClick={() => void switchMode("sign-in")}
                  className={cn(
                    "h-9 rounded-lg text-xs font-medium transition-colors",
                    mode === "sign-in"
                      ? "bg-panel-2 text-white ring-1 ring-white/10"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sign-up"}
                  disabled={isBusy}
                  onClick={() => void switchMode("sign-up")}
                  className={cn(
                    "h-9 rounded-lg text-xs font-medium transition-colors",
                    mode === "sign-up"
                      ? "bg-panel-2 text-white ring-1 ring-white/10"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  Create account
                </button>
              </div>
            )}

            {/* Dynamic heading */}
            <div className={cn(isPrimaryEntryStep ? "mt-6" : "")}>
              {mode === "sign-in" && signInStep === "credentials" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Welcome back
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Sign in to your BlitzShip workspace.
                  </p>
                </>
              )}
              {mode === "sign-in" && signInStep === "email-code" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Check your email
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-medium text-white">{identifier}</span>.
                  </p>
                </>
              )}
              {mode === "sign-in" && signInStep === "forgot-email" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Reset password
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    We&apos;ll send a verification code to your email address.
                  </p>
                </>
              )}
              {mode === "sign-in" && signInStep === "forgot-code" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Verify reset code
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-medium text-white">{resetEmail}</span>.
                  </p>
                </>
              )}
              {mode === "sign-in" &&
                (signInStep === "forgot-new-password" || signInStep === "new-password") && (
                  <>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                      Set a new password
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Choose a strong password for your BlitzShip account.
                    </p>
                  </>
                )}
              {mode === "sign-in" && signInStep === "mfa" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Two-step verification
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    {signIn.status === "needs_client_trust"
                      ? "New device detected. Verify your identity to continue."
                      : "Complete your second factor to access your workspace."}
                  </p>
                </>
              )}
              {mode === "sign-up" && signUpStep === "form" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Create your account
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Start deploying React apps in under a minute.
                  </p>
                </>
              )}
              {mode === "sign-up" && signUpStep === "verify" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Verify your {verifyTarget === "email" ? "email" : "phone number"}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-medium text-white">
                      {verifyTarget === "email"
                        ? signUp.emailAddress || signUpEmail
                        : signUp.phoneNumber || signUpPhone}
                    </span>
                    .
                  </p>
                </>
              )}
              {mode === "sign-up" && signUpStep === "missing-fields" && (
                <>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                    Finish setting up your profile
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    A few more details are needed to activate your account.
                  </p>
                </>
              )}
            </div>

            {/* Loading skeleton before Clerk initializes */}
            {!clerk.loaded ? (
              <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading authentication">
                <div className="h-10 w-full animate-pulse rounded-lg bg-panel-2" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-panel-2" />
                <div className="h-px w-full bg-line" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-panel-2" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-panel-2" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-bolt/30" />
              </div>
            ) : (
              <div className="mt-6">
                {/* Global / step error banner */}
                {activeErrorMessage && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-300"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                    <span>{activeErrorMessage}</span>
                  </div>
                )}

                {/* OAuth providers */}
                {showSocialButtons && (
                  <>
                    <div
                      className={cn(
                        "grid gap-2.5",
                        envConfig.socialStrategies.length === 2 ? "sm:grid-cols-2" : "grid-cols-1",
                      )}
                    >
                      {envConfig.socialStrategies.map((strategy) => {
                        const info = envConfig.socialProviders[strategy];
                        const label = getProviderLabel(strategy, info);
                        const isThisLoading = oauthLoading === strategy;
                        return (
                          <button
                            key={strategy}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleOAuth(strategy)}
                            className="inline-flex h-10 items-center justify-center gap-2.5 rounded-lg border border-line bg-panel-2 px-3.5 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isThisLoading ? (
                              <Loader2 className="size-4 animate-spin text-white/70" />
                            ) : (
                              <ProviderIcon
                                strategy={strategy}
                                logoUrl={info?.logo_url}
                                label={label}
                              />
                            )}
                            <span>
                              {envConfig.socialStrategies.length > 2
                                ? `Continue with ${label}`
                                : label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="my-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-line" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                        or continue with email
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  </>
                )}

                {/* ═══════════════ SIGN IN FLOWS ═══════════════ */}
                {mode === "sign-in" && signInStep === "credentials" && (
                  <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="signin-identifier" className={LABEL_CLASS}>
                        {identifierLabel}
                      </label>
                      <input
                        id="signin-identifier"
                        type={envConfig.usernameFirstFactor ? "text" : "email"}
                        autoComplete={envConfig.usernameFirstFactor ? "username" : "email"}
                        placeholder={identifierPlaceholder}
                        value={identifier}
                        disabled={isBusy}
                        onChange={(e) => {
                          clearErrors();
                          setIdentifier(e.target.value);
                        }}
                        aria-invalid={Boolean(signInErrors.fields.identifier) || undefined}
                        className={cn(
                          INPUT_CLASS,
                          "mt-1.5",
                          signInErrors.fields.identifier && "border-red-500/70",
                        )}
                      />
                      {signInErrors.fields.identifier && (
                        <p className="mt-1 text-xs text-red-400">
                          {signInErrors.fields.identifier.longMessage ||
                            signInErrors.fields.identifier.message}
                        </p>
                      )}
                    </div>

                    {!useEmailCodeOnly && envConfig.passwordEnabled && (
                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="signin-password" className={LABEL_CLASS}>
                            Password
                          </label>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              clearErrors();
                              setResetEmail(identifier.includes("@") ? identifier : "");
                              setSignInStep("forgot-email");
                            }}
                            className="text-xs font-medium text-bolt-soft transition-colors hover:text-white"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative mt-1.5">
                          <input
                            id="signin-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="••••••••••••"
                            value={password}
                            disabled={isBusy}
                            onChange={(e) => {
                              clearErrors();
                              setPassword(e.target.value);
                            }}
                            aria-invalid={Boolean(signInErrors.fields.password) || undefined}
                            className={cn(
                              INPUT_CLASS,
                              "pr-10",
                              signInErrors.fields.password && "border-red-500/70",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/40 transition-colors hover:text-white"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        {signInErrors.fields.password && (
                          <p className="mt-1 text-xs text-red-400">
                            {signInErrors.fields.password.longMessage ||
                              signInErrors.fields.password.message}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>
                            {useEmailCodeOnly || !envConfig.passwordEnabled
                              ? "Send sign-in code"
                              : "Sign in"}
                          </span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    {(envConfig.emailCodeFirstFactor && envConfig.passwordEnabled) ||
                    envConfig.passkeyEnabled ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {envConfig.emailCodeFirstFactor && envConfig.passwordEnabled && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              clearErrors();
                              setUseEmailCodeOnly((prev) => !prev);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
                          >
                            <Mail className="size-3.5" />
                            {useEmailCodeOnly
                              ? "Use password instead"
                              : "Sign in with email code"}
                          </button>
                        )}

                        {envConfig.passkeyEnabled && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handlePasskeySignIn()}
                            className="inline-flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
                          >
                            <KeyRound className="size-3.5" />
                            Use a passkey
                          </button>
                        )}
                      </div>
                    ) : null}
                  </form>
                )}

                {mode === "sign-in" && signInStep === "email-code" && (
                  <form onSubmit={handleVerifySignInCode} className="space-y-5">
                    <div>
                      <label htmlFor="signin-otp" className={LABEL_CLASS}>
                        Verification code
                      </label>
                      <div className="mt-2">
                        <OtpInput
                          id="signin-otp"
                          value={signInCode}
                          onChange={(val) => {
                            clearErrors();
                            setSignInCode(val);
                          }}
                          disabled={isBusy}
                          invalid={Boolean(signInErrors.fields.code)}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || signInCode.length < 6}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Verify &amp; sign in</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          clearErrors();
                          await signIn.reset();
                          setSignInStep("credentials");
                        }}
                        className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
                      >
                        <ArrowLeft className="size-3.5" />
                        Use another method
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || resendCooldown > 0}
                        onClick={() => void handleResendCode()}
                        className="font-medium text-bolt-soft transition-colors hover:text-white disabled:text-white/35"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}

                {mode === "sign-in" && signInStep === "forgot-email" && (
                  <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="reset-email" className={LABEL_CLASS}>
                        Email address
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={resetEmail}
                        disabled={isBusy}
                        onChange={(e) => {
                          clearErrors();
                          setResetEmail(e.target.value);
                        }}
                        className={cn(INPUT_CLASS, "mt-1.5")}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send reset code</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        clearErrors();
                        await signIn.reset();
                        setSignInStep("credentials");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
                    >
                      <ArrowLeft className="size-3.5" />
                      Back to sign in
                    </button>
                  </form>
                )}

                {mode === "sign-in" && signInStep === "forgot-code" && (
                  <form onSubmit={handleForgotCodeSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="reset-otp" className={LABEL_CLASS}>
                        Reset code
                      </label>
                      <div className="mt-2">
                        <OtpInput
                          id="reset-otp"
                          value={resetCode}
                          onChange={(val) => {
                            clearErrors();
                            setResetCode(val);
                          }}
                          disabled={isBusy}
                          invalid={Boolean(signInErrors.fields.code)}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || resetCode.length < 6}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Continue</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          clearErrors();
                          await signIn.reset();
                          setSignInStep("credentials");
                        }}
                        className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
                      >
                        <ArrowLeft className="size-3.5" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || resendCooldown > 0}
                        onClick={() => void handleResendCode()}
                        className="font-medium text-bolt-soft transition-colors hover:text-white disabled:text-white/35"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}

                {mode === "sign-in" &&
                  (signInStep === "forgot-new-password" || signInStep === "new-password") && (
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="new-password" className={LABEL_CLASS}>
                          New password
                        </label>
                        <div className="relative mt-1.5">
                          <input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            value={newPassword}
                            disabled={isBusy}
                            onChange={(e) => {
                              clearErrors();
                              setNewPassword(e.target.value);
                            }}
                            className={cn(INPUT_CLASS, "pr-10")}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/40 transition-colors hover:text-white"
                          >
                            {showNewPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        {newPassword.length > 0 && (
                          <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                            {newPasswordAnalysis.rules.map((rule) => (
                              <li
                                key={rule.id}
                                className={cn(
                                  "flex items-center gap-1.5 text-[11px]",
                                  rule.met ? "text-emerald-400" : "text-white/40",
                                )}
                              >
                                <Check className="size-3 shrink-0" />
                                <span>{rule.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <label htmlFor="confirm-new-password" className={LABEL_CLASS}>
                          Confirm new password
                        </label>
                        <input
                          id="confirm-new-password"
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Repeat your new password"
                          value={confirmNewPassword}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setConfirmNewPassword(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>

                      <label className="flex cursor-pointer items-center gap-2.5 text-xs text-white/65">
                        <input
                          type="checkbox"
                          checked={signOutOtherSessions}
                          onChange={(e) => setSignOutOtherSessions(e.target.checked)}
                          className="size-4 rounded border-line bg-ink accent-bolt"
                        />
                        Sign out of all other active sessions
                      </label>

                      <button
                        type="submit"
                        disabled={isBusy || !newPassword}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <span>Update password &amp; sign in</span>
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                {mode === "sign-in" && signInStep === "mfa" && (
                  <form onSubmit={handleMfaSubmit} className="space-y-5">
                    {availableSecondFactors.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {availableSecondFactors.map((factor) => {
                          const label =
                            factor.strategy === "totp"
                              ? "Authenticator app"
                              : factor.strategy === "email_code"
                                ? "Email code"
                                : factor.strategy === "phone_code"
                                  ? "SMS code"
                                  : "Backup code";
                          const selected = mfaStrategy === factor.strategy;
                          return (
                            <button
                              key={factor.strategy}
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                clearErrors();
                                setMfaCode("");
                                setMfaStrategy(factor.strategy);
                              }}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                selected
                                  ? "border-bolt bg-bolt/15 text-white"
                                  : "border-line bg-panel-2 text-white/55 hover:text-white",
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 text-xs text-white/75">
                        <ShieldCheck className="size-4 text-bolt" />
                        <span>
                          {mfaStrategy === "totp"
                            ? "Enter the 6-digit code from your authenticator app"
                            : mfaStrategy === "backup_code"
                              ? "Enter one of your single-use backup codes"
                              : `Enter the 6-digit code sent to your ${
                                  mfaStrategy === "phone_code" ? "phone" : "email"
                                }`}
                        </span>
                      </div>

                      <div className="mt-3">
                        {mfaStrategy === "backup_code" ? (
                          <input
                            type="text"
                            autoComplete="one-time-code"
                            placeholder="XXXX-XXXX"
                            value={mfaCode}
                            disabled={isBusy}
                            onChange={(e) => {
                              clearErrors();
                              setMfaCode(e.target.value);
                            }}
                            className={cn(INPUT_CLASS, "font-mono tracking-wider")}
                          />
                        ) : (
                          <OtpInput
                            id="mfa-otp"
                            value={mfaCode}
                            onChange={(val) => {
                              clearErrors();
                              setMfaCode(val);
                            }}
                            disabled={isBusy}
                            invalid={Boolean(signInErrors.fields.code)}
                          />
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || !mfaCode.trim()}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Verify &amp; continue</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          clearErrors();
                          await signIn.reset();
                          mfaSentRef.current = null;
                          setSignInStep("credentials");
                        }}
                        className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
                      >
                        <ArrowLeft className="size-3.5" />
                        Start over
                      </button>

                      {(mfaStrategy === "email_code" || mfaStrategy === "phone_code") && (
                        <button
                          type="button"
                          disabled={isBusy || resendCooldown > 0}
                          onClick={() => void handleResendCode()}
                          className="font-medium text-bolt-soft transition-colors hover:text-white disabled:text-white/35"
                        >
                          {resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : "Resend code"}
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* ═══════════════ SIGN UP FLOWS ═══════════════ */}
                {mode === "sign-up" && signUpStep === "form" && (
                  <form onSubmit={handleSignUpSubmit} className="space-y-4" noValidate>
                    {(envConfig.firstNameEnabled || envConfig.lastNameEnabled) && (
                      <div
                        className={cn(
                          "grid gap-3",
                          envConfig.firstNameEnabled && envConfig.lastNameEnabled
                            ? "sm:grid-cols-2"
                            : "grid-cols-1",
                        )}
                      >
                        {envConfig.firstNameEnabled && (
                          <div>
                            <label htmlFor="signup-first-name" className={LABEL_CLASS}>
                              First name
                              {!envConfig.firstNameRequired && (
                                <span className="ml-1 text-white/35">(optional)</span>
                              )}
                            </label>
                            <input
                              id="signup-first-name"
                              type="text"
                              autoComplete="given-name"
                              placeholder="Ada"
                              required={envConfig.firstNameRequired}
                              value={firstName}
                              disabled={isBusy}
                              onChange={(e) => {
                                clearErrors();
                                setFirstName(e.target.value);
                              }}
                              className={cn(
                                INPUT_CLASS,
                                "mt-1.5",
                                signUpErrors.fields.firstName && "border-red-500/70",
                              )}
                            />
                            {signUpErrors.fields.firstName && (
                              <p className="mt-1 text-xs text-red-400">
                                {signUpErrors.fields.firstName.longMessage ||
                                  signUpErrors.fields.firstName.message}
                              </p>
                            )}
                          </div>
                        )}

                        {envConfig.lastNameEnabled && (
                          <div>
                            <label htmlFor="signup-last-name" className={LABEL_CLASS}>
                              Last name
                              {!envConfig.lastNameRequired && (
                                <span className="ml-1 text-white/35">(optional)</span>
                              )}
                            </label>
                            <input
                              id="signup-last-name"
                              type="text"
                              autoComplete="family-name"
                              placeholder="Lovelace"
                              required={envConfig.lastNameRequired}
                              value={lastName}
                              disabled={isBusy}
                              onChange={(e) => {
                                clearErrors();
                                setLastName(e.target.value);
                              }}
                              className={cn(
                                INPUT_CLASS,
                                "mt-1.5",
                                signUpErrors.fields.lastName && "border-red-500/70",
                              )}
                            />
                            {signUpErrors.fields.lastName && (
                              <p className="mt-1 text-xs text-red-400">
                                {signUpErrors.fields.lastName.longMessage ||
                                  signUpErrors.fields.lastName.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {envConfig.usernameEnabled && (
                      <div>
                        <label htmlFor="signup-username" className={LABEL_CLASS}>
                          Username
                          {!envConfig.usernameRequired && (
                            <span className="ml-1 text-white/35">(optional)</span>
                          )}
                        </label>
                        <input
                          id="signup-username"
                          type="text"
                          autoComplete="username"
                          placeholder="adalovelace"
                          required={envConfig.usernameRequired}
                          value={username}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setUsername(e.target.value);
                          }}
                          className={cn(
                            INPUT_CLASS,
                            "mt-1.5",
                            signUpErrors.fields.username && "border-red-500/70",
                          )}
                        />
                        {signUpErrors.fields.username && (
                          <p className="mt-1 text-xs text-red-400">
                            {signUpErrors.fields.username.longMessage ||
                              signUpErrors.fields.username.message}
                          </p>
                        )}
                      </div>
                    )}

                    {envConfig.emailEnabled && (
                      <div>
                        <label htmlFor="signup-email" className={LABEL_CLASS}>
                          Email address
                        </label>
                        <input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          required={envConfig.emailRequired}
                          value={signUpEmail}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setSignUpEmail(e.target.value);
                          }}
                          className={cn(
                            INPUT_CLASS,
                            "mt-1.5",
                            signUpErrors.fields.emailAddress && "border-red-500/70",
                          )}
                        />
                        {signUpErrors.fields.emailAddress && (
                          <p className="mt-1 text-xs text-red-400">
                            {signUpErrors.fields.emailAddress.longMessage ||
                              signUpErrors.fields.emailAddress.message}
                          </p>
                        )}
                      </div>
                    )}

                    {envConfig.phoneEnabled && (
                      <div>
                        <label htmlFor="signup-phone" className={LABEL_CLASS}>
                          Phone number
                          {!envConfig.phoneRequired && (
                            <span className="ml-1 text-white/35">(optional)</span>
                          )}
                        </label>
                        <input
                          id="signup-phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+1 555 010 9988"
                          required={envConfig.phoneRequired}
                          value={signUpPhone}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setSignUpPhone(e.target.value);
                          }}
                          className={cn(
                            INPUT_CLASS,
                            "mt-1.5",
                            signUpErrors.fields.phoneNumber && "border-red-500/70",
                          )}
                        />
                        {signUpErrors.fields.phoneNumber && (
                          <p className="mt-1 text-xs text-red-400">
                            {signUpErrors.fields.phoneNumber.longMessage ||
                              signUpErrors.fields.phoneNumber.message}
                          </p>
                        )}
                      </div>
                    )}

                    {envConfig.passwordEnabled && (
                      <div>
                        <label htmlFor="signup-password" className={LABEL_CLASS}>
                          Password
                        </label>
                        <div className="relative mt-1.5">
                          <input
                            id="signup-password"
                            type={showSignUpPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Create a strong password"
                            required={envConfig.passwordRequired}
                            value={signUpPassword}
                            disabled={isBusy}
                            onChange={(e) => {
                              clearErrors();
                              setSignUpPassword(e.target.value);
                            }}
                            className={cn(
                              INPUT_CLASS,
                              "pr-10",
                              signUpErrors.fields.password && "border-red-500/70",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignUpPassword((prev) => !prev)}
                            aria-label={
                              showSignUpPassword ? "Hide password" : "Show password"
                            }
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/40 transition-colors hover:text-white"
                          >
                            {showSignUpPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>

                        {signUpErrors.fields.password && (
                          <p className="mt-1 text-xs text-red-400">
                            {signUpErrors.fields.password.longMessage ||
                              signUpErrors.fields.password.message}
                          </p>
                        )}

                        {signUpPassword.length > 0 && (
                          <div className="mt-2.5 space-y-2">
                            <div className="grid grid-cols-4 gap-1.5" aria-hidden>
                              {[0, 1, 2, 3].map((idx) => {
                                const ratio =
                                  passwordAnalysis.passedCount /
                                  Math.max(1, passwordAnalysis.rules.length);
                                const filledBars =
                                  passwordAnalysis.allRequiredMet &&
                                  signUpPassword.length >= 12
                                    ? 4
                                    : Math.max(1, Math.round(ratio * 3));
                                const active = idx < filledBars;
                                const barColor = !active
                                  ? "bg-white/10"
                                  : filledBars === 4
                                    ? "bg-emerald-400"
                                    : filledBars >= 2
                                      ? "bg-bolt"
                                      : "bg-amber-400";
                                return (
                                  <span
                                    key={idx}
                                    className={cn("h-1 rounded-full transition-colors", barColor)}
                                  />
                                );
                              })}
                            </div>
                            <ul className="grid grid-cols-2 gap-1.5">
                              {passwordAnalysis.rules.map((rule) => (
                                <li
                                  key={rule.id}
                                  className={cn(
                                    "flex items-center gap-1.5 text-[11px]",
                                    rule.met ? "text-emerald-400" : "text-white/40",
                                  )}
                                >
                                  <Check className="size-3 shrink-0" />
                                  <span>{rule.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {envConfig.legalConsentEnabled && (
                      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-white/60">
                        <input
                          type="checkbox"
                          checked={legalAccepted}
                          onChange={(e) => {
                            clearErrors();
                            setLegalAccepted(e.target.checked);
                          }}
                          className="mt-0.5 size-4 rounded border-line bg-ink accent-bolt"
                        />
                        <span>
                          I agree to the BlitzShip Terms of Service and Privacy Policy.
                        </span>
                      </label>
                    )}

                    {/* Required by Clerk Bot Protection when using custom sign-up flows */}
                    <div id="clerk-captcha" />

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Create account</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {mode === "sign-up" && signUpStep === "verify" && (
                  <form onSubmit={handleVerifySignUpCode} className="space-y-5">
                    <div>
                      <label htmlFor="signup-otp" className={LABEL_CLASS}>
                        Verification code
                      </label>
                      <div className="mt-2">
                        <OtpInput
                          id="signup-otp"
                          value={signUpCode}
                          onChange={(val) => {
                            clearErrors();
                            setSignUpCode(val);
                          }}
                          disabled={isBusy}
                          invalid={Boolean(signUpErrors.fields.code)}
                        />
                      </div>
                      {signUpErrors.fields.code && (
                        <p className="mt-2 text-xs text-red-400">
                          {signUpErrors.fields.code.longMessage ||
                            signUpErrors.fields.code.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || signUpCode.length < 6}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Verify &amp; continue</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          clearErrors();
                          await signUp.reset();
                          setSignUpStep("form");
                        }}
                        className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
                      >
                        <ArrowLeft className="size-3.5" />
                        Edit details
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || resendCooldown > 0}
                        onClick={() => void handleResendCode()}
                        className="font-medium text-bolt-soft transition-colors hover:text-white disabled:text-white/35"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}

                {mode === "sign-up" && signUpStep === "missing-fields" && (
                  <form onSubmit={handleMissingFieldsSubmit} className="space-y-4">
                    {signUp.missingFields.includes("first_name") && (
                      <div>
                        <label htmlFor="missing-first-name" className={LABEL_CLASS}>
                          First name
                        </label>
                        <input
                          id="missing-first-name"
                          type="text"
                          value={firstName}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setFirstName(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>
                    )}

                    {signUp.missingFields.includes("last_name") && (
                      <div>
                        <label htmlFor="missing-last-name" className={LABEL_CLASS}>
                          Last name
                        </label>
                        <input
                          id="missing-last-name"
                          type="text"
                          value={lastName}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setLastName(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>
                    )}

                    {signUp.missingFields.includes("username") && (
                      <div>
                        <label htmlFor="missing-username" className={LABEL_CLASS}>
                          Username
                        </label>
                        <input
                          id="missing-username"
                          type="text"
                          value={username}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setUsername(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>
                    )}

                    {signUp.missingFields.includes("email_address") && (
                      <div>
                        <label htmlFor="missing-email" className={LABEL_CLASS}>
                          Email address
                        </label>
                        <input
                          id="missing-email"
                          type="email"
                          value={signUpEmail}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setSignUpEmail(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>
                    )}

                    {signUp.missingFields.includes("phone_number") && (
                      <div>
                        <label htmlFor="missing-phone" className={LABEL_CLASS}>
                          Phone number
                        </label>
                        <input
                          id="missing-phone"
                          type="tel"
                          value={signUpPhone}
                          disabled={isBusy}
                          onChange={(e) => {
                            clearErrors();
                            setSignUpPhone(e.target.value);
                          }}
                          className={cn(INPUT_CLASS, "mt-1.5")}
                        />
                      </div>
                    )}

                    {signUp.missingFields.includes("legal_accepted") && (
                      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-white/60">
                        <input
                          type="checkbox"
                          checked={legalAccepted}
                          onChange={(e) => setLegalAccepted(e.target.checked)}
                          className="mt-0.5 size-4 rounded border-line bg-ink accent-bolt"
                        />
                        <span>
                          I agree to the BlitzShip Terms of Service and Privacy Policy.
                        </span>
                      </label>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-bolt px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <span>Complete sign up</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Bottom mode switch link */}
                {isPrimaryEntryStep && (
                  <p className="mt-6 border-t border-line pt-5 text-center text-xs text-white/50">
                    {mode === "sign-in" ? (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void switchMode("sign-up")}
                          className="font-medium text-white underline decoration-white/25 underline-offset-4 transition-colors hover:text-bolt-soft hover:decoration-bolt-soft"
                        >
                          Create one
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void switchMode("sign-in")}
                          className="font-medium text-white underline decoration-white/25 underline-offset-4 transition-colors hover:text-bolt-soft hover:decoration-bolt-soft"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
