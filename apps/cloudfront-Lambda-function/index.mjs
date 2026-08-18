import { neon } from '@neondatabase/serverless';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Module-level cache — persists across warm invocations
const cache = new Map();
const CACHE_TTL_MS = 90_000; // 90 seconds

const PLATFORM_DOMAIN = 'dev.blitznative.com';
let DB_URL;

async function getDBUrl() {
    if (DB_URL) return DB_URL;
    
    const ssm = new SSMClient({ region: 'us-east-1' });
    const { Parameter } = await ssm.send(new GetParameterCommand({
        Name: '/devblitznative/DATABASE_URL',
        WithDecryption: true
    }));
    DB_URL = Parameter.Value;
    return DB_URL;
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

async function getDeploymentId(sql, type, value) {
    const cacheKey = `${type}:${value}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let deploymentId;

    if (type === 'slug') {
        const rows = await sql`
            SELECT deployment_id
            FROM "Domain"
            WHERE domain_url = ${value}
            AND deployment_id IS NOT NULL
            LIMIT 1
        `;
        deploymentId = rows[0]?.deployment_id;
    } else {
        const rows = await sql`
            SELECT deployment_id
            FROM "CustomDomain"
            WHERE domain = ${value}
            AND status = 'ACTIVE'
            AND deployment_id IS NOT NULL
            LIMIT 1
        `;
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
    const url = await getDBUrl();
    const request = event.Records[0].cf.request;
    const host = request.headers.host[0].value;
    const uri = request.uri;
    const sql = neon(url);

    // PATH 1: raw deployment ID — host is like "14.dev.blitznative.com"
    const subdomain = host.split('.')[0];
    const isRawDeploymentId = /^\d+$/.test(subdomain) && host.endsWith(PLATFORM_DOMAIN);

    if (isRawDeploymentId) {
        request.uri = rewriteUri(uri, subdomain);
        return request;
    }

    // PATH 2: named slug — "userapp.dev.blitznative.comn"
    const isOurDomain = host.endsWith(PLATFORM_DOMAIN);

    if (isOurDomain) {
        const deploymentId = await getDeploymentId(sql, 'slug', subdomain);
        if (!deploymentId) return { status: '404', body: 'Project not found' };
        request.uri = rewriteUri(uri, deploymentId);
        return request;
    }

    // PATH 3: fully custom domain 
    const deploymentId = await getDeploymentId(sql, 'domain', host);
    if (!deploymentId) return { status: '404', body: 'Domain not found' };
    request.uri = rewriteUri(uri, deploymentId);
    return request;
};