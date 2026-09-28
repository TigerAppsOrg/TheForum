import { z } from "zod";
import { env } from "~/env";

/**
 * S3 upload conventions shared by the presign action and every action that
 * stores an uploaded image URL. Server-only.
 */

export const UPLOAD_FOLDERS = ["event-flyers", "org-logos", "avatars"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Allowed upload content types → the extension used in the generated key. */
export const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageContentType = keyof typeof IMAGE_EXTENSIONS;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

function bucketHosts(): Set<string> {
  const bucket = env.AWS_S3_BUCKET;
  if (!bucket) return new Set();
  const region = env.AWS_REGION ?? "us-east-1";
  return new Set([`${bucket}.s3.amazonaws.com`, `${bucket}.s3.${region}.amazonaws.com`]);
}

export function publicUrlForKey(key: string): string {
  if (!env.AWS_S3_BUCKET) throw new Error("S3 bucket not configured");
  return `https://${env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
}

/**
 * True only for a plain https URL on our bucket, inside `folder`. Rejects
 * other hosts, query strings/fragments, credentials, ports and path tricks —
 * user-supplied image URLs are rendered in other users' browsers.
 */
export function isOurImageUrl(url: string, folder: UploadFolder): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
    return false;
  }
  if (!bucketHosts().has(parsed.hostname)) return false;
  const path = parsed.pathname;
  return path.startsWith(`/${folder}/`) && /^[A-Za-z0-9/._-]+$/.test(path) && !path.includes("..");
}

/**
 * Optional uploaded-image URL: absent/empty → null, otherwise it must be one of
 * our uploads in `folder`.
 */
export function uploadedImageUrlSchema(folder: UploadFolder) {
  return z
    .string()
    .trim()
    .max(2048)
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isOurImageUrl(v, folder), {
      message: "Image must be uploaded through The Forum",
    });
}
