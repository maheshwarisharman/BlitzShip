const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Normalises a user- or detector-supplied build output directory into a clean
 * path relative to the repo root (e.g. "./dist/" -> "dist").
 * Returns null when the path is empty, absolute, or escapes the repo root,
 * because the build worker copies this path out of the build container.
 */
export function normalizeOutputDir(input: string): string | null {
    const trimmed = input.trim().replace(/^(\.\/)+/, '').replace(/\/+$/, '')
    if (!trimmed || trimmed.startsWith('/')) return null

    const segments = trimmed.split('/')
    const isSafe = segments.every(
        (segment) => SEGMENT_PATTERN.test(segment) && segment !== '.' && segment !== '..'
    )
    return isSafe ? segments.join('/') : null
}

export const OUTPUT_DIR_RULES_MESSAGE =
    'Output directory must be a relative path inside the repository (e.g. "dist" or "build/client")'
