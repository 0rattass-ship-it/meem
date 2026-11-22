import assert from "node:assert/strict";
import test from "node:test";
import { canSubmitPayment, receiptFileError } from "./payment-receipt.ts";

test("bank transfer requires a successful receipt upload", () => {
  assert.equal(canSubmitPayment("bank_transfer", null, false), false);
  assert.equal(canSubmitPayment("bank_transfer", "customer/receipt.png", true), false);
  assert.equal(canSubmitPayment("bank_transfer", "customer/receipt.png", false), true);
});

test("restaurant payment does not require a receipt", () => {
  assert.equal(canSubmitPayment("pay_at_store", null, false), true);
  assert.equal(canSubmitPayment("pay_at_store", null, true), true);
});

test("receipt uploads accept images and reject other or empty files", () => {
  assert.equal(receiptFileError({ type: "image/png", size: 1024 }), null);
  assert.notEqual(receiptFileError({ type: "application/pdf", size: 1024 }), null);
  assert.notEqual(receiptFileError({ type: "image/png", size: 0 }), null);
  assert.notEqual(receiptFileError({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }), null);
});