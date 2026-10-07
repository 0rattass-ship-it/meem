import assert from "node:assert/strict";
import test from "node:test";

import { getCustomerProfile, saveCustomerProfile } from "./customer-profile.ts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("يخزّن اسم العميل دون بريد إلكتروني أو كلمة مرور", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });

  saveCustomerProfile({ name: "محمد أحمد علي" });

  assert.deepEqual(getCustomerProfile(), { name: "محمد أحمد علي" });
});
