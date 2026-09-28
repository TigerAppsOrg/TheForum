import { getPresignedUploadUrl } from "~/actions/upload";

/** Mirrors the limits enforced server-side in actions/upload.ts. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = IMAGE_ACCEPT.split(",");
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload an image straight to S3 via a presigned PUT and return its public URL.
 *
 * Throws an Error whose message is safe to show in a toast. The S3 response is
 * checked — `fetch` resolves on 4xx/5xx, so without `res.ok` a rejected upload
 * used to be saved as if it had worked, leaving a broken image URL behind.
 */
export async function uploadImage(file: File, folder: "avatars" | "event-flyers" | "org-logos") {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That image is over 5 MB. Please choose a smaller one.");
  }

  let uploadUrl: string;
  let publicUrl: string;
  try {
    ({ uploadUrl, publicUrl } = await getPresignedUploadUrl({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      folder,
    }));
  } catch {
    throw new Error("Image uploads aren't available right now. Please try again later.");
  }

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
  } catch {
    throw new Error("Upload failed — check your connection and try again.");
  }
  if (!res.ok) {
    throw new Error("Upload failed. Please try again.");
  }

  return publicUrl;
}
