import { prisma } from "@repo/db";
import {
  getACMCertificateStatus,
  createDistributionTenant,
} from "./awsCustomDomain.js";

/**
 * Background cron that implements the second half of the custom domain flow.
 *
 * For every PENDING domain (which has cert_arn but no tenant_id yet), it checks
 * whether the ACM certificate has been issued. When ACM status = "ISSUED", the
 * user has added the validation CNAME to their DNS, so we can safely call
 * CreateDistributionTenant with the pre-issued cert ARN — no InvalidArgument error.
 *
 * Runs every 60 seconds.
 */
async function pollACMAndActivateTenants() {
  // Only poll domains that have a pending cert but no CloudFront tenant yet
  const pendingDomains = await prisma.customDomain.findMany({
    where: {
      status: "PENDING",
      cert_arn: { not: null },
      tenant_id: null,
    },
  });

  if (pendingDomains.length === 0) return;

  console.log(`[CronJob] Checking ${pendingDomains.length} pending domain(s)...`);

  await Promise.allSettled(
    pendingDomains.map(async (domainRecord) => {
      try {
        const { status } = await getACMCertificateStatus(domainRecord.cert_arn!);

        console.log(`[CronJob] ${domainRecord.domain} → cert status: ${status}`);

        if (status !== "ISSUED") return; // Still waiting for DNS validation

        // Cert is issued — DNS is configured — safe to create the CF tenant now
        const tenantName = domainRecord.domain.replace(/[^a-zA-Z0-9.-]/g, "-");

        const { tenantId, tenantArn } = await createDistributionTenant(
          domainRecord.domain,
          tenantName,
          domainRecord.cert_arn!
        );

        await prisma.customDomain.update({
          where: { id: domainRecord.id },
          data: {
            tenant_id: tenantId,
            tenant_arn: tenantArn,
            status: "ACTIVE",
          },
        });

        console.log(`[CronJob] ✅ ${domainRecord.domain} → ACTIVE (tenant: ${tenantId})`);
      } catch (error: any) {
        console.error(`[CronJob] ❌ Error processing ${domainRecord.domain}:`, error?.message ?? error);
      }
    })
  );
}

export function TenantStatusCronJob() {
  console.log("[CronJob] ACM cert polling started (interval: 60s)");

  setInterval(async () => {
    try {
      await pollACMAndActivateTenants();
    } catch (error) {
      console.error("[CronJob] Unexpected error:", error);
    }
  }, 60_000); // 60 seconds
}