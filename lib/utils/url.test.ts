import { expect, test } from "vite-plus/test";

import { getURLExpiry } from "./url";

test("getURLExpiry adds X-Amz-Expires to X-Amz-Date for S3 URLs", () => {
  const url = "https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Date=2026-03-18T04:00:00Z&X-Amz-Expires=3600";

  expect(getURLExpiry(url)?.toString()).toBe("2026-03-18T05:00:00Z");
});

test("getURLExpiry reads the Expires timestamp of Content Service URLs", () => {
  const url = "https://tenant.content-service.brightspace.com/video.mp4?Expires=1773810000";

  expect(getURLExpiry(url)?.epochMilliseconds).toBe(1773810000 * 1000);
});

test("getURLExpiry returns undefined without expiry information", () => {
  expect(getURLExpiry("https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Date=2026-03-18T04:00:00Z")).toBeUndefined();
  expect(getURLExpiry("https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Expires=3600")).toBeUndefined();
  expect(getURLExpiry("https://tenant.content-service.brightspace.com/video.mp4")).toBeUndefined();
  expect(getURLExpiry("https://example.com/file.pdf?Expires=1773810000")).toBeUndefined();
});
