import {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  DeleteCertificateCommand,
} from "@aws-sdk/client-acm";
import {
  CloudFrontClient,
  CreateDistributionTenantCommand,
  GetDistributionTenantCommand,
  DeleteDistributionTenantCommand,
} from "@aws-sdk/client-cloudfront";

const acm = new ACMClient({ region: "us-east-1" });
const cloudfront = new CloudFrontClient({ region: "us-east-1" });

const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DISTRIBUTION_DOMAIN!;


// ─── ACM Certificate Management ───────────────────────────────────

/**
 * Step 1 of the custom domain flow.
 * Requests an ACM certificate for the given domain using DNS validation.
 * Returns the cert ARN and the CNAME validation record the user must add to their DNS.
 *
 * The user must add TWO records to their DNS:
 *   1. The ACM validation CNAME (proves domain ownership to AWS)
 *   2. A CNAME pointing the domain to our CloudFront distribution (routes traffic)
 *
 * Once ACM detects the validation record and issues the cert, the background cron
 * will automatically create the CloudFront Distribution Tenant.
 */
export async function requestACMCertificate(domain: string): Promise<{
  certArn: string;
  validationRecord: { name: string; value: string };
  cloudfrontCname: string;
}> {
  // Request the certificate
  const requestCmd = new RequestCertificateCommand({
    DomainName: domain,
    ValidationMethod: "DNS",
    IdempotencyToken: domain.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32),
  });

  const { CertificateArn } = await acm.send(requestCmd);

  if (!CertificateArn) {
    throw new Error("ACM did not return a certificate ARN");
  }

  // ACM may take a moment to populate DomainValidationOptions — poll briefly
  let validationRecord: { name: string; value: string } | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const describeCmd = new DescribeCertificateCommand({ CertificateArn });
    const { Certificate } = await acm.send(describeCmd);
    const record = Certificate?.DomainValidationOptions?.[0]?.ResourceRecord;

    if (record?.Name && record?.Value) {
      validationRecord = { name: record.Name, value: record.Value };
      break;
    }

    // Wait 1s between polls
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!validationRecord) {
    throw new Error("ACM did not return a DNS validation record in time");
  }

  return {
    certArn: CertificateArn,
    validationRecord,
    cloudfrontCname: CLOUDFRONT_DOMAIN,
  };
}

/**
 * Describes an ACM certificate and returns its current status.
 * Used by the background cron to decide when to create the CF tenant.
 */
export async function getACMCertificateStatus(certArn: string): Promise<{
  status: string;
}> {
  const { Certificate } = await acm.send(
    new DescribeCertificateCommand({ CertificateArn: certArn })
  );

  return { status: Certificate?.Status ?? "UNKNOWN" };
}

/**
 * Deletes an ACM certificate. Called on domain removal.
 */
export async function deleteACMCertificate(certArn: string): Promise<void> {
  try {
    await acm.send(new DeleteCertificateCommand({ CertificateArn: certArn }));
  } catch (err: any) {
    // Ignore if already deleted
    if (err?.name !== "ResourceNotFoundException") throw err;
  }
}


// ─── Distribution Tenant Management ───────────────────────────────

/**
 * Step 2 of the custom domain flow (called by background cron, NOT the API).
 * Creates a CloudFront Distribution Tenant using a pre-issued ACM cert ARN.
 * This avoids the InvalidArgument error caused by calling CreateDistributionTenant
 * before the domain's DNS is configured.
 */
export async function createDistributionTenant(
  domain: string,
  tenantName: string,
  certArn: string
): Promise<{ tenantId: string; tenantArn: string }> {
  const command = new CreateDistributionTenantCommand({
    DistributionId: DISTRIBUTION_ID,
    Name: tenantName,
    Domains: [{ Domain: domain }],
    Enabled: true,

    // Use the pre-issued certificate ARN instead of ManagedCertificateRequest.
    // ManagedCertificateRequest requires the domain to already point to CloudFront,
    // which we can't guarantee at tenant-creation time.
    Customizations: {
      Certificate: {
        Arn: certArn,
      },
    },
  });

  const response = await cloudfront.send(command);
  const tenant = response.DistributionTenant;

  if (!tenant?.Id) {
    throw new Error("CloudFront did not return a tenant ID");
  }

  return {
    tenantId: tenant.Id,
    tenantArn: tenant.Arn ?? "",
  };
}

/**
 * Get the current status of a distribution tenant and its domain(s).
 */
export async function getDistributionTenantStatus(tenantId: string) {
  const command = new GetDistributionTenantCommand({ Identifier: tenantId });
  const response = await cloudfront.send(command);
  const tenant = response.DistributionTenant;

  if (!tenant) throw new Error("Tenant not found");

  return {
    status: tenant.Status,
    enabled: tenant.Enabled,
    domains: tenant.Domains?.map((d) => ({
      domain: d.Domain,
      status: d.Status,
    })),
  };
}

/**
 * Delete a distribution tenant (when a user removes a custom domain).
 */
export async function deleteDistributionTenant(
  tenantId: string,
  ifMatch?: string
): Promise<void> {
  await cloudfront.send(
    new DeleteDistributionTenantCommand({
      Id: tenantId,
      IfMatch: ifMatch ?? "*",
    })
  );
}
