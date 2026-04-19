import { Router } from "express";
import { prisma } from "@repo/db";
import {
  requestACMCertificate,
  deleteACMCertificate,
  deleteDistributionTenant,
} from "../handlers/awsCustomDomain.js";

const router: Router = Router();

/**
 * POST /custom-domain/add-new-domain
 *
 * Registers a custom domain. Calls ACM to request a certificate using DNS
 * validation and returns two DNS records for the user to configure:
 *   1. An ACM validation CNAME (proves ownership to AWS, triggers cert issuance)
 *   2. A CNAME pointing the domain to our CloudFront distribution (routes traffic)
 *
 * Once the user adds both records, the background cron detects the cert is ISSUED
 * and automatically creates the CloudFront Distribution Tenant — no further
 * action required from the user.
 */
router.post("/add-new-domain", async (req, res) => {
  try {
    const { domain, project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: "project_id is required" });
    }

    if (!isValidDomain(domain)) {
      return res.status(400).json({ message: "Invalid domain format" });
    }

    const sanitizedDomain = sanitizeDomain(domain);

    // Step 1: Request ACM certificate. Returns the DNS validation CNAME that
    // the user must add to their registrar — this does NOT require any traffic
    // routing to be in place yet.
    const { certArn, validationRecord, cloudfrontCname } =
      await requestACMCertificate(sanitizedDomain);

    // Save the domain as PENDING with the cert ARN. The cron will watch the
    // cert status and create the CF tenant once it flips to ISSUED.
    await prisma.customDomain.create({
      data: {
        domain: sanitizedDomain,
        project_id: Number(project_id),
        cert_arn: certArn,
        status: "PENDING",
      },
    });

    return res.status(200).json({
      success: true,
      message: `Domain ${sanitizedDomain} registered. Add the DNS records below to activate it.`,
      dns_records: [
        {
          purpose: "SSL Certificate Validation (required first)",
          type: "CNAME",
          name: validationRecord.name,
          value: validationRecord.value,
        },
        {
          purpose: "Route traffic to your deployment",
          type: "CNAME",
          name: sanitizedDomain,
          value: cloudfrontCname,
        },
      ],
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Domain already exists" });
    }

    console.error("Error adding custom domain:", error);
    return res.status(500).json({
      message: "Some error occurred",
      error: error?.message ?? error,
    });
  }
});

/**
 * GET /custom-domain/list/:project_id
 *
 * Lists all custom domains for a project with their current status.
 */
router.get("/list/:project_id", async (req, res) => {
  const projectId = Number(req.params.project_id);

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project_id" });
  }

  try {
    const domains = await prisma.customDomain.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        domain: true,
        project_id: true,
        status: true,
        tenant_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(200).json({ success: true, data: domains });
  } catch (error) {
    return res.status(500).json({ message: "Some error occurred", error });
  }
});

/**
 * DELETE /custom-domain/remove/:domain_id
 *
 * Removes a custom domain. Cleans up both the ACM certificate and the
 * CloudFront Distribution Tenant (if already created).
 */
router.delete("/remove/:domain_id", async (req, res) => {
  try {
    const { domain_id } = req.params;

    const customDomain = await prisma.customDomain.findUnique({
      where: { id: domain_id },
    });

    if (!customDomain) {
      return res.status(404).json({ message: "Domain not found" });
    }

    // Clean up CloudFront tenant (if tenant was already created)
    if (customDomain.tenant_id) {
      try {
        await deleteDistributionTenant(customDomain.tenant_id);
      } catch (err: any) {
        console.warn(`Could not delete CF tenant ${customDomain.tenant_id}:`, err.message);
      }
    }

    // Clean up ACM certificate
    if (customDomain.cert_arn) {
      try {
        await deleteACMCertificate(customDomain.cert_arn);
      } catch (err: any) {
        console.warn(`Could not delete ACM cert ${customDomain.cert_arn}:`, err.message);
      }
    }

    await prisma.customDomain.delete({ where: { id: domain_id } });

    return res.status(200).json({ success: true, message: "Domain removed successfully" });
  } catch (error) {
    console.error("Error removing custom domain:", error);
    return res.status(500).json({ message: "Some error occurred", error });
  }
});


// ─── Helpers ──────────────────────────────────────────────────────

function isValidDomain(domain: string): boolean {
  const domainRegex =
    /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

function sanitizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export default router;
