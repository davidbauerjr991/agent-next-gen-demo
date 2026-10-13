import type { ProviderError, ProviderErrorCode } from "../providers";

// Runtime helpers for the `ProviderError` contract (src/providers/events.ts).
// They live here, not in src/providers/, so that folder stays types-only.

/** Builds the value a provider promise rejects with. Only `"network"` is
 *  retryable unless stated otherwise. */
export function providerError(
  code: ProviderErrorCode,
  message: string,
  retryable: boolean = code === "network",
): ProviderError {
  return { code, message, retryable };
}

const CODES: readonly ProviderErrorCode[] = ["not-supported", "invalid-state", "not-found", "network"];

/** Narrows an unknown rejection to a `ProviderError`. */
export function isProviderError(value: unknown): value is ProviderError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    CODES.includes(v.code as ProviderErrorCode) &&
    typeof v.message === "string" &&
    typeof v.retryable === "boolean"
  );
}
