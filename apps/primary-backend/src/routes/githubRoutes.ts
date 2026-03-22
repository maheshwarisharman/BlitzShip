import { Request, Response, Router } from "express";
import axios from 'axios'
import { prisma } from '@repo/db'
import jwt from 'jsonwebtoken'
import { getAuth, requireAuth } from "@clerk/express"

const router: Router = Router()

interface InstallationTokenResponse {
    token: string
    expires_at: string
}

// ─── JWT Generation ──────────────────────────────────────────────────
/**
 * Creates a short-lived JWT (10 min) signed with the GitHub App's private key.
 * This JWT is used to authenticate as the App itself when calling GitHub APIs.
 */
function generateAppJWT(): string {
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!appId || !privateKey) {
        throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set')
    }

    const now = Math.floor(Date.now() / 1000)

    const payload = {
        iat: now - 60,       // Issued at time (60s in past to account for clock drift)
        exp: now + (10 * 60), // Expiration time (10 minutes)
        iss: appId            // Issuer (GitHub App ID)
    }

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' })
}

// ─── Installation Access Token ───────────────────────────────────────
/**
 * Exchanges the App JWT for a short-lived Installation Access Token (1hr).
 * This token is scoped to the repos the user granted access to during installation.
 */
async function getInstallationAccessToken(installationId: string): Promise<string> {
    const appJWT = generateAppJWT()

    const response = await axios.post<InstallationTokenResponse>(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {},
        {
            headers: {
                Authorization: `Bearer ${appJWT}`,
                Accept: 'application/vnd.github.v3+json'
            }
        }
    )

    return response.data.token
}

// ─── Routes ──────────────────────────────────────────────────────────

/*
 * POST /auth/callback - GitHub OAuth Callback
 * Receives the authorization code and user_id from the frontend after the user
 * approves the GitHub OAuth prompt. Exchanges the code for an access token,
 * fetches the user's GitHub profile, and updates the existing user row.
 *
 * Expects: { user_id: string, code: string }
 */
router.post('/auth/callback', requireAuth(), async (req: Request, res: Response) => {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
        return res.status(401).json({
            message: "Unauthorized",
        });
    }
    const { code } = req.body

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'user_id and code are required'
        })
    }

    try {
        // 1. Exchange the authorization code for an access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
                client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
                code
            },
            {
                headers: { Accept: 'application/json' }
            }
        )

        const accessToken = tokenResponse.data.access_token

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired authorization code'
            })
        }

        // 2. Fetch the user's GitHub profile using the access token
        const ghUser = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        })

        const githubUsername: string = ghUser.data.login
        const githubUserId: string = String(ghUser.data.id)

        // 3. Check for a pending installation that arrived before this OAuth flow completed.
        //    This handles the race condition where GitHub fires the `installation` webhook
        //    before we have had a chance to write github_username to the User row.
        const pendingInstallation = await prisma.githubInstallationPending.findUnique({
            where: { github_username: githubUsername }
        })

        if (pendingInstallation) {
            console.log(`[github-oauth] Found pending installation ${pendingInstallation.installation_id} for ${githubUsername} — merging`)
        }

        // 4. Write GitHub identity (and optionally merge the pending installation_id)
        //    in a single atomic update so there is no window where github_username is
        //    set but github_installation_id is not.
        const user = await prisma.user.update({
            where: { id: clerkUserId },
            data: {
                github_username: githubUsername,
                github_user_id: githubUserId,
                ...(pendingInstallation
                    ? { github_installation_id: pendingInstallation.installation_id }
                    : {})
            }
        })

        // 5. Clean up the pending buffer row now that the user row is fully linked.
        if (pendingInstallation) {
            await prisma.githubInstallationPending.delete({
                where: { github_username: githubUsername }
            })
            console.log(`[github-oauth] Pending installation ${pendingInstallation.installation_id} merged and cleaned up for user ${clerkUserId}`)
        }

        console.log(`[github-oauth] Linked GitHub user ${githubUsername} (id: ${githubUserId}) to user ${clerkUserId}`)

        return res.status(200).json({
            success: true,
            data: {
                github_username: user.github_username,
                github_user_id: user.github_user_id
            }
        })

    } catch (e) {
        console.error('[github-oauth] Error during authentication:', e)
        return res.status(500).json({
            success: false,
            error: 'GitHub authentication failed'
        })
    }
})


router.get('/is-github-linked', requireAuth(), async(req: Request, res: Response) => {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;


    if (!clerkUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    try {

        const user = await prisma.user.findUnique({
            where: {
                id: clerkUserId
            },
        })
        if(!user) {
            return res.status(404).json({message: "No User Found"})
        }

        if(user.github_user_id) {
            return res.status(200).json({
                message: "User is github linked",
                success: true
            })
        } else {
            return res.status(200).json({
                success: false,
                message: "user's github is not linked"
            })
        }

    } catch (e) {
        return res.status(500).json({
            message: "Some Internal Server Error Occuered",
            error: e
        })
    }
})

/*
 * POST /webhook - GitHub App Webhook Handler
 * Receives installation events when users install/uninstall the GitHub App.
 * Stores the installation_id linked to the user for future token generation.
 */
router.post('/webhook', async (req: Request, res: Response) => {
    const event = req.headers['x-github-event'] as string
    const { action, installation, sender } = req.body

    try {
        // We only care about installation-related events
        if (event === 'installation') {
            const installationId = String(installation.id)
            const githubUsername = sender.login as string

            if (action === 'created') {
                console.log(`[github-app] Installation created by ${githubUsername}, installation_id: ${installationId}`)

                // ── Fast path: user already completed OAuth (e.g. re-installing the app).
                //    Try to update the User row directly using github_username as the key.
                //    github_username is set by /auth/callback and is unique per user.
                const result = await prisma.user.updateMany({
                    where:  { github_username: githubUsername },
                    data:   { github_installation_id: installationId }
                })

                if (result.count > 0) {
                    // Found and updated the user — we're done.
                    console.log(`[github-app] Installation recorded directly for ${githubUsername}`)
                    return res.status(200).json({ success: true, message: 'Installation recorded' })
                }

                // ── Slow path: /auth/callback hasn't written github_username yet (race condition).
                //    Upsert into the pending buffer so /auth/callback can merge it later.
                //    Upsert handles the case where a previous install event already exists
                //    (e.g. GitHub retries the webhook delivery).
                await prisma.githubInstallationPending.upsert({
                    where:  { github_username: githubUsername },
                    update: { installation_id: installationId },
                    create: { github_username: githubUsername, installation_id: installationId }
                })

                console.log(`[github-app] No linked user found for ${githubUsername} yet — stored in pending buffer`)
                return res.status(200).json({ success: true, message: 'Installation pending user link' })
            }

            if (action === 'deleted') {
                console.log(`[github-app] Installation deleted by ${githubUsername}, installation_id: ${installationId}`)

                // Remove the installation from the User row.
                await prisma.user.updateMany({
                    where: { github_installation_id: installationId },
                    data:  { github_installation_id: null }
                })

                // Also purge any orphaned pending record for this username.
                // This guards against the edge case where a user installed → webhook fired
                // → was stored in pending → then immediately uninstalled before OAuth finished.
                await prisma.githubInstallationPending.deleteMany({
                    where: { github_username: githubUsername }
                })

                console.log(`[github-app] Installation removed for ${githubUsername}`)
                return res.status(200).json({ success: true, message: 'Installation removed' })
            }
        }

        // Acknowledge all other events with a 200 so GitHub does not retry them.
        return res.status(200).json({ success: true, message: 'Event received' })

    } catch (e) {
        console.error('[github-app] Webhook processing error:', e)
        return res.status(500).json({
            success: false,
            error: 'Internal server error processing webhook'
        })
    }
})

/*
 * GET /get-repos - Fetch user's GitHub repos using a GitHub App Installation Access Token.
 */
router.get('/get-repos', async (req: Request, res: Response) => {

    //TODO: Extract user_id from authorization token in request headers
    const userId = req.query.user_id as string

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'user_id query parameter is required'
        })
    }

    try {
        // 1. Get the user's installation_id from DB
        const user = await prisma.user.findUnique({
            where: { id: userId }
        })

        if (!user?.github_installation_id) {
            return res.status(404).json({
                success: false,
                error: 'GitHub App is not installed for this user. Please install the app first.'
            })
        }

        // 2. Generate a fresh installation access token (short-lived, 1hr)
        const accessToken = await getInstallationAccessToken(user.github_installation_id)

        // 3. Fetch repos using the installation token
        const repos = await axios.get('https://api.github.com/installation/repositories', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        })

        return res.status(200).json({
            success: true,
            data: repos.data.repositories
        })

    } catch (e) {
        console.error('[github-app] Error fetching repos:', e)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch repositories'
        })
    }
})

/*
 * GET /installation-token - Generate a fresh Installation Access Token
 * Used by other services (e.g., build-worker) that need to clone private repos.
 * Returns a short-lived token (1hr) that can be used for git clone authentication.
 */
router.get('/installation-token', async (req: Request, res: Response) => {

    const userId = req.query.user_id as string

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'user_id query parameter is required'
        })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        })

        if (!user?.github_installation_id) {
            return res.status(404).json({
                success: false,
                error: 'GitHub App is not installed for this user'
            })
        }

        const accessToken = await getInstallationAccessToken(user.github_installation_id)

        return res.status(200).json({
            success: true,
            data: {
                token: accessToken,
                expires_in_seconds: 3500
            }
        })

    } catch (e) {
        console.error('[github-app] Error generating installation token:', e)
        return res.status(500).json({
            success: false,
            error: 'Failed to generate installation access token'
        })
    }
})

export default router