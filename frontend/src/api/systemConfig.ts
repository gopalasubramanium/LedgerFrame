// Settings → System tab readers/writers (page-settings §12st / §9-10). Every value shown is a
// SERVED display string (D-105). D-003 graceful degradation: `admin_available` (served) gates the
// ONE control that genuinely needs the root helper — Allow LAN (a `POST /system/admin` action).
// Every other control here (provider, write-only key, auto-lock, reset, AI-config line) applies
// through the app's own endpoints and works regardless of the helper (§9-10; the base-currency
// precedent). A provider/auto-lock change simply can't hot-restart the worker without the helper —
// a caveat, not a block.
import { apiGet, apiSend } from "./client";

// --- Market data provider (+ write-only API key, §12st-2) --------------------
export interface DataSource {
  provider: string;
  /** True once a key is stored — the key value is NEVER returned (write-only, D-003). */
  has_api_key: boolean;
  base_currency: string;
  providers: string[];
  admin_available: boolean;
  /** Learned Alpha Vantage tier where served ("premium" | "free" | "unknown"), else null
   *  (non-AV / no key). Display-only, the served string (D-105) — data-feed-routing §14dr-2. */
  av_tier?: string | null;
}

export async function getDataSource(): Promise<DataSource | null> {
  const r = await apiGet<DataSource>("/system/data-source");
  return r.ok ? r.data : null;
}

/** PUT /system/data-source (require_auth). `api_key` is write-only: sent, never echoed back. */
export async function putDataSource(
  payload: { provider?: string; api_key?: string },
): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; note?: string }>("/system/data-source", "PUT", payload);
  return r.ok ? { ok: true, note: r.data.note } : { ok: false, error: r.error };
}

// --- App config (auto-lock) --------------------------------------------------
export interface SystemConfig {
  timezone: string;
  autolock_minutes: string;
  stale_after_seconds: string;
}

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const r = await apiGet<SystemConfig>("/system/config");
  return r.ok ? r.data : null;
}

export async function putSystemConfig(
  values: Record<string, string>,
): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; note?: string }>("/system/config", "PUT", { values });
  return r.ok ? { ok: true, note: r.data.note } : { ok: false, error: r.error };
}

// --- AI config (READ-ONLY served display line, §12st-4) ----------------------
// Model MANAGEMENT stays deferred to the AI-surfaces milestone (D-067/D-068); Settings shows the
// served config as a plain line, never a control.
export interface AiConfig {
  enabled: boolean;
  provider: string;
  model: string;
  has_openai_key: boolean;
}

export async function getAiConfig(): Promise<AiConfig | null> {
  const r = await apiGet<AiConfig>("/system/ai-config");
  return r.ok ? r.data : null;
}

// --- D-003 root-helper signal ------------------------------------------------
export async function getAdminAvailable(): Promise<boolean> {
  const r = await apiGet<{ available?: boolean }>("/system/admin/available");
  return r.ok ? !!r.data.available : false;
}

/** Allow LAN — the ONE sudo-helper-dependent control on this tab (`POST /system/admin action=lan`).
 *  Absent the helper this call fails honestly; the control is disabled with an explanation upstream. */
export async function setLanAccess(
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean }>("/system/admin", "POST", { action: "lan", arg: on ? "on" : "off" });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Current LAN posture (read-only) — served by /system/status. */
export async function getLanEnabled(): Promise<boolean> {
  const r = await apiGet<{ allow_lan?: boolean }>("/system/status");
  return r.ok ? !!r.data.allow_lan : false;
}

// --- Reset data (danger; ConfirmDialog + D-103 fresh purge-PIN) --------------
export async function resetData(): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; note?: string }>("/system/reset-data", "POST");
  return r.ok ? { ok: true, note: r.data.note } : { ok: false, error: r.error };
}

// --- Auth state (PIN card, §12st-1) ------------------------------------------
export async function getPinSet(): Promise<boolean> {
  const r = await apiGet<{ pin_set?: boolean }>("/auth/state");
  return r.ok ? !!r.data.pin_set : false;
}
