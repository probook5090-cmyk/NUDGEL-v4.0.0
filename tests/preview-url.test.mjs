import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateLanIPv4, normalizePreviewUrl } from "../apps/mobile-companion/preview-url.mjs";

test("mobile companion accepts only local private-network HTTP links", () => {
  assert.equal(normalizePreviewUrl("http://192.168.1.44:8081/"), "http://192.168.1.44:8081/");
  assert.equal(normalizePreviewUrl("http://10.0.0.7:8081"), "http://10.0.0.7:8081/");
  assert.equal(normalizePreviewUrl("http://172.20.0.3:8081/"), "http://172.20.0.3:8081/");
  assert.equal(normalizePreviewUrl("https://192.168.1.44:8081/"), null);
  assert.equal(normalizePreviewUrl("http://8.8.8.8:8081/"), null);
  assert.equal(normalizePreviewUrl("http://localhost:8081/"), null);
  assert.equal(normalizePreviewUrl("not a URL"), null);
});

test("the local IP check rejects loopback and malformed addresses", () => {
  assert.equal(isPrivateLanIPv4("192.168.1.1"), true);
  assert.equal(isPrivateLanIPv4("127.0.0.1"), false);
  assert.equal(isPrivateLanIPv4("256.168.1.1"), false);
});
