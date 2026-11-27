import axios from 'axios'
import path from 'path'
import { normalizeOutputDir } from '../utils/outputDir.js'

export type Framework =
    | 'next-static-export'
    | 'gatsby'
    | 'docusaurus'
    | 'create-react-app'
    | 'vite'
    | 'parcel'
    | 'webpack'
    | 'unknown'

export type PackageManager = 'npm' | 'yarn' | 'pnpm'
export type Confidence = 'high' | 'low'

export interface DetectedBuildConfig {
    framework: Framework
    frameworkLabel: string
    buildCmd: string | null
    outputDir: string
    outputDirSource: string
    packageManager: PackageManager
    confidence: Confidence
    warnings: string[]
}

/** Read-only view of a repository's root at a specific ref. */
export interface RepoSnapshot {
    rootFiles: string[]
    readFile: (filePath: string) => Promise<string | null>
}

interface PackageJson {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    packageManager?: string
    workspaces?: unknown
}

interface DetectorContext {
    buildScript: string
    files: Set<string>
    readFile: RepoSnapshot['readFile']
}

interface OutputDetection {
    dir: string
    source: string
    confidence: Confidence
    warnings?: string[]
}

interface FrameworkDetector {
    framework: Framework
    label: string
    packages: string[]
    cliPattern: RegExp
    detectOutput: (ctx: DetectorContext) => Promise<OutputDetection>
}

const DEFAULT_OUTPUT_DIR = 'dist'
const JS_CONFIG_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']

// Ordered from most to least specific: meta-frameworks often depend on webpack/vite internally
const DETECTORS: FrameworkDetector[] = [
    {
        framework: 'next-static-export',
        label: 'Next.js (static export)',
        packages: ['next'],
        cliPattern: /\bnext\b/,
        async detectOutput({ buildScript, files, readFile }) {
            const configFile = findConfigFile(files, 'next.config', JS_CONFIG_EXTENSIONS)
            const config = configFile ? await readFile(configFile) : null
            const isStaticExport =
                (config !== null && /\boutput\s*:\s*['"`]export['"`]/.test(config)) ||
                /\bnext\s+export\b/.test(buildScript)

            if (!isStaticExport) {
                return {
                    dir: 'out',
                    source: 'Next.js static export default',
                    confidence: 'low',
                    warnings: [
                        'This Next.js app is not configured for static export. Set output: "export" in next.config so it can be deployed as a static site.',
                    ],
                }
            }

            const distDir = config ? readStringProperty(config, 'distDir') : null
            return distDir
                ? { dir: distDir, source: configFile!, confidence: 'high' }
                : { dir: 'out', source: 'Next.js static export default', confidence: 'high' }
        },
    },
    {
        framework: 'gatsby',
        label: 'Gatsby',
        packages: ['gatsby'],
        cliPattern: /\bgatsby\b/,
        async detectOutput() {
            return { dir: 'public', source: 'Gatsby default', confidence: 'high' }
        },
    },
    {
        framework: 'docusaurus',
        label: 'Docusaurus',
        packages: ['@docusaurus/core'],
        cliPattern: /\bdocusaurus\b/,
        async detectOutput({ buildScript }) {
            const cliOutDir = readCliFlag(buildScript, ['--out-dir'])
            return cliOutDir
                ? { dir: cliOutDir, source: 'build script', confidence: 'high' }
                : { dir: 'build', source: 'Docusaurus default', confidence: 'high' }
        },
    },
    {
        framework: 'create-react-app',
        label: 'Create React App',
        packages: ['react-scripts', '@craco/craco', 'react-app-rewired'],
        cliPattern: /\b(react-scripts|craco|react-app-rewired)\b/,
        async detectOutput({ buildScript }) {
            const buildPath = readEnvAssignment(buildScript, 'BUILD_PATH')
            return buildPath
                ? { dir: buildPath, source: 'BUILD_PATH in build script', confidence: 'high' }
                : { dir: 'build', source: 'Create React App default', confidence: 'high' }
        },
    },
    {
        framework: 'vite',
        label: 'Vite',
        packages: ['vite'],
        cliPattern: /\bvite\b/,
        async detectOutput({ buildScript, files, readFile }) {
            const cliOutDir = readCliFlag(buildScript, ['--outDir'])
            if (cliOutDir) return { dir: cliOutDir, source: 'build script', confidence: 'high' }

            const configFile = findConfigFile(files, 'vite.config', JS_CONFIG_EXTENSIONS)
            const config = configFile ? await readFile(configFile) : null
            if (!config) return { dir: DEFAULT_OUTPUT_DIR, source: 'Vite default', confidence: 'high' }

            const outDir = readStringProperty(config, 'outDir')
            const root = readStringProperty(config, 'root')
            const isDynamic =
                (hasProperty(config, 'outDir') && !outDir) || (hasProperty(config, 'root') && !root)

            if (isDynamic) {
                return {
                    dir: outDir ?? DEFAULT_OUTPUT_DIR,
                    source: configFile!,
                    confidence: 'low',
                    warnings: [`${configFile} computes build.outDir or root dynamically. Verify the output directory.`],
                }
            }

            // Vite resolves build.outDir relative to the configured project root
            const dir = joinRelative(root, outDir ?? DEFAULT_OUTPUT_DIR)
            const source = outDir || root ? configFile! : 'Vite default'
            return { dir, source, confidence: 'high' }
        },
    },
    {
        framework: 'parcel',
        label: 'Parcel',
        packages: ['parcel', 'parcel-bundler'],
        cliPattern: /\bparcel\b/,
        async detectOutput({ buildScript }) {
            const cliOutDir = readCliFlag(buildScript, ['--dist-dir', '--out-dir'])
            return cliOutDir
                ? { dir: cliOutDir, source: 'build script', confidence: 'high' }
                : { dir: DEFAULT_OUTPUT_DIR, source: 'Parcel default', confidence: 'high' }
        },
    },
    {
        framework: 'webpack',
        label: 'Webpack',
        packages: ['webpack', 'webpack-cli'],
        cliPattern: /\bwebpack\b/,
        async detectOutput({ buildScript, files, readFile }) {
            const cliOutDir = readCliFlag(buildScript, ['--output-path'])
            if (cliOutDir) return { dir: cliOutDir, source: 'build script', confidence: 'high' }

            const configFile = findConfigFile(files, 'webpack.config', JS_CONFIG_EXTENSIONS)
            const config = configFile ? await readFile(configFile) : null
            if (!config) return { dir: DEFAULT_OUTPUT_DIR, source: 'Webpack default', confidence: 'high' }

            const match = config.match(
                /\boutput\s*:\s*\{[\s\S]*?\bpath\s*:\s*(?:path\.)?(?:resolve|join)\(\s*__dirname\s*,\s*(['"`])([^'"`]+)\1\s*\)/
            )
            if (match?.[2]) return { dir: match[2], source: configFile!, confidence: 'high' }

            return hasProperty(config, 'output')
                ? {
                      dir: DEFAULT_OUTPUT_DIR,
                      source: configFile!,
                      confidence: 'low',
                      warnings: [`Couldn't read output.path from ${configFile}. Verify the output directory.`],
                  }
                : { dir: DEFAULT_OUTPUT_DIR, source: 'Webpack default', confidence: 'high' }
        },
    },
]

export async function detectBuildConfig(repo: RepoSnapshot): Promise<DetectedBuildConfig> {
    const files = new Set(repo.rootFiles)
    const warnings: string[] = []

    const packageJson = files.has('package.json') ? parsePackageJson(await repo.readFile('package.json')) : null
    if (!packageJson) {
        return {
            framework: 'unknown',
            frameworkLabel: 'Unknown',
            buildCmd: null,
            outputDir: DEFAULT_OUTPUT_DIR,
            outputDirSource: 'default',
            packageManager: 'npm',
            confidence: 'low',
            warnings: [
                files.has('package.json')
                    ? 'package.json could not be parsed.'
                    : 'No package.json found at the repository root. Only static React projects at the repository root can be deployed.',
            ],
        }
    }

    const packageManager = detectPackageManager(files, packageJson.packageManager)
    const hasSupportedLockfile = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'].some((f) => files.has(f))
    if (!hasSupportedLockfile && (files.has('bun.lockb') || files.has('bun.lock'))) {
        warnings.push('Bun lockfiles are not supported. Dependencies will be installed with npm without a lockfile.')
    }
    if (packageJson.workspaces || files.has('pnpm-workspace.yaml') || files.has('turbo.json') || files.has('lerna.json')) {
        warnings.push('This looks like a monorepo. Only the repository root is built, so make sure the root build script produces the site.')
    }

    const buildScript = packageJson.scripts?.build
    if (!buildScript) {
        warnings.push('package.json has no "build" script. Add one or enter a custom build command.')
    }

    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const detector = pickDetector(dependencies, buildScript ?? '')

    let output: OutputDetection
    if (detector) {
        output = await detector.detectOutput({ buildScript: buildScript ?? '', files, readFile: repo.readFile })
    } else {
        output = { dir: DEFAULT_OUTPUT_DIR, source: 'default', confidence: 'low' }
        warnings.push("Couldn't detect a supported framework. Verify the output directory before deploying.")
    }
    warnings.push(...(output.warnings ?? []))

    let outputDir = normalizeOutputDir(output.dir)
    let confidence = output.confidence
    if (!outputDir) {
        warnings.push(`The detected output directory "${output.dir}" is outside the repository and can't be deployed.`)
        outputDir = DEFAULT_OUTPUT_DIR
        confidence = 'low'
    }

    return {
        framework: detector?.framework ?? 'unknown',
        frameworkLabel: detector?.label ?? 'Unknown',
        buildCmd: buildScript ? `${packageManager} run build` : null,
        outputDir,
        outputDirSource: output.source,
        packageManager,
        confidence,
        warnings,
    }
}

// ─── GitHub access ───────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com'
const MAX_FILE_BYTES = 512 * 1024

export class RepoRefNotFoundError extends Error {}

/**
 * Lists the repository root at `ref` and returns a cached file reader.
 * package.json is fetched in parallel with the listing since almost every detection needs it.
 */
export async function fetchRepoSnapshot(accessToken: string, repo: string, ref: string): Promise<RepoSnapshot> {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
    }

    const cache = new Map<string, Promise<string | null>>()
    const readFile = (filePath: string) => {
        if (!cache.has(filePath)) {
            cache.set(filePath, fetchRawFile(headers, repo, ref, filePath))
        }
        return cache.get(filePath)!
    }
    readFile('package.json').catch(() => {})

    try {
        const listing = await axios.get<{ name: string }[] | { name: string }>(`${GITHUB_API}/repos/${repo}/contents`, {
            headers: { ...headers, Accept: 'application/vnd.github+json' },
            params: { ref },
        })
        const rootFiles = Array.isArray(listing.data) ? listing.data.map((entry) => entry.name) : []
        return { rootFiles, readFile }
    } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
            throw new RepoRefNotFoundError(`Repository ${repo} or branch ${ref} not found, or the repository is empty`)
        }
        throw e
    }
}

async function fetchRawFile(
    headers: Record<string, string>,
    repo: string,
    ref: string,
    filePath: string
): Promise<string | null> {
    try {
        const res = await axios.get<string>(`${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(filePath)}`, {
            headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
            params: { ref },
            responseType: 'text',
            maxContentLength: MAX_FILE_BYTES,
        })
        return res.data
    } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return null
        throw e
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Prefers the framework whose CLI the build script actually invokes, then falls back to dependency order. */
function pickDetector(dependencies: Record<string, string>, buildScript: string): FrameworkDetector | undefined {
    const installed = DETECTORS.filter((d) => d.packages.some((pkg) => pkg in dependencies))
    return installed.find((d) => d.cliPattern.test(buildScript)) ?? installed[0]
}

export function detectPackageManager(files: Set<string>, packageManagerField?: string): PackageManager {
    const declared = packageManagerField?.split('@')[0]
    if (declared === 'npm' || declared === 'yarn' || declared === 'pnpm') return declared
    if (files.has('pnpm-lock.yaml')) return 'pnpm'
    if (files.has('yarn.lock')) return 'yarn'
    return 'npm'
}

function parsePackageJson(raw: string | null): PackageJson | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PackageJson) : null
    } catch {
        return null
    }
}

function findConfigFile(files: Set<string>, baseName: string, extensions: string[]): string | null {
    return extensions.map((ext) => `${baseName}.${ext}`).find((name) => files.has(name)) ?? null
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reads `--flag value` or `--flag=value` from a package.json script. */
function readCliFlag(script: string, flags: string[]): string | null {
    for (const flag of flags) {
        const match = script.match(new RegExp(`(?:^|\\s)${escapeRegExp(flag)}(?:=|\\s+)(["']?)([^\\s"']+)\\1`))
        if (match?.[2]) return match[2]
    }
    return null
}

/** Reads an inline `NAME=value` assignment (including via cross-env) from a package.json script. */
function readEnvAssignment(script: string, name: string): string | null {
    const match = script.match(new RegExp(`(?:^|\\s)${escapeRegExp(name)}=(["']?)([^\\s"']+)\\1`))
    return match?.[2] ?? null
}

function hasProperty(source: string, key: string): boolean {
    return new RegExp(`\\b${escapeRegExp(key)}\\s*:`).test(source)
}

/** Reads a literal string property (`key: 'value'`) from a JS/TS config file; null if absent or computed. */
function readStringProperty(source: string, key: string): string | null {
    const match = source.match(new RegExp(`\\b${escapeRegExp(key)}\\s*:\\s*(['"\`])([^'"\`$]+)\\1`))
    return match?.[2] ?? null
}

function joinRelative(base: string | null, target: string): string {
    if (!base || path.posix.isAbsolute(target)) return target
    return path.posix.join(base, target)
}
