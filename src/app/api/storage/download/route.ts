// ==================== B2 ASSET PROXY ====================
// Streams private B2 objects through our server.
// Users access assets via /api/storage/download?key=items/faces/FACE-1.png
// The server fetches from B2 and streams the response — no signed URLs exposed.
// Items are visible 24/7 with no expiration.

import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  // Security: only allow items/ paths
  if (!key.startsWith("items/")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Security: prevent path traversal
  if (key.includes("..") || key.includes("//")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (!B2_KEY_ID || !B2_APP_KEY) {
    return NextResponse.json({ error: "B2 not configured" }, { status: 503 });
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Empty response from B2" }, { status: 404 });
    }

    // Determine content type from key
    const contentType = response.ContentType || getContentType(key);

    // Stream the body directly to the user
    const body = response.Body;

    return new NextResponse(body as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable", // Cache for 24 hours
        "CDN-Cache-Control": "public, max-age=604800", // CDN caches for 7 days
      },
    });
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    console.error("[B2] Failed to fetch asset:", key, err);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

function getContentType(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".gif")) return "image/gif";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".mp3")) return "audio/mpeg";
  if (key.endsWith(".ogg")) return "audio/ogg";
  if (key.endsWith(".wav")) return "audio/wav";
  if (key.endsWith(".obj")) return "model/obj";
  return "application/octet-stream";
}
