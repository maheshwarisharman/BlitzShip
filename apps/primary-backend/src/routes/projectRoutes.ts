import { Router } from "express";
import { prisma } from "@repo/db";
import { getAuth } from "@clerk/express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { encryptEnvMap } from "@repo/env-crypto";

const router: Router = Router();

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET!;
const SNAPSHOT_PRESIGN_TTL_SECONDS = 60 * 60; // 1 hour

router.get("/all", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth.userId;

  if (!clerkUserId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        user_id: clerkUserId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    // Never return encrypted env values to the client
    const safeProjects = projects.map((p) => ({ ...p, project_env: undefined }));
    res.status(200).json({
      message: "Projects fetched successfully",
      data: safeProjects,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Some error occured",
      error: e,
    });
  }
});

router.post("/single", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth.userId;

  if (!clerkUserId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!req.body.project_id) {
    return res.status(401).json({
      message: "project_id is required",
    });
  }

  try {
    const project = await prisma.project.findUnique({
      where: {
        project_id: req.body.project_id,
      },
      include: {
        deployments: true,
        production_deployment: true,
      },
    });
    if (!project || project.user_id !== clerkUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // Generate presigned URLs for any deployment that has a snapshot S3 key
    const deploymentsWithSnapshots = await Promise.all(
      project.deployments.map(async (dep) => {
        
        let snapshot_url: string | null = null;
        if (dep.snapshot_url) {
          snapshot_url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: dep.snapshot_url }),
            { expiresIn: SNAPSHOT_PRESIGN_TTL_SECONDS },
          );
        }
        return {
          ...dep,
          snapshot_url,
          is_production: dep.deployment_id === project.production_deployment_id,
        };
      })
    );

    // Also presign the snapshot for the production_deployment object itself
    let productionDeployment = project.production_deployment;
    if (productionDeployment?.snapshot_url) {
      const presignedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: productionDeployment.snapshot_url }),
        { expiresIn: SNAPSHOT_PRESIGN_TTL_SECONDS },
      );
      productionDeployment = { ...productionDeployment, snapshot_url: presignedUrl };
    }

    const projectData = {
      ...project,
      project_env: undefined, // Never return encrypted env values to the client
      production_deployment: productionDeployment,
      deployments: deploymentsWithSnapshots
        .sort((a, b) => Number(a.is_production) - Number(b.is_production)),
    };

    res.status(200).json({
      message: "Project fetched successfully",
      data: projectData,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Some error occured",
      error: e,
    });
  }
});

router.put("/env", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth.userId;

  if (!clerkUserId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { project_id, env } = req.body;

  if (!project_id) {
    return res.status(400).json({
      message: "project_id is required",
    });
  }

  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return res.status(400).json({
      message: "env must be a valid key-value object",
    });
  }

  try {
    // Verify ownership before updating
    const project = await prisma.project.findUnique({
      where: { project_id },
      select: { user_id: true },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (project.user_id !== clerkUserId) {
      return res.status(403).json({
        message: "Forbidden: you do not own this project",
      });
    }

    const encryptedEnv = encryptEnvMap(env as Record<string, string>);

    const updated = await prisma.project.update({
      where: { project_id },
      data: { project_env: encryptedEnv },
    });

    res.status(200).json({
      message: "Environment variables updated successfully",
      // Return key names only — never echo encrypted or plaintext values
      data: { project_id: updated.project_id, env_keys: Object.keys(encryptedEnv) },
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Some error occured",
      error: e,
    });
  }
});

router.delete("/delete", async (req, res) => {
  try {
    const projectId = req.body.project_id;

    // Unlink production_deployment_id first to prevent FK constraint on deployment deletion,
    // then delete related records and the project atomically
    const [, , , project] = await prisma.$transaction([
      prisma.project.update({
        where: { project_id: projectId },
        data: { production_deployment_id: null },
      }),
      prisma.deployment.deleteMany({
        where: { project_id: projectId },
      }),
      prisma.customDomain.deleteMany({
        where: { project_id: projectId },
      }),
      prisma.project.delete({
        where: {
          project_id: projectId,
        },
      }),
    ]);

    res.status(200).json({
      message: "Project deleted successfully",
      data: project,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Some error occured",
      error: e,
    });
  }
});

export default router;
