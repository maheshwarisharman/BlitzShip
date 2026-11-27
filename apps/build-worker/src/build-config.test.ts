import { describe, expect, test } from 'bun:test';
import { normalizeOutputDir, pickInstallCommand } from './build-config.js';

describe('pickInstallCommand', () => {
  test('uses npm ci with a package-lock and npm install without one', () => {
    expect(pickInstallCommand(['package.json', 'package-lock.json']).command).toEqual(['npm', 'ci']);
    expect(pickInstallCommand(['package.json'])).toMatchObject({ command: ['npm', 'install'], hasLockfile: false });
  });

  test('detects yarn and pnpm from their lockfiles', () => {
    expect(pickInstallCommand(['yarn.lock']).command).toEqual(['yarn', 'install', '--frozen-lockfile']);
    expect(pickInstallCommand(['pnpm-lock.yaml']).command).toEqual(['pnpm', 'install', '--frozen-lockfile']);
  });

  test('the packageManager field takes precedence over lockfiles', () => {
    const plan = pickInstallCommand(['package-lock.json'], 'pnpm@9.0.0');
    expect(plan).toMatchObject({ packageManager: 'pnpm', command: ['pnpm', 'install'], hasLockfile: false });
  });
});

describe('normalizeOutputDir', () => {
  test('accepts nested relative paths and rejects escapes', () => {
    expect(normalizeOutputDir('./build/client/')).toBe('build/client');
    expect(normalizeOutputDir('../secrets')).toBeNull();
    expect(normalizeOutputDir('/workspace')).toBeNull();
  });
});
