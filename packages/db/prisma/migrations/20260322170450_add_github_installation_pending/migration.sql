-- CreateTable
CREATE TABLE "GithubInstallationPending" (
    "github_username" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubInstallationPending_pkey" PRIMARY KEY ("github_username")
);
