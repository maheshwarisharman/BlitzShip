export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface InstallPlan {
  packageManager: PackageManager;
  command: string[];
  hasLockfile: boolean;
}

// Checked in order when the configured output directory has no index.html after the build
export const FALLBACK_OUTPUT_DIRS = ['dist', 'build', 'out'];

const LOCKFILES: Record<PackageManager, string[]> = {
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  yarn: ['yarn.lock'],
  pnpm: ['pnpm-lock.yaml'],
};

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Normalises a build output directory into a clean repo-relative path ("./dist/" -> "dist").
 * Returns null for empty, absolute, or parent-escaping paths, since the result is used as a
 * path inside the build container.
 */
export function normalizeOutputDir(input: string): string | null {
  const trimmed = input.trim().replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  if (!trimmed || trimmed.startsWith('/')) return null;

  const segments = trimmed.split('/');
  const isSafe = segments.every(
    (segment) => SEGMENT_PATTERN.test(segment) && segment !== '.' && segment !== '..'
  );
  return isSafe ? segments.join('/') : null;
}

/**
 * Chooses the install command from the repo's "packageManager" field and lockfiles.
 * Uses a frozen install whenever the matching lockfile is committed.
 */
export function pickInstallCommand(rootFiles: string[], packageManagerField?: string): InstallPlan {
  const files = new Set(rootFiles);
  const declared = packageManagerField?.split('@')[0];

  let packageManager: PackageManager = 'npm';
  if (declared === 'npm' || declared === 'yarn' || declared === 'pnpm') {
    packageManager = declared;
  } else if (files.has('pnpm-lock.yaml')) {
    packageManager = 'pnpm';
  } else if (files.has('yarn.lock')) {
    packageManager = 'yarn';
  }

  const hasLockfile = LOCKFILES[packageManager].some((lockfile) => files.has(lockfile));

  const command =
    packageManager === 'npm'
      ? ['npm', hasLockfile ? 'ci' : 'install']
      : [packageManager, 'install', ...(hasLockfile ? ['--frozen-lockfile'] : [])];

  return { packageManager, command, hasLockfile };
}
