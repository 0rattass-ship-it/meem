export type CustomerProfile = {
  name: string;
  phone: string;
};

const STORAGE_KEY = "meem-customer-profile";

export function getCustomerProfile(): CustomerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerProfile>;
    if (typeof parsed.name !== "string" || parsed.name.trim().length < 2) return null;
    if (typeof parsed.phone !== "string" || parsed.phone.trim().length < 6) return null;
    return { name: parsed.name.trim(), phone: parsed.phone.trim() };
  } catch {
    return null;
  }
}

export function saveCustomerProfile(profile: CustomerProfile) {
  const normalized = { name: profile.name.trim(), phone: profile.phone.trim() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCustomerProfile() {
  localStorage.removeItem(STORAGE_KEY);
}
