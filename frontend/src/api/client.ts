// Thin fetch helper. Same-origin in production; the Vite dev proxy forwards
// /api and /health to the backend (vite.config.ts). Never throws for a non-2xx —
// callers get a typed Result so pages can render honest error states.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const BASE = "/api/v1";

// Render a non-2xx `detail` as the SERVED reason TEXT (D-105) — never a stringified
// object. A FastAPI 422 `detail` is an array of {loc, msg, type, input}; the old
// `String(detail)` produced "[object Object]" (data-feed-routing §14dr-1, systemic).
// We extract `msg` ONLY — the 422 `input` echoes the request body (e.g. a pasted
// write-only key), so the whole object must never be serialized into an error string.
function detailToText(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  const msgOf = (d: unknown): string =>
    d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : "";
  if (Array.isArray(detail)) {
    const msgs = detail.map(msgOf).filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  } else {
    const msg = msgOf(detail);
    if (msg) return msg;
  }
  return `HTTP ${status}`;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, init);
    if (!res.ok) {
      // 451 = the acceptance gate refused (page-legal §11-5). Announced globally rather than
      // handled by the caller, because EVERY caller would otherwise need to know about consent.
      //
      // THE SERVER IS THE AUTHORITY AND THIS IS THE FRONTEND OBEYING IT. The shell asks once at
      // mount, but consent can lapse mid-session in ways the shell has no way to predict: the
      // Legal text changes and the hash moves, or a data reset erases the record (§11-D3). Both
      // surface here first, as a 451 on an ordinary read. Reacting to the refusal — instead of
      // trying to anticipate the causes — means the gate re-fires for a reason nobody enumerated.
      if (res.status === 451) window.dispatchEvent(new Event("lf:consent-required"));
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail !== undefined) detail = detailToText(body.detail, res.status);
      } catch {
        /* non-JSON error body */
      }
      return { ok: false, error: detail, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

export function apiGet<T>(path: string): Promise<Result<T>> {
  return request<T>(path);
}

export function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE" | "PATCH",
  body?: unknown,
): Promise<Result<T>> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiUpload<T>(path: string, file: File): Promise<Result<T>> {
  const form = new FormData();
  form.append("file", file);
  return request<T>(path, { method: "POST", body: form });
}

/** Trigger a server-side file download (P-5 — the client never builds the file). */
export function apiDownload(path: string): void {
  const a = document.createElement("a");
  a.href = `${BASE}${path}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
