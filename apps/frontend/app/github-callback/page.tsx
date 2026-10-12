"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import axios, { AxiosError } from "axios"
import { Github, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "loading" | "success" | "error"

// ─── Inner component (needs useSearchParams, must be inside Suspense) ─────────

function GithubCallbackInner() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { getToken, isLoaded, isSignedIn } = useAuth()

    const [status, setStatus] = useState<Status>("loading")
    const [errorMessage, setErrorMessage] = useState<string>("")

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        const code = searchParams.get("code")

        if (!code) {
            setErrorMessage("No authorization code was provided by GitHub. Please try again.")
            setStatus("error")
            return
        }

        const exchangeCode = async () => {
            try {
                let token = await getToken()
                if (!token) {
                    await new Promise((resolve) => setTimeout(resolve, 300))
                    token = await getToken()
                }
                if (!token) {
                    setErrorMessage("Authentication session not ready. Please refresh.")
                    setStatus("error")
                    return
                }

                await axios.post(
                    `${API_BASE_URL}/github/auth/callback`,
                    { code },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                )

                setStatus("success")

                // Give the user a moment to read the success state, then forward to dashboard.
                setTimeout(() => router.push("/dashboard"), 1800)

            } catch (err) {
                const axiosError = err as AxiosError<{ error?: string }>
                const message =
                    axiosError.response?.data?.error ??
                    "GitHub authentication failed. Please try again."
                setErrorMessage(message)
                setStatus("error")
            }
        }

        exchangeCode()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, isSignedIn])

    return (
        <div className="flex flex-col items-center justify-center gap-6 text-center">
            {status === "loading" && (
                <>
                    <div className="relative">
                        <Github className="w-12 h-12 text-foreground" />
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin absolute -bottom-1 -right-1" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-semibold tracking-tight">Linking your GitHub account</h1>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Exchanging authorization code with GitHub. This only takes a moment…
                        </p>
                    </div>
                </>
            )}

            {status === "success" && (
                <>
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-semibold tracking-tight">GitHub linked successfully!</h1>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Your GitHub account is now connected. Redirecting you to the dashboard…
                        </p>
                    </div>
                </>
            )}

            {status === "error" && (
                <>
                    <XCircle className="w-12 h-12 text-red-500" />
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
                        <p className="text-sm text-muted-foreground max-w-xs">{errorMessage}</p>
                    </div>
                    <Button
                        onClick={() => router.push("/dashboard")}
                        className="mt-2 h-9 px-5 bg-foreground text-background hover:bg-neutral-200 font-medium"
                    >
                        Back to Dashboard
                    </Button>
                </>
            )}
        </div>
    )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
// useSearchParams() requires a Suspense boundary in Next.js App Router.

export default function GithubCallbackPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-10 shadow-sm">
                <Suspense
                    fallback={
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        </div>
                    }
                >
                    <GithubCallbackInner />
                </Suspense>
            </div>
        </main>
    )
}
