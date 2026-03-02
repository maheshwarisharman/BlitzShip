/*
  Warnings:

  - You are about to drop the `Project_ENV_Variables` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `project_env` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Project_ENV_Variables" DROP CONSTRAINT "Project_ENV_Variables_project_id_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "project_env" JSONB NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- DropTable
DROP TABLE "Project_ENV_Variables";
