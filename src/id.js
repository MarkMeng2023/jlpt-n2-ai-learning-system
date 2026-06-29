export function createId(prefix) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  const randomPart = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${timestamp}-${randomPart}`;
}
