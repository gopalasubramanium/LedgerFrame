import { apiGet, apiSend } from "./client";

// Legal reader — page-legal §3a/§3b. The page's copy is SERVED (§9-3, owner 2026-07-19).
//
// The deciding rationale was the GUARD BAR, not the transport: accuracy guards bind server-side
// corpora, so this copy is held to the same truth bar as Help (`tests/unit/test_legal_accuracy.py`,
// `test_legal_content.py`). A frontend constant would have been cheaper and would have inherited
// nothing — on the one page whose entire job is to be true.
//
// The page renders every string VERBATIM and composes nothing. There is no money on this surface,
// so D-105 is N/A here — and D-105 governs money, never prose (the correction recorded at §9-3).

/** One numbered clause, and its lettered sub-clauses if it has any.
 *
 *  CARRIES NO NUMBER, deliberately (§11-4). Numbering is DERIVED FROM POSITION by the renderer —
 *  article index, clause index, item index — so "2.1.a" is a fact about where the clause sits
 *  rather than a string someone typed. Typed numbers are how a formal document rots: insert one
 *  clause and every later number is silently wrong, and nothing can detect it because the numbers
 *  are prose. There is nowhere in this type to put one. */
export interface LegalClause {
  text: string;
  items: string[];
}

/** One article — a numbered heading over a run of clauses. Was `LegalSection` with a single
 *  `body` string until the owner ruled the formal register (§11-4, 2026-07-20). */
export interface LegalArticle {
  id: string;
  title: string;
  clauses: LegalClause[];
}

export interface LegalCommitments {
  title: string;
  intro: string;
  /** The seven Product Commitments, VERBATIM from PRODUCT-SPEC.md §3 — string equality is asserted
   *  server-side (AC-L3). The page renders them in the served order and never renumbers,
   *  reorders, paraphrases or truncates them. */
  items: string[];
}

/** A file that ships with the source, and optionally a convenience link to its public text.
 *
 *  `file` is REQUIRED and `url` is OPTIONAL, and that asymmetry IS the contract (§9-5 as amended
 *  by §11-3, owner 2026-07-20). The shipped file is canonical; a URL is a convenience and never a
 *  substitute. The renderer marks it as a convenience and applies rel="noreferrer noopener".
 *
 *  NEVER LOAD-BEARING: the page must remain complete and true with every url dead. A reader
 *  offline, or with no-egress on, sees the file name and the description and loses a shortcut and
 *  nothing else. */
export interface LegalPointer {
  file: string;
  what: string;
  url?: string | null;
}

export interface LegalResponse {
  /** The served markup dialect the prose is written in (`lf-help-markup-1`) — the same subset
   *  Help uses, rendered by the same route-local renderer. Versioned, so a future change to the
   *  subset is a visible contract change rather than a silent reinterpretation. */
  markup: string;
  /** Register apparatus, not a seventh content: it fixes what the document's Capitalised
   *  words refer to, and states no claim and no limit of its own (§11-4). */
  preamble: string;
  sections: LegalArticle[];
  commitments: LegalCommitments;
  pointers: LegalPointer[];
  /** The single product-level line the Reports Pack renders (§9-4). Served here because Legal
   *  OWNS the string and the Pack RENDERS it — one source, two renderers, asserted byte-for-byte
   *  server-side (AC-L8). The page does not display this field; it is on the response so the two
   *  renderers are provably reading the same bytes. */
  pack_footer: string;
}

/** The whole Legal page. One read, no parameters — the copy is static and never personalised. */
export function legalContent() {
  return apiGet<LegalResponse>("/legal");
}

// --------------------------------------------------------------------------------------------- #
// THE ACCEPTANCE GATE (page-legal §11-5, owner 2026-07-20)
// --------------------------------------------------------------------------------------------- #

/** Where this install stands.
 *
 *  THREE-VALUED, AND THE THIRD VALUE IS THE POINT. `stale` means an acceptance exists but of an
 *  EARLIER text — the person is a returning user being re-asked because the document changed, not
 *  a stranger, and the gate greets them differently. Collapsing `stale` into `none` would lose
 *  exactly the distinction the event log was built to keep. */
export type AcceptanceState = "none" | "stale" | "accepted";

export interface LegalAcceptanceStatus {
  status: AcceptanceState;
  /** sha256 of the served document this status was computed against. */
  content_sha256: string;
  accepted_at: string | null;
}

/** The gate's own strings — SERVED, never authored here.
 *
 *  This is the most consequential copy in the product: it is what the user is RECORDED as having
 *  agreed to. It is served for the same reason Legal's prose is (§9-3) — so the accuracy guards
 *  can reach it — and because a consent record whose wording lives in a frontend constant cannot
 *  be bound to the text the server hashed. ⚑ The wording is PROPOSED until the owner's look (§9-8). */
export interface LegalGateCopy {
  prompt: string;
  explainer: string;
  stale_note: string;
  declined_note: string;
}

export function fetchAcceptance() {
  return apiGet<LegalAcceptanceStatus>("/legal/acceptance");
}

export function fetchGateCopy() {
  return apiGet<LegalGateCopy>("/legal/gate-copy");
}

/** Record an answer. The hash is taken SERVER-SIDE and is deliberately not a parameter — a
 *  client-supplied hash would let a caller record acceptance of a document never served. */
export function recordAcceptance(action: "accepted" | "declined") {
  return apiSend<LegalAcceptanceStatus>("/legal/acceptance", "POST", { action });
}
