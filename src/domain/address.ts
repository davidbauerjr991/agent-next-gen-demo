/** Digits only, without a leading US country code, so "(312) 555-0164",
 *  "312.555.0164" and "+1 312 555 0164" compare equal. Shared by the app and
 *  the sim's routing match. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
