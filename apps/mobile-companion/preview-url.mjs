export function isPrivateLanIPv4(hostname) {
  const parts = String(hostname).split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function normalizePreviewUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== "http:" || url.username || url.password || !isPrivateLanIPv4(url.hostname)) return null;
    if (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
