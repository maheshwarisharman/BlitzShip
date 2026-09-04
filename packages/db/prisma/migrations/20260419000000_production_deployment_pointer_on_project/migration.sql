-- AlterTable: Add production_deployment_id to Project
ALTER TABLE "Project" ADD COLUMN "production_deployment_id" INTEGER;

-- Migrate existing production deployments into Project.production_deployment_id
UPDATE "Project" p
SET "production_deployment_id" = d."deployment_id"
FROM "Deployment" d
WHERE d."project_id" = p."project_id" AND d."is_production" = true;

-- AlterTable: Drop is_production from Deployment
ALTER TABLE "Deployment" DROP COLUMN IF EXISTS "is_production";

-- CreateIndex
CREATE UNIQUE INDEX "Project_production_deployment_id_key" ON "Project"("production_deployment_id");

-- Update ForeignKey for Project.production_deployment_id
ALTER TABLE "Project" ADD CONSTRAINT "Project_production_deployment_id_fkey" FOREIGN KEY ("production_deployment_id") REFERENCES "Deployment"("deployment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update ForeignKey on Deployment to Cascade delete with Project
ALTER TABLE "Deployment" DROP CONSTRAINT IF EXISTS "Deployment_project_id_fkey";
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
