const os = require("node:os");

function isPrivateIPv4(address) {
  const parts = String(address).split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function getLanIPv4(networkInterfaces = os.networkInterfaces()) {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces ?? {})) {
    for (const address of addresses ?? []) {
      const family = address.family;
      if (address.internal || (family !== "IPv4" && family !== 4) || !isPrivateIPv4(address.address)) continue;
      const interfaceName = name.toLowerCase();
      const adapterRank = /wi-?fi|wireless|ethernet|^en\d/i.test(interfaceName)
        ? 0
        : /virtual|vmware|hyper-v|wsl|vpn|docker|loopback/i.test(interfaceName)
          ? 2
          : 1;
      const [first, second] = address.address.split(".").map(Number);
      const subnetRank = first === 192 && second === 168 ? 0 : first === 10 ? 1 : 2;
      candidates.push({ address: address.address, adapterRank, subnetRank });
    }
  }
  candidates.sort((left, right) => left.adapterRank - right.adapterRank || left.subnetRank - right.subnetRank);
  return candidates[0]?.address ?? null;
}

function createPreviewUrl(address, port = 8081) {
  if (!isPrivateIPv4(address)) throw new TypeError("A private LAN IPv4 address is required.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError("Port must be between 1 and 65535.");
  return `http://${address}:${port}/`;
}

module.exports = { createPreviewUrl, getLanIPv4, isPrivateIPv4 };
