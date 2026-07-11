// System / auth readers for the global chrome (page-chrome Phase 1).
import { apiGet, apiSend } from "./client";

export interface VersionCheck {
  current: string;
  latest: string;
  update_available: boolean;
  url: string;
}

// The version check is the ONLY chrome reader that can trigger egress — and the
// backend guards it: under no-egress it returns update_available=false with ZERO
// outbound calls (C-3, verified by tests/integration/test_version_check_no_egress).
// The frontend just reflects the result; the UpdateBanner hides when there's no update.
export async function fetchVersionCheck(): Promise<VersionCheck | null> {
  const r = await apiGet<VersionCheck>("/system/version-check");
  return r.ok ? r.data : null;
}

export interface AuthState {
  pin_set: boolean;
}

export async function fetchAuthState(): Promise<AuthState> {
  const r = await apiGet<AuthState>("/auth/state");
  return r.ok ? r.data : { pin_set: false };
}

// Unlock sets a session cookie (sent automatically on same-origin requests).
export async function unlock(pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSend<{ ok: boolean }>("/auth/unlock", "POST", { pin });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function lock(): Promise<void> {
  await apiSend("/auth/lock", "POST");
}

// First-run PIN step (D-045): the first PIN sets from loopback with no auth (D-004);
// changing an existing PIN needs an unlocked session — but the checklist runs AFTER the
// lock gate (F-7), so a session is present in that case.
export async function setPin(pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSend<{ ok: boolean }>("/auth/set-pin", "POST", { pin });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
