import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeStoredInlineImage,
  isRedirectableStoredImageUrl,
} from "../server/services/itemImageContent";

test("decodes supported stored inline images", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const decoded = decodeStoredInlineImage(`data:image/jpeg;base64,${jpeg.toString("base64")}`);

  assert.equal(decoded?.contentType, "image/jpeg");
  assert.deepEqual(decoded?.buffer, jpeg);
});

test("rejects executable and malformed inline image content", () => {
  const svg = Buffer.from("<svg><script>alert(1)</script></svg>");
  assert.equal(
    decodeStoredInlineImage(`data:image/svg+xml;base64,${svg.toString("base64")}`),
    null,
  );
  assert.equal(decodeStoredInlineImage("data:image/jpeg;base64,bm90LWEtanBlZw=="), null);
});

test("allows only same-origin paths and HTTP image redirects", () => {
  assert.equal(isRedirectableStoredImageUrl("/objects/item.jpg"), true);
  assert.equal(isRedirectableStoredImageUrl("https://cdn.example.com/item.jpg"), true);
  assert.equal(isRedirectableStoredImageUrl("//cdn.example.com/item.jpg"), false);
  assert.equal(isRedirectableStoredImageUrl("javascript:alert(1)"), false);
});