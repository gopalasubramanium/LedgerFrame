import { afterEach, expect, test, vi } from "vitest";

import { apiSend } from "./client";

// data-feed-routing §14dr-1 (layer 2, SYSTEMIC): a non-2xx must surface the SERVED
// reason TEXT, never a stringified structured error. FastAPI 422 `detail` is an array
// of objects; the old `String(body.detail)` rendered "[object Object]" — this is the
// one choke point every reader feeds the toast through (D-105: the served string IS
// the display string, and for a 422 the served reason is `msg`).

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })));
}

test("a 422 validation array renders the served msg text, never '[object Object]'", async () => {
  // The exact body the backend returned for the Save-key 422 (RED capture, §14dr-1).
  mockFetch(422, {
    detail: [{ type: "missing", loc: ["body", "provider"], msg: "Field required", input: { api_key: "SECRET-KEY" } }],
  });
  const r = await apiSend("/system/data-source", "PUT", { api_key: "SECRET-KEY" });
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("expected failure");
  expect(r.error).toContain("Field required");
  expect(r.error).not.toContain("[object");
  // The 422 `detail[].input` echoes the posted body — the pasted key must never leak.
  expect(r.error).not.toContain("SECRET-KEY");
});

test("a plain-string detail passes through verbatim (the honest 4xx reason)", async () => {
  mockFetch(400, { detail: "kite doesn't cover US" });
  const r = await apiSend("/system/routing-matrix", "PUT", {});
  if (r.ok) throw new Error("expected failure");
  expect(r.error).toBe("kite doesn't cover US");
});

test("a non-JSON / detail-less body falls back to HTTP status, never '[object Object]'", async () => {
  mockFetch(500, {});
  const r = await apiSend("/system/data-source", "PUT", {});
  if (r.ok) throw new Error("expected failure");
  expect(r.error).toBe("HTTP 500");
  expect(r.error).not.toContain("[object");
});
