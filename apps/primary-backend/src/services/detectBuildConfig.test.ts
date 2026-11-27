import { describe, expect, test } from "bun:test";
import { detectBuildConfig, type RepoSnapshot } from "./detectBuildConfig.js";
import { normalizeOutputDir } from "../utils/outputDir.js";

function repo(files: Record<string, string | object>): RepoSnapshot {
    return {
        rootFiles: Object.keys(files),
        readFile: async (filePath) => {
            const content = files[filePath];
            if (content === undefined) return null;
            return typeof content === "string" ? content : JSON.stringify(content);
        },
    };
}

describe("detectBuildConfig", () => {
    test("Vite defaults to dist", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "vite build" }, devDependencies: { vite: "^6.0.0" } },
            "package-lock.json": "{}",
        }));
        expect(config).toMatchObject({
            framework: "vite",
            outputDir: "dist",
            buildCmd: "npm run build",
            packageManager: "npm",
            confidence: "high",
        });
    });

    test("Vite reads a literal build.outDir and root from vite.config", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "tsc && vite build" }, devDependencies: { vite: "^6.0.0" } },
            "vite.config.ts": `export default defineConfig({ root: 'app', build: { outDir: "public-build" } })`,
        }));
        expect(config.outputDir).toBe("app/public-build");
        expect(config.outputDirSource).toBe("vite.config.ts");
    });

    test("Vite --outDir in the build script wins over the config", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "vite build --outDir=build" }, devDependencies: { vite: "^6.0.0" } },
            "vite.config.js": `export default { build: { outDir: 'dist' } }`,
        }));
        expect(config.outputDir).toBe("build");
    });

    test("Vite with a computed outDir is low confidence", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "vite build" }, devDependencies: { vite: "^6.0.0" } },
            "vite.config.ts": `export default { build: { outDir: resolve(__dirname, 'out') } }`,
        }));
        expect(config.confidence).toBe("low");
        expect(config.warnings.length).toBeGreaterThan(0);
    });

    test("Create React App uses build, or BUILD_PATH from the script", async () => {
        const plain = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "react-scripts build" }, dependencies: { "react-scripts": "5.0.1" } },
            "yarn.lock": "",
        }));
        expect(plain).toMatchObject({ framework: "create-react-app", outputDir: "build", packageManager: "yarn", buildCmd: "yarn run build" });

        const custom = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "cross-env BUILD_PATH='./www' react-scripts build" }, dependencies: { "react-scripts": "5.0.1" } },
        }));
        expect(custom.outputDir).toBe("www");
    });

    test("prefers the framework the build script invokes when several are installed", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": {
                scripts: { build: "vite build" },
                dependencies: { "react-scripts": "5.0.1" },
                devDependencies: { vite: "^6.0.0" },
            },
        }));
        expect(config.framework).toBe("vite");
        expect(config.outputDir).toBe("dist");
    });

    test("Next.js static export uses out, and warns when not exporting", async () => {
        const exported = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "next build" }, dependencies: { next: "15.0.0" } },
            "next.config.mjs": `export default { output: 'export' }`,
        }));
        expect(exported).toMatchObject({ framework: "next-static-export", outputDir: "out", confidence: "high" });

        const server = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "next build" }, dependencies: { next: "15.0.0" } },
            "next.config.js": `module.exports = {}`,
        }));
        expect(server.confidence).toBe("low");
        expect(server.warnings.some((w) => w.includes('output: "export"'))).toBe(true);
    });

    test("Webpack reads output.path from webpack.config.js", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "webpack --mode production" }, devDependencies: { webpack: "^5.0.0" } },
            "webpack.config.js": `module.exports = { output: { filename: 'bundle.js', path: path.resolve(__dirname, 'public/build') } }`,
        }));
        expect(config.outputDir).toBe("public/build");
    });

    test("uses the packageManager field and pnpm lockfile", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { packageManager: "pnpm@9.12.0", scripts: { build: "vite build" }, devDependencies: { vite: "^6.0.0" } },
        }));
        expect(config.packageManager).toBe("pnpm");
        expect(config.buildCmd).toBe("pnpm run build");
    });

    test("rejects output directories outside the repository", async () => {
        const config = await detectBuildConfig(repo({
            "package.json": { scripts: { build: "vite build --outDir ../dist" }, devDependencies: { vite: "^6.0.0" } },
        }));
        expect(config.outputDir).toBe("dist");
        expect(config.confidence).toBe("low");
    });

    test("reports a missing package.json or build script", async () => {
        const noPackage = await detectBuildConfig(repo({ "index.html": "<html></html>" }));
        expect(noPackage).toMatchObject({ framework: "unknown", buildCmd: null, confidence: "low" });

        const noBuild = await detectBuildConfig(repo({
            "package.json": { devDependencies: { vite: "^6.0.0" } },
        }));
        expect(noBuild.buildCmd).toBeNull();
        expect(noBuild.warnings.some((w) => w.includes('"build" script'))).toBe(true);
    });
});

describe("normalizeOutputDir", () => {
    test("normalises safe relative paths", () => {
        expect(normalizeOutputDir("./dist/")).toBe("dist");
        expect(normalizeOutputDir(" build/client ")).toBe("build/client");
    });

    test("rejects empty, absolute and escaping paths", () => {
        for (const input of ["", "   ", "/etc", "../dist", "dist/../..", "a/./b", "dist;rm -rf", "a\\b"]) {
            expect(normalizeOutputDir(input)).toBeNull();
        }
    });
});
