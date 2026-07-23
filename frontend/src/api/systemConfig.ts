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
  /** Learned Alpha Vantage INDEX-DATA tier where served ("premium" | "free" | "unknown"), else
   *  null (non-AV / no key). Display-only, the served string (D-105) — data-feed-routing §14dr-2. */
  av_tier?: string | null;
  /** R-63 R3(a)/I-11: ISO learned-at timestamp for av_tier — persisted so the tier survives restart
   *  (it was per-process). Renders as "· verified <date>". Null until an index tier is verified. */
  av_tier_at?: string | null;
  /** R-63 I-4 (two-premiums): the VERIFIED QUOTE entitlement, a DIFFERENT product from av_tier.
   *  "delayed" | "real-time" | "end-of-day" once a quote has been parsed (this process OR persisted),
   *  else null (not yet verified). The tier label must reflect what was proven per product (§9-2, AC-9). */
  quote_entitlement?: string | null;
  /** R-63 R3(a)/I-11: ISO learned-at timestamp for quote_entitlement — persisted so the verification
   *  survives restart / a post-purge zero-holdings state (F-D). Renders as "· verified <date>". */
  quote_entitlement_at?: string | null;
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
  /** The INTERNAL provider id, not a label. Never rendered — see `summary` (AI-surfaces §14-2). */
  provider: string;
  model: string;
  has_openai_key: boolean;
  /** One of the three kinds of intelligence: built_in | on_device_model | external_model. */
  kind: string;
  kind_label: string;
  remote: boolean;
  no_egress: boolean;
  /**
   * The SERVED sentence the AI tab renders verbatim (§14-3).
   *
   * The tab used to compose this line itself — `AI is on — provider ${provider}, model …` — which
   * is how the retired vendor word reached the screen AND how the tab came to name a provider
   * that was not the one answering. A sentence about what this device is doing with the user's
   * data is not the browser's to assemble (§0-C).
   */
  summary: string;
  /**
   * §17-4 / Finding 9 — is the OS environment setting AI config that this device's `.env` does not?
   *
   * When true, writing this configuration will not change what the process runs after a restart.
   * The tab was always TRUE about what IS running and said nothing about that, so a user could
   * save, watch the line report something else, and have nothing on screen explain why.
   */
  env_override: boolean;
  /**
   * The SERVED sentence for that state, or `null` when there is nothing to warn about.
   *
   * `null`, not `""`, so the absence is a value the client cannot accidentally render. Served
   * rather than composed, for the same reason as `summary`: the browser does not author the
   * product's claims about itself.
   */
  env_override_note: string | null;
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
// §14dr-20 / D-103: the fresh PIN is threaded through — an ambient/unlocked session never
// satisfies the wipe (the server verifies the submitted PIN, not the session token).
export async function resetData(pin: string): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; note?: string }>("/system/reset-data", "POST", { pin });
  return r.ok ? { ok: true, note: r.data.note } : { ok: false, error: r.error };
}

// --- Auth state (PIN card, §12st-1) ------------------------------------------
export async function getPinSet(): Promise<boolean> {
  const r = await apiGet<{ pin_set?: boolean }>("/auth/state");
  return r.ok ? !!r.data.pin_set : false;
}
