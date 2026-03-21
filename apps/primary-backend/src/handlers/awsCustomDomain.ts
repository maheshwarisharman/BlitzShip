import { ACMClient, RequestCertificateCommand, DescribeCertificateCommand } from "@aws-sdk/client-acm";
import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } from "@aws-sdk/client-cloudfront";


const acm = new ACMClient({ region: "us-east-1" });
const cloudfront = new CloudFrontClient({ region: "us-east-1" });


export async function requestCertificate(domain: string): Promise<string> {
  const command = new RequestCertificateCommand({
    DomainName: domain,
    ValidationMethod: "DNS",
    Tags: [{ Key: "platform", Value: "myplatform" }]
  }); 

  const response = await acm.send(command); 

  if (!response.CertificateArn) {
    throw new Error("ACM did not return a CertificateArn");
  } 

  return response.CertificateArn;
}

export async function attachDomainToCloudFront(domain: string, certArn: string) {
  const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

  const { DistributionConfig, ETag } = await cloudfront.send(
    new GetDistributionConfigCommand({ Id: DISTRIBUTION_ID })
  );

  if (!DistributionConfig || !ETag) throw new Error("Could not fetch distribution config");

  const existingAliases = DistributionConfig.Aliases?.Items ?? [];

  if (existingAliases.includes(domain)) return;

  const newAliases = [...existingAliases, domain];

  //Update distribution
  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: DISTRIBUTION_ID,
      IfMatch: ETag, // optimistic locking — prevents race conditions
      DistributionConfig: {
        ...DistributionConfig,
        Aliases: {
          Quantity: newAliases.length,
          Items: newAliases,
        },
        ViewerCertificate: {
          ACMCertificateArn: certArn,
          SSLSupportMethod: "sni-only",
          MinimumProtocolVersion: "TLSv1.2_2021",
        },
      },
    })
  );
}


export async function getCertificateDetails(certArn: string) {
  const command = new DescribeCertificateCommand({ CertificateArn: certArn });
  const response = await acm.send(command);
  const cert = response.Certificate;

  if (!cert) throw new Error("Certificate not found");

  const validation = cert.DomainValidationOptions?.[0];
  const cnameKey   = validation?.ResourceRecord?.Name;
  const cnameValue = validation?.ResourceRecord?.Value;

  return {
    status: cert.Status,        // "PENDING_VALIDATION" | "ISSUED" | "FAILED"
    cnameKey,                   // _abc123.myapp.com
    cnameValue,                 // _xyz.acm.aws
  };
}