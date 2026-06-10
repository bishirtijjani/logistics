import { useCallback } from "react";

/**
 * Legacy gate for actions that require a transaction PIN. It used to block
 * no-PIN users with an alert and route them to the SetPin screen. That is no
 * longer needed: the PinBottomSheet now opens straight into its inline "create
 * your PIN" setup when the user has none, so the action continues without a
 * detour. Verification-only screens that don't use the sheet still get the
 * server's PIN_NOT_SET response and route to SetPin themselves.
 *
 * Kept as a no-op (always allows) so the existing `if (!requirePin()) return;`
 * call sites don't all need editing.
 */
export function usePinGuard() {
  return useCallback(() => true, []);
}
