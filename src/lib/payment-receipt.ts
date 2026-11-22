export const RECEIPT_BUCKET = "payment-receipts";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function receiptFileError(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return "اختر صورة إيصال بصيغة JPG أو PNG أو WEBP";
  if (file.size <= 0 || file.size > RECEIPT_MAX_BYTES) return "يجب ألا يتجاوز حجم صورة الإيصال 10 ميجابايت";
  return null;
}

export function canSubmitPayment(method: string, receiptPath: string | null, uploading: boolean) {
  return method !== "bank_transfer" || (Boolean(receiptPath) && !uploading);
}