const FULL_NAME_PART = /^[\p{L}]+$/u;

export function isThreePartName(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return false;

  const parts = normalized.split(" ");
  return parts.length === 3 && parts.every((part) => FULL_NAME_PART.test(part));
}
