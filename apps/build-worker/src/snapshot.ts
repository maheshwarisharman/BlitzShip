import puppeteer from 'puppeteer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const SNAPSHOT_VIEWPORT_WIDTH = 1280;
const SNAPSHOT_VIEWPORT_HEIGHT = 800;
const SNAPSHOT_TIMEOUT_MS = 30_000;
const SNAPSHOT_SETTLE_DELAY_MS = 3_000; // let CDN/animations settle before capture

/**
 * Launches a headless Chromium instance, navigates to `previewUrl`, captures
 * a fixed 1280×800 crop, and uploads the PNG to S3.
 *
 * @returns The S3 object key (e.g. `snapshots/42/snapshot.png`) — store this
 *          in the DB and generate a presigned URL on demand when serving it.
 */
export async function captureDeploymentSnapshot(
  deploymentId: number,
  previewUrl: string,
  bucket: string,
): Promise<string | null> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // avoids crashes in memory-constrained containers
      ],
    });

    const page = await browser.newPage();

    // Fixed crop viewport — always produces a consistent thumbnail size
    await page.setViewport({
      width: SNAPSHOT_VIEWPORT_WIDTH,
      height: SNAPSHOT_VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
    });

    await page.goto(previewUrl, {
      waitUntil: 'networkidle0',
      timeout: SNAPSHOT_TIMEOUT_MS,
    });

    // Brief pause for late-rendering CSS animations / font swaps
    await new Promise<void>((resolve) => setTimeout(resolve, SNAPSHOT_SETTLE_DELAY_MS));

    // Capture only the visible viewport (fullPage: false) for a consistent crop
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: SNAPSHOT_VIEWPORT_WIDTH,
        height: SNAPSHOT_VIEWPORT_HEIGHT,
      },
    });

    const s3Key = `snapshots/${deploymentId}/snapshot.png`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: screenshot,
        ContentType: 'image/png',
      }),
    );

    console.log(`[snapshot] Uploaded screenshot to s3://${bucket}/${s3Key}`);
    return s3Key;

  } catch (err) {
    console.error('[snapshot] Failed to capture deployment snapshot:', err);
    return null;
  } finally {
    await browser?.close();
  }
}
