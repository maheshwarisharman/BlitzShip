import pg from 'pg';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const { Pool } = pg;

// ── In-memory caches — persist across warm invocations of the SAME container ──
const cache = new Map();
const CACHE_TTL_MS = 90_000; // 90 seconds

const PLATFORM_DOMAIN = 'blitzship.app';

let DB_URL;
let pool; // one Pool per warm container, not per invocation

async function getDBUrl() {
    if (DB_URL) return DB_URL;

    const ssm = new SSMClient({ region: 'us-east-1' });
    const { Parameter } = await ssm.send(new GetParameterCommand({
        Name: '/devblitzship/DATABASE_URL', // must now point at your Aiven connection string
        WithDecryption: true
    }));
    DB_URL = Parameter.Value;
    return DB_URL;
}

/**
 * Returns a singleton pg Pool, created once per warm Lambda container.
 * max: 1-2 — keep this LOW. Each concurrent Lambda@Edge container gets its
 * own pool, and containers multiply across edge locations under load.
 * The real fix for connection volume is Aiven's connection-pool endpoint,
 * not a bigger `max` here.
 */
async function getPool() {
    if (pool) return pool;

    const connectionString = await getDBUrl();

    pool = new Pool({
        connectionString,
        ssl: {
            // Preferred: verify against Aiven's CA cert (download it from the
            // Aiven console → your service → "CA certificate", bundle it into
            // the deployment package, and load it here):
            //
            //   import { readFileSync } from 'fs';
            //   ca: readFileSync(new URL('./aiven-ca.pem', import.meta.url), 'utf8'),
            //   rejectUnauthorized: true,
            //
            // Fallback if you don't want to bundle the cert (weaker — accepts
            // any TLS cert, so you lose MITM protection, but connection is
            // still encrypted):
            rejectUnauthorized: false,
        },
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });

    // Without this, an idle client error (dropped connection, etc.) throws an
    // unhandled 'error' event and can crash the Node process mid-invocation.
    pool.on('error', (err) => {
        console.error('Unexpected idle pg client error:', err);
    });

    return pool;
}

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.deploymentId;
}

function setCache(key, deploymentId) {
    cache.set(key, { deploymentId, cachedAt: Date.now() });
}

async function getDeploymentId(dbPool, type, value) {
    const cacheKey = `${type}:${value}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let deploymentId;

    if (type === 'slug') {
        const { rows } = await dbPool.query(
            `SELECT deployment_id
             FROM "Domain"
             WHERE domain_url = $1
             AND deployment_id IS NOT NULL
             LIMIT 1`,
            [value]
        );
        deploymentId = rows[0]?.deployment_id;
    } else {
        const { rows } = await dbPool.query(
            `SELECT deployment_id
             FROM "CustomDomain"
             WHERE domain = $1
             AND status = 'ACTIVE'
             AND deployment_id IS NOT NULL
             LIMIT 1`,
            [value]
        );
        deploymentId = rows[0]?.deployment_id;
    }

    if (deploymentId) setCache(cacheKey, deploymentId);
    return deploymentId;
}

function rewriteUri(uri, deploymentId) {
    // SPA fallback — no extension = serve index.html
    if (uri === '/' || uri === '' || !uri.includes('.')) {
        return `/deployments/${deploymentId}/index.html`;
    }
    return `/deployments/${deploymentId}${uri}`;
}

export const handler = async (event) => {
    const dbPool = await getPool();
    const request = event.Records[0].cf.request;
    const host = request.headers.host[0].value;
    const uri = request.uri;

    // PATH 1: raw deployment ID — host is like "14.blitzship.app"
    const subdomain = host.split('.')[0];
    const isRawDeploymentId = /^\d+$/.test(subdomain) && host.endsWith(PLATFORM_DOMAIN);

    if (isRawDeploymentId) {
        request.uri = rewriteUri(uri, subdomain);
        return request;
    }

    // PATH 2: named slug — "userapp.blitzship.app"
    const isOurDomain = host.endsWith(PLATFORM_DOMAIN);

    if (isOurDomain) {
        const deploymentId = await getDeploymentId(dbPool, 'slug', subdomain);
        if (!deploymentId) return { status: '404', body: 'Project not found' };
        request.uri = rewriteUri(uri, deploymentId);
        return request;
    }

    // PATH 3: fully custom domain
    const deploymentId = await getDeploymentId(dbPool, 'domain', host);
    if (!deploymentId) return { status: '404', body: 'Domain not found' };
    request.uri = rewriteUri(uri, deploymentId);
    return request;
};
