import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { R2MediaCategory } from "./types";
export type { R2MediaCategory } from "./types";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

export function getR2S3(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function getR2Bucket(): string {
  return requireEnv("R2_BUCKET_NAME");
}

export function extFromContentType(contentType: string): string {
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ct === "image/jpeg" || ct === "image/jpg") return ".jpg";
  if (ct === "image/png") return ".png";
  if (ct === "image/webp") return ".webp";
  if (ct === "image/gif") return ".gif";
  if (ct === "audio/webm") return ".webm";
  if (ct === "audio/mp4" || ct === "audio/m4a") return ".m4a";
  if (ct === "audio/mpeg") return ".mp3";
  return ".bin";
}

export function buildObjectKey(
  authUserId: string,
  category: R2MediaCategory,
  objectId: string,
  contentType: string
): string {
  return `${authUserId}/${category}/${objectId}${extFromContentType(contentType)}`;
}

const SAFE_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export function assertSafeObjectId(id: string) {
  if (!SAFE_ID.test(id)) throw new Error("Invalid object id");
}

export function assertKeyOwnedByUser(key: string, authUserId: string) {
  const prefix = `${authUserId}/`;
  if (!key.startsWith(prefix)) throw new Error("Key not allowed");
}

/** Server-side upload (avoids browser→R2 CORS on PUT). */
export async function putObjectBytes(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const client = getR2S3();
  const bucket = getR2Bucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function presignPut(
  authUserId: string,
  category: R2MediaCategory,
  objectId: string,
  contentType: string
): Promise<{ url: string; key: string; headers: Record<string, string> }> {
  assertSafeObjectId(objectId);
  const client = getR2S3();
  const bucket = getR2Bucket();
  const key = buildObjectKey(authUserId, category, objectId, contentType);
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: 3600 });
  return { url, key, headers: { "Content-Type": contentType } };
}

export async function presignGet(authUserId: string, key: string): Promise<string> {
  assertKeyOwnedByUser(key, authUserId);
  const client = getR2S3();
  const bucket = getR2Bucket();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn: 3600 });
}

export async function deleteObjectKey(key: string): Promise<void> {
  const client = getR2S3();
  const bucket = getR2Bucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Delete every object whose key starts with `prefix` (e.g. `${userId}/`). */
export async function deleteObjectsByPrefix(prefix: string): Promise<void> {
  const client = getR2S3();
  const bucket = getR2Bucket();
  let continuationToken: string | undefined;
  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k));
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}
