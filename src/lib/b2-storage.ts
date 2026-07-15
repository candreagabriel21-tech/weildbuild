// ==================== BACKBLAZE B2 STORAGE ====================
// Provides asset access through our server proxy.
// Private bucket assets are streamed through /api/storage/download
// so they're always available 24/7 with no expiration.

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2_ENDPOINT = process.env.B2_ENDPOINT || "s3.eu-central-003.backblazeb2.com";
const B2_BUCKET = process.env.B2_BUCKET_NAME || "weildbuild";
const B2_KEY_ID = process.env.B2_KEY_ID || "";
const B2_APP_KEY = process.env.B2_APPLICATION_KEY || "";

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      endpoint: `https://${B2_ENDPOINT}`,
      region: "eu-central-003",
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY,
      },
    });
  }
  return _s3Client;
}

export function isB2Configured(): boolean {
  return !!(B2_KEY_ID && B2_APP_KEY);
}

/**
 * Generate a signed URL for reading a private B2 object.
 * Used internally by the proxy endpoint, not exposed to clients.
 */
export async function getB2SignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Upload a file to B2.
 */
export async function uploadToB2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await client.send(command);
}

/**
 * Get the proxy URL for a B2 asset.
 * The server streams the asset from B2 to the client — always available, no expiration.
 * Example: /api/storage/download?key=items/faces/FACE-1.png
 */
export function getAssetProxyUrl(b2Key: string): string {
  return `/api/storage/download?key=${encodeURIComponent(b2Key)}`;
}

/**
 * Resolve an item's data path to a usable URL.
 * - Local paths (starting with /) → return as-is (served by Next.js public/)
 * - B2 paths (starting with items/) → return proxy URL
 */
export function resolveItemDataUrl(data: string | null | undefined): string | null {
  if (!data) return null;
  
  // Local path — return as-is (served by Next.js public/)
  if (data.startsWith("/")) return data;
  
  // B2 path — use proxy URL (always available, no expiration)
  if (data.startsWith("items/")) {
    return getAssetProxyUrl(data);
  }
  
  return data;
}
