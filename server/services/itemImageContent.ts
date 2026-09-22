const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

export type StoredInlineImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  buffer: Buffer;
};

function hasExpectedMagicBytes(buffer: Buffer, contentType: StoredInlineImage["contentType"]): boolean {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a;
  }
  return buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

export function decodeStoredInlineImage(value: string): StoredInlineImage | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;

  const contentType = match[1].toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : match[1].toLowerCase() as StoredInlineImage["contentType"];
  const encoded = match[2].replace(/\s/g, "");

  // Base64 expands binary data by roughly 4/3. Reject oversized data before
  // decoding so a malformed database value cannot cause a large allocation.
  if (encoded.length > Math.ceil(MAX_INLINE_IMAGE_BYTES * 4 / 3) + 4) return null;

  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length === 0 || buffer.length > MAX_INLINE_IMAGE_BYTES) return null;
  if (!hasExpectedMagicBytes(buffer, contentType)) return null;

  return { contentType, buffer };
}

export function isRedirectableStoredImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}