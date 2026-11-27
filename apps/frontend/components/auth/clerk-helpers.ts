import type { useSignIn } from "@clerk/nextjs";

export type SignInResource = ReturnType<typeof useSignIn>["signIn"];
export type SignInSecondFactor = SignInResource["supportedSecondFactors"][number];
export type OAuthStrategy = Exclude<
  Parameters<SignInResource["sso"]>[0]["strategy"],
  "enterprise_sso"
>;

export type OAuthProviderSettings = {
  enabled?: boolean;
  required?: boolean;
  authenticatable?: boolean;
  strategy?: OAuthStrategy;
  name?: string;
  logo_url?: string | null;
};

export type PasswordSettingsData = {
  allowed_special_characters?: string;
  disable_hibp?: boolean;
  min_length: number;
  max_length: number;
  require_special_char: boolean;
  require_numbers: boolean;
  require_uppercase: boolean;
  require_lowercase: boolean;
  show_zxcvbn?: boolean;
  min_zxcvbn_strength?: number;
};

type AttributeConfig = {
  enabled?: boolean;
  required?: boolean;
  used_for_first_factor?: boolean;
  first_factors?: string[];
  verifications?: string[];
};

type UserSettingsLike = {
  social?: Partial<Record<OAuthStrategy, OAuthProviderSettings>>;
  socialProviderStrategies?: OAuthStrategy[];
  authenticatableSocialStrategies?: OAuthStrategy[];
  attributes?: {
    email_address?: AttributeConfig;
    username?: AttributeConfig;
    phone_number?: AttributeConfig;
    first_name?: AttributeConfig;
    last_name?: AttributeConfig;
    password?: AttributeConfig;
    passkey?: AttributeConfig;
  };
  passkeySettings?: {
    show_sign_in_button?: boolean;
  };
  signUp?: {
    legal_consent_enabled?: boolean;
    captcha_enabled?: boolean;
    mode?: "public" | "restricted" | "waitlist";
  };
  passwordSettings?: PasswordSettingsData;
};

export type ClerkEnvConfig = {
  socialStrategies: OAuthStrategy[];
  socialProviders: Partial<Record<OAuthStrategy, OAuthProviderSettings>>;
  emailEnabled: boolean;
  emailRequired: boolean;
  emailFirstFactor: boolean;
  emailCodeFirstFactor: boolean;
  usernameEnabled: boolean;
  usernameRequired: boolean;
  usernameFirstFactor: boolean;
  phoneEnabled: boolean;
  phoneRequired: boolean;
  phoneFirstFactor: boolean;
  firstNameEnabled: boolean;
  firstNameRequired: boolean;
  lastNameEnabled: boolean;
  lastNameRequired: boolean;
  passwordEnabled: boolean;
  passwordRequired: boolean;
  passkeyEnabled: boolean;
  legalConsentEnabled: boolean;
  captchaEnabled: boolean;
  signUpMode: "public" | "restricted" | "waitlist";
  passwordSettings: PasswordSettingsData;
};

const DEFAULT_PASSWORD_SETTINGS: PasswordSettingsData = {
  allowed_special_characters: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
  disable_hibp: false,
  min_length: 8,
  max_length: 72,
  require_special_char: false,
  require_numbers: false,
  require_uppercase: false,
  require_lowercase: false,
  show_zxcvbn: false,
  min_zxcvbn_strength: 0,
};

type ClerkWithInternalEnv = {
  loaded?: boolean;
  __internal_environment?: {
    userSettings?: UserSettingsLike;
  };
};

export function getClerkEnvConfig(clerk: unknown): ClerkEnvConfig {
  const userSettings = (clerk as ClerkWithInternalEnv | null | undefined)
    ?.__internal_environment?.userSettings;

  if (!userSettings) {
    return {
      socialStrategies: [],
      socialProviders: {},
      emailEnabled: true,
      emailRequired: true,
      emailFirstFactor: true,
      emailCodeFirstFactor: true,
      usernameEnabled: false,
      usernameRequired: false,
      usernameFirstFactor: false,
      phoneEnabled: false,
      phoneRequired: false,
      phoneFirstFactor: false,
      firstNameEnabled: false,
      firstNameRequired: false,
      lastNameEnabled: false,
      lastNameRequired: false,
      passwordEnabled: true,
      passwordRequired: true,
      passkeyEnabled: false,
      legalConsentEnabled: false,
      captchaEnabled: false,
      signUpMode: "public",
      passwordSettings: DEFAULT_PASSWORD_SETTINGS,
    };
  }

  const attrs = userSettings.attributes;
  const email = attrs?.email_address;
  const username = attrs?.username;
  const phone = attrs?.phone_number;
  const firstName = attrs?.first_name;
  const lastName = attrs?.last_name;
  const password = attrs?.password;
  const passkey = attrs?.passkey;

  const socialStrategies =
    userSettings.authenticatableSocialStrategies ??
    userSettings.socialProviderStrategies ??
    [];

  return {
    socialStrategies,
    socialProviders: userSettings.social ?? {},
    emailEnabled: email?.enabled ?? true,
    emailRequired: email?.required ?? false,
    emailFirstFactor: email?.used_for_first_factor ?? true,
    emailCodeFirstFactor:
      email?.first_factors?.includes("email_code") ??
      email?.verifications?.includes("email_code") ??
      true,
    usernameEnabled: username?.enabled ?? false,
    usernameRequired: username?.required ?? false,
    usernameFirstFactor: username?.used_for_first_factor ?? false,
    phoneEnabled: phone?.enabled ?? false,
    phoneRequired: phone?.required ?? false,
    phoneFirstFactor: phone?.used_for_first_factor ?? false,
    firstNameEnabled: firstName?.enabled ?? false,
    firstNameRequired: firstName?.required ?? false,
    lastNameEnabled: lastName?.enabled ?? false,
    lastNameRequired: lastName?.required ?? false,
    passwordEnabled: password?.enabled ?? true,
    passwordRequired: password?.required ?? false,
    passkeyEnabled:
      Boolean(passkey?.enabled) &&
      Boolean(userSettings.passkeySettings?.show_sign_in_button),
    legalConsentEnabled: userSettings.signUp?.legal_consent_enabled ?? false,
    captchaEnabled: userSettings.signUp?.captcha_enabled ?? false,
    signUpMode: userSettings.signUp?.mode ?? "public",
    passwordSettings: userSettings.passwordSettings ?? DEFAULT_PASSWORD_SETTINGS,
  };
}

export function getClerkErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  if (typeof err === "object") {
    const maybe = err as {
      longMessage?: string;
      message?: string;
      errors?: Array<{ longMessage?: string; message?: string }>;
    };

    if (Array.isArray(maybe.errors) && maybe.errors.length > 0) {
      const first = maybe.errors[0];
      if (first?.longMessage) return first.longMessage;
      if (first?.message) return first.message;
    }
    if (maybe.longMessage) return maybe.longMessage;
    if (maybe.message) return maybe.message;
  }

  return fallback;
}

export type PasswordRuleResult = {
  id: string;
  label: string;
  met: boolean;
};

export function evaluatePasswordRules(
  password: string,
  settings: PasswordSettingsData,
): {
  rules: PasswordRuleResult[];
  passedCount: number;
  allRequiredMet: boolean;
} {
  const minLen = settings.min_length || 8;
  const rules: PasswordRuleResult[] = [
    {
      id: "length",
      label: `At least ${minLen} characters`,
      met: password.length >= minLen,
    },
  ];

  if (settings.require_uppercase) {
    rules.push({
      id: "uppercase",
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    });
  }
  if (settings.require_lowercase) {
    rules.push({
      id: "lowercase",
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
    });
  }
  if (settings.require_numbers) {
    rules.push({
      id: "number",
      label: "One number",
      met: /\d/.test(password),
    });
  }
  if (settings.require_special_char) {
    rules.push({
      id: "special",
      label: "One special character",
      met: /[^A-Za-z0-9]/.test(password),
    });
  }

  const passedCount = rules.filter((r) => r.met).length;
  return {
    rules,
    passedCount,
    allRequiredMet: passedCount === rules.length,
  };
}

export function getProviderLabel(
  strategy: OAuthStrategy,
  providerInfo?: OAuthProviderSettings,
): string {
  if (providerInfo?.name) return providerInfo.name;
  const raw = strategy.replace(/^oauth_/, "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function resolveSafeRedirect(
  decorateUrl: (url: string) => string,
  targetPath: string,
  navigate: (path: string) => void,
) {
  const destination = decorateUrl(targetPath);
  if (destination.startsWith("http")) {
    window.location.href = destination;
    return;
  }
  navigate(destination);
}
