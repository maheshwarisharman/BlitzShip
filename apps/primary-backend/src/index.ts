import express, { Express, Request, Response } from "express";
import cors from "cors";
import { prisma } from "@repo/db";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";

// v1 Routes
import githubRoutes from "./routes/githubRoutes.js";
import deployProjectRoutes from "./routes/deployProject.js";
import domainRoutes from "./routes/domainRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import { ACMCronJob } from "./handlers/acmCertCron.js";

const app: Express = express();

app.use(cors({
  origin: "*"
}));
app.use(express.json());

app.use(clerkMiddleware());

// Start the ACM Polling Cron Job
ACMCronJob();

app.get("/health", async (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Server is healthy",
  });
});


app.post("/add-user", requireAuth(), async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { email, name } = req.body as { email?: string; name?: string };

    if (!email || !name) {
      return res.status(400).json({
        message: "email and name are required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: clerkUserId,
      },
    });

    if (existingUser) {
      return res.status(200).json({
        message: "User already exists",
        data: existingUser,
      });
    }

    const user = await prisma.user.create({
      data: {
        id: clerkUserId,
        email,
        name,
        github_username: null,
        github_user_id: null,
        github_installation_id: null,
      },
    });

    return res.status(200).json({
      message: "User added successfully",
      data: user,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Some Error Occurred",
      error: e,
    });
  }
});

// Protected API routes
app.use("/github", githubRoutes);
app.use("/deploy", requireAuth(), deployProjectRoutes);
app.use("/domain", requireAuth(), domainRoutes);
app.use("/projects", requireAuth(), projectRoutes);

app.listen(4000, () => {
  console.log("Server is running on port 4000");
});
