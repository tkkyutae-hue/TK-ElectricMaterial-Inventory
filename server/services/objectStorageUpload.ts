import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import path from "path";

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

const UPLOADS_PREFIX = "uploads";

export async function uploadBuffer(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const bucket = getBucket();
  const objectName = `${UPLOADS_PREFIX}/${filename}`;
  const file = bucket.file(objectName);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });
}

export async function downloadBuffer(filename: string): Promise<Buffer | null> {
  try {
    const bucket = getBucket();
    const objectName = `${UPLOADS_PREFIX}/${filename}`;
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return contents as Buffer;
  } catch {
    return null;
  }
}

export async function deleteObject(filename: string): Promise<void> {
  try {
    const bucket = getBucket();
    const objectName = `${UPLOADS_PREFIX}/${filename}`;
    const file = bucket.file(objectName);
    await file.delete({ ignoreNotFound: true });
  } catch {
    // ignore
  }
}
