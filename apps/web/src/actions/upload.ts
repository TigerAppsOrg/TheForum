"use server";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { auth } from "~/auth";
import { env } from "~/env";
import { enforceRateLimit } from "~/lib/rate-limit";
import {
  IMAGE_EXTENSIONS,
  type ImageContentType,
  MAX_UPLOAD_BYTES,
  UPLOAD_FOLDERS,
  publicUrlForKey,
} from "~/lib/s3";
import { parseInput } from "~/lib/validation";

function getS3Client() {
  return new S3Client({
    region: env.AWS_REGION ?? "us-east-1",
    // Uses credentials from ~/.aws/credentials automatically
  });
}

const presignSchema = z.object({
  /** Accepted for backwards compatibility but never used — keys are generated server-side. */
  filename: z.string().max(255).optional(),
  contentType: z.enum(Object.keys(IMAGE_EXTENSIONS) as [ImageContentType, ...ImageContentType[]], {
    message: `Invalid file type. Allowed: ${Object.keys(IMAGE_EXTENSIONS).join(", ")}`,
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, { message: "File too large. Maximum 5MB." }),
  folder: z.enum(UPLOAD_FOLDERS),
});

export async function getPresignedUploadUrl(input: {
  filename?: string;
  contentType: string;
  size: number;
  folder: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  const { contentType, size, folder } = parseInput(presignSchema, input);
  enforceRateLimit("upload", userId);

  if (!env.AWS_S3_BUCKET) {
    throw new Error("S3 bucket not configured");
  }

  // Key and extension are derived server-side only: the client's filename
  // never reaches S3, so it can't pick a path, overwrite an object, or upload
  // an .html/.svg under an image content type.
  const key = `${folder}/${userId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[contentType]}`;

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  // The presigner leaves Content-Type unsigned by default; signing both it and
  // Content-Length makes S3 reject a PUT with a different type or size than
  // the one validated above.
  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type", "content-length"]),
  });

  return {
    uploadUrl: url,
    key,
    publicUrl: publicUrlForKey(key),
  };
}
