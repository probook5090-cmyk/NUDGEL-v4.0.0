import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createPreviewUrl, getLanIPv4, isPrivateIPv4 } = require("../desktop/network.cjs");

test("the host accepts RFC1918 addresses only", () => {
  assert.equal(isPrivateIPv4("192.168.1.44"), true);
  assert.equal(isPrivateIPv4("10.0.0.7"), true);
  assert.equal(isPrivateIPv4("172.20.4.5"), true);
  assert.equal(isPrivateIPv4("172.32.0.1"), false);
  assert.equal(isPrivateIPv4("8.8.8.8"), false);
  assert.equal(isPrivateIPv4("127.0.0.1"), false);
});

test("the desktop chooses a Wi-Fi or Ethernet LAN address and publishes a local HTTP link", () => {
  const interfaces = {
    "VMware Network Adapter": [{ address: "192.168.56.1", family: "IPv4", internal: false }],
    "Wi-Fi": [{ address: "192.168.1.44", family: "IPv4", internal: false }],
    lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  };
  assert.equal(getLanIPv4(interfaces), "192.168.1.44");
  assert.equal(createPreviewUrl("192.168.1.44", 8081), "http://192.168.1.44:8081/");
});

test("the preview URL refuses public addresses and invalid ports", () => {
  assert.throws(() => createPreviewUrl("1.1.1.1", 8081), /private LAN/);
  assert.throws(() => createPreviewUrl("192.168.1.44", 70000), /Port/);
});
