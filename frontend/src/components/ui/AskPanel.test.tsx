import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { AskPanel } from "./AskPanel";
import * as aiApi from "../../api/ai";
import type { ChatEvent, GroundingStatus } from "../../api/ai";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The Ask panel's job is HONESTY, not chat. Every test here is about a claim the product makes
// about itself — the disclaimer is served, the posture is stated, the facts precede the answer,
// nothing is persisted — rather than about the panel "working". A panel that works and quietly
// composes its own disclaimer would pass a functional review and break Commitment 2.

const STATUS: GroundingStatus = {
  grounded: true,
  narration: "openai_compatible",
  model: "m",
  ai_enabled: true,
  mode: "local",
  remote: false,
  no_egress: false,
  privacy_label: "On-device (local Hailo/Ollama) — portfolio facts stay on this device.",
  kind: "on_device_model",
  kind_label: "On-device model (Ollama-compatible)",
  last_error: null,
};

const NO_EGRESS_STATUS: GroundingStatus = {
  ...STATUS,
  mode: "deterministic",
  no_egress: true,
  privacy_label:
    "No-egress is on — this device makes no outbound calls, so answers are built from your " +
    "data only, with no AI narration.",
};

const DISCLAIMER = "Information only, not financial advice.";
// §14-4's three SERVED legends. Written out here rather than imported so the test asserts the
// STRING the panel renders, not a constant it shares with the code under test — a shared constant
// would make both sides agree by construction and the assertion would be tautological.
const PROV_BUILT_IN = "Built-in intelligence only — no model was used.";
const PROV_ON_DEVICE =
  "Facts: built-in · Narration: on-device model — nothing left this device.";
const FALLBACK_SIGNAL = "AI answer didn't pass grounding checks — showing facts directly.";

function mockStatus(status: GroundingStatus) {
  vi.spyOn(aiApi, "getGroundingStatus").mockResolvedValue({ ok: true, data: status });
}

/** Drive the stream synchronously through the callbacks the panel registers. */
function mockStream(events: ChatEvent[]) {
  const cancel = vi.fn();
  vi.spyOn(aiApi, "streamAnswer").mockImplementation((_q, onEvent) => {
    for (const e of events) onEvent(e);
    return { cancel };
  });
  return cancel;
}

const GROUNDED_RUN: ChatEvent[] = [
  {
    type: "facts",
    facts: [
      { label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z" },
      { label: "Today's change", value: "1,204.10 SGD", timestamp: "2026-07-20T00:00:00Z" },
    ],
  },
  { type: "provenance", kind: "on_device_model", narrated: true, provenance: PROV_ON_DEVICE },
  { type: "delta", delta: "Your net worth is 796,543.93 SGD." },
  { type: "done", grounded: true, provider: "openai_compatible", disclaimer: DISCLAIMER },
];

beforeEach(() => mockStatus(STATUS));

async function openPanel() {
  const user = userEvent.setup();
  render(<AskPanel />);
  await user.click(screen.getByRole("button", { name: "Ask" }));
  return user;
}

test("AskPanel: the privacy-mode label is visible as soon as the panel opens (D-067)", async () => {
  await openPanel();
  await waitFor(() =>
    expect(screen.getByTestId("ask-privacy-label")).toHaveTextContent(STATUS.privacy_label),
  );
});

test("AskPanel: the posture label is SERVED verbatim — the panel never composes it", async () => {
  // The served string is rendered exactly. If this component ever built its own posture sentence,
  // the product would have two sources for a statement about what the device is doing, and the
  // one the user reads would be the one nobody guards.
  mockStatus(NO_EGRESS_STATUS);
  await openPanel();
  await waitFor(() =>
    expect(screen.getByTestId("ask-privacy-label")).toHaveTextContent(
      NO_EGRESS_STATUS.privacy_label,
    ),
  );
});

test("AskPanel: facts are shown BEFORE the answer (trust UX, contract clause 7)", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();

  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const facts = await screen.findByRole("region", { name: "Facts used" });
  const answer = await screen.findByTestId("ask-answer");

  // DOM order is the claim: the fact pack must precede the answer in the document, not merely
  // exist somewhere on screen.
  expect(facts.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(facts).toHaveTextContent("Net worth");
  expect(facts).toHaveTextContent("796,543.93 SGD");
});

test("AskPanel: the served disclaimer is rendered on a completed answer (Commitment 2)", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  expect(await screen.findByText(DISCLAIMER)).toBeInTheDocument();
});

test("AskPanel: D-070's fallback signal is rendered VERBATIM when grounding rejects the answer", async () => {
  mockStream([
    GROUNDED_RUN[0],
    { type: "delta", delta: `_${FALLBACK_SIGNAL}_\n\n` },
    { type: "delta", delta: "• Net worth: 796,543.93 SGD" },
    {
      type: "done",
      grounded: true,
      provider: "fallback",
      validation: "unsupported figure",
      fallback_signal: FALLBACK_SIGNAL,
      disclaimer: DISCLAIMER,
    },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const signal = await screen.findByTestId("ask-fallback-signal");
  expect(signal).toHaveTextContent(FALLBACK_SIGNAL);
  // A fallback is the validator WORKING. It must not be announced as an alert — role="status"
  // is polite; role="alert" would tell the user something went wrong when nothing did.
  expect(signal).toHaveAttribute("role", "status");
});

test("AskPanel: a passing answer carries NO fallback signal", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  await screen.findByTestId("ask-answer");
  expect(screen.queryByTestId("ask-fallback-signal")).toBeNull();
});

test("AskPanel: a stream failure states a REASON rather than showing an empty box", async () => {
  vi.spyOn(aiApi, "streamAnswer").mockImplementation((_q, _onEvent, onError) => {
    onError("The connection to the AI was lost.");
    return { cancel: vi.fn() };
  });
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  expect(await screen.findByText("The connection to the AI was lost.")).toBeInTheDocument();
});

test("AskPanel: closing CANCELS the stream and discards the exchange (D-016 / Commitment 6)", async () => {
  const cancel = mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);
  await screen.findByTestId("ask-answer");

  await user.keyboard("{Escape}");
  expect(cancel).toHaveBeenCalled();

  // Reopening shows a blank panel. "Ephemeral" is a promise the product makes on the Legal page;
  // a panel that helpfully restored the last answer would break Commitment 6 while looking like
  // a convenience.
  await user.click(screen.getByRole("button", { name: "Ask" }));
  await waitFor(() => expect(screen.queryByTestId("ask-answer")).toBeNull());
  expect(screen.getByLabelText("Your question")).toHaveValue("");
});

// --- The instrument explainer (D-068) ----------------------------------------------------------
// "Instrument explainer rides P-6" — so it is THIS panel opened with a scoped question, not a
// second surface and not a second model path. These tests exist to keep it that way.

test("AskPanel: the explainer opens with its scoped question ALREADY TYPED, and sends nothing", async () => {
  const streamed = vi.spyOn(aiApi, "streamAnswer");
  const user = userEvent.setup();
  render(<AskPanel label="Explain" seedQuestion="Explain AAPL — what is it, and how is it doing?" />);

  await user.click(screen.getByRole("button", { name: "Explain" }));

  expect(screen.getByLabelText("Your question")).toHaveValue(
    "Explain AAPL — what is it, and how is it doing?",
  );
  // NOT auto-sent. An explainer that fired on open would spend the user's device — and under a
  // metered remote provider, their money — on a question they never asked. It also keeps ONE code
  // path for every answer, which is what P-6 requires.
  expect(streamed).not.toHaveBeenCalled();
});

test("AskPanel: the explainer's question is EDITABLE — it is a starting point, not a script", async () => {
  const user = userEvent.setup();
  render(<AskPanel label="Explain" seedQuestion="Explain AAPL" />);
  await user.click(screen.getByRole("button", { name: "Explain" }));

  const box = screen.getByLabelText("Your question");
  await user.clear(box);
  await user.type(box, "what is my net worth?");
  expect(box).toHaveValue("what is my net worth?");
});

test("AskPanel: closing the explainer discards the ANSWER but restores the seed", async () => {
  mockStream(GROUNDED_RUN);
  const user = userEvent.setup();
  render(<AskPanel label="Explain" seedQuestion="Explain AAPL" />);
  await user.click(screen.getByRole("button", { name: "Explain" }));
  await user.click(screen.getAllByRole("button", { name: /^(Explain|Ask)$/ }).at(-1)!);
  await screen.findByTestId("ask-answer");

  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Explain" }));

  // Ephemeral is about the EXCHANGE (Commitment 6), not about the prompt the page supplied.
  await waitFor(() => expect(screen.queryByTestId("ask-answer")).toBeNull());
  expect(screen.getByLabelText("Your question")).toHaveValue("Explain AAPL");
});

// --- The display projection (§10-B, owner ruled option (a)) -------------------------------------
// The 0a specimen found three help entries rendering in full and pushing the answer, the
// disclaimer and D-070's signal off the bottom of the screen — while every DOM assertion passed.
// These pin the PROJECTION; the driver pins the GEOMETRY. Neither alone would have caught it.

const HELP_FACT = {
  label: "Help · Net worth",
  value:
    "Your headline and liquidity. Four figures lead: Net worth, Gross assets, Liabilities.\n\n" +
    "Interpret: Net worth is Gross assets minus Liabilities, and nothing else — insurance cash " +
    "value is deliberately outside it.",
  fact_type: "help",
};

test("AskPanel: a help fact is PROJECTED to its first line, not dumped in full", async () => {
  mockStream([
    { type: "facts", facts: [HELP_FACT] },
    { type: "delta", delta: "Answer." },
    { type: "done", grounded: true, provider: "openai_compatible", disclaimer: DISCLAIMER },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "what is net worth?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const region = await screen.findByRole("region", { name: "Facts used" });
  expect(region).toHaveTextContent("Your headline and liquidity.");
  // The Interpret section is in the MODEL's copy of this fact and must not be dumped on the reader.
  expect(region).not.toHaveTextContent("insurance cash value is deliberately outside it");
  expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
});

test("AskPanel: the projection HIDES nothing — Show more reveals the full served fact", async () => {
  mockStream([
    { type: "facts", facts: [HELP_FACT] },
    { type: "done", grounded: true, provider: "openai_compatible", disclaimer: DISCLAIMER },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "what is net worth?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  await user.click(await screen.findByRole("button", { name: "Show more" }));
  const region = screen.getByRole("region", { name: "Facts used" });
  // Projection is a DISPLAY decision, not a redaction. Everything the model was given stays
  // reachable, or the fact pack stops being the thing it claims to be.
  expect(region).toHaveTextContent("insurance cash value is deliberately outside it");
  expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
});

test("AskPanel: a FIGURE fact is never projected — it is one line already", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const region = await screen.findByRole("region", { name: "Facts used" });
  expect(region).toHaveTextContent("796,543.93 SGD");
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("AskPanel: in the fallback view the D-070 signal PRECEDES the fact pack", async () => {
  mockStream([
    { type: "facts", facts: [HELP_FACT] },
    { type: "delta", delta: `_${FALLBACK_SIGNAL}_\n\n` },
    {
      type: "done", grounded: true, provider: "fallback", validation: "unsupported figure",
      fallback_signal: FALLBACK_SIGNAL, disclaimer: DISCLAIMER,
    },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const signal = await screen.findByTestId("ask-fallback-signal");
  const region = screen.getByRole("region", { name: "Facts used" });
  // The signal explains WHY facts are being shown instead of an answer, so it must arrive before
  // them. Clause 7 is untouched: the facts still precede the ANSWER, and the signal is not one.
  expect(signal.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

// ─── §12-2: the disclaimer is in the ARTIFACT, and on SCREEN exactly once ───────
//
// The owner's synthesis of Finding 4: the answer TEXT always ends with the served constant
// (Commitment 2 binds the artifact — every export/stream/copy carries it), and the PANEL projects
// the body without that trailing line, rendering the footer element once. These fixtures therefore
// stream what the backend now actually streams: a body that ENDS with the disclaimer.

const GROUNDED_RUN_WITH_TRAILING_DISCLAIMER: ChatEvent[] = [
  {
    type: "facts",
    facts: [{ label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z" }],
  },
  { type: "delta", delta: "Your net worth is 796,543.93 SGD.\n\n" + DISCLAIMER },
  { type: "done", grounded: true, provider: "openai_compatible", disclaimer: DISCLAIMER },
];

/** Count VISIBLE occurrences of a sentence across the whole rendered panel. */
function visibleOccurrences(text: string): number {
  return screen.queryAllByText((_content, el) => {
    if (!el) return false;
    // Leaf-ish nodes only: an ancestor contains the string too, and counting ancestors would
    // report a duplicate that is not on screen. This is a count of what the READER sees.
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("");
    return own.includes(text);
  }).length;
}

async function runAsk(events: ChatEvent[]) {
  mockStream(events);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);
  await screen.findByTestId("ask-answer").catch(() => null);
  await waitFor(() => expect(visibleOccurrences(DISCLAIMER)).toBeGreaterThan(0));
}

test("AskPanel: the disclaimer is visible EXACTLY ONCE, though the answer text ends with it", async () => {
  await runAsk(GROUNDED_RUN_WITH_TRAILING_DISCLAIMER);
  expect(visibleOccurrences(DISCLAIMER)).toBe(1);
});

test("AskPanel: projecting the trailing disclaimer away does NOT truncate the answer", async () => {
  // The guard against over-stripping. A projection removes the trailing legal line and NOTHING
  // else — if this ever slices into the answer, the panel is redacting, not projecting, and the
  // reader loses content while the duplicate-count test above stays green.
  await runAsk(GROUNDED_RUN_WITH_TRAILING_DISCLAIMER);
  expect(screen.getByTestId("ask-answer")).toHaveTextContent("Your net worth is 796,543.93 SGD.");
});

test("AskPanel: an answer that is ONLY the disclaimer renders no empty answer block", async () => {
  // This is the fallback state after §12-1: the fact pack is the answer, so the served body is
  // just the trailing disclaimer. Projected away, nothing is left — and an empty bordered answer
  // box below the facts would read as "the AI said nothing", which is not what happened.
  mockStream([
    {
      type: "facts",
      facts: [{ label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z" }],
    },
    { type: "delta", delta: DISCLAIMER },
    {
      type: "done",
      grounded: true,
      provider: "fallback",
      disclaimer: DISCLAIMER,
      fallback_signal: FALLBACK_SIGNAL,
    },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  await screen.findByTestId("ask-fallback-signal");
  expect(screen.queryByTestId("ask-answer")).toBeNull();
  expect(visibleOccurrences(DISCLAIMER)).toBe(1);
  // The facts are still there — they ARE the answer in this state (§12-1).
  expect(await screen.findByRole("region", { name: "Facts used" })).toHaveTextContent("Net worth");
});

// --- §14-4: THE PROVENANCE LEGEND AND THE MODEL-TEXT TREATMENT -------------------------------- //
//
// The panel already showed WHAT an answer is built from. It never showed WHO WROTE THE SENTENCE.
// These tests are about that second question, and they assert BOTH DIRECTIONS of the treatment,
// because a distinction applied to everything distinguishes nothing.

test("§14-4: a model-narrated answer carries the served legend AND the model-text treatment", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  // The legend is rendered VERBATIM — the panel composes no claim about its own authorship, the
  // same rule the disclaimer and the posture line follow (§0-C).
  const legend = await screen.findByTestId("ask-provenance");
  expect(legend.textContent).toBe(PROV_ON_DEVICE);

  // The treatment is SEMANTIC: these words were written by a model.
  const answer = screen.getByTestId("ask-answer");
  expect(answer.dataset.narrated).toBe("true");
  expect(answer.className).toContain("lf-ask__answer--model");
});

test("§14-4: engine-served text NEVER carries the model-text treatment", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);
  await screen.findByTestId("ask-provenance");

  // The fact list, and the legend itself, are the ENGINE's words in the same panel as a model's.
  // If the treatment leaked onto them the distinction would be decorative rather than semantic —
  // which is the one thing the owner's ruling said it must not be.
  for (const el of [
    screen.getByRole("region", { name: "Facts used" }) as HTMLElement,
    screen.getByTestId("ask-provenance"),
  ]) {
    expect(el.className).not.toContain("lf-ask__answer--model");
    expect(el.querySelector(".lf-ask__answer--model")).toBeNull();
  }
});

test("§14-4: a FALLBACK answer is labelled built-in, and nothing on screen is model-styled", async () => {
  // The state the legend matters most in: a model was configured, it wrote something, the
  // validator discarded it, and the reader is seeing none of it. Crediting the model here would
  // describe a contribution the product deliberately threw away.
  mockStream([
    {
      type: "facts",
      facts: [{ label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z" }],
    },
    { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
    { type: "delta", delta: DISCLAIMER },
    {
      type: "done", grounded: true, provider: "fallback",
      fallback_signal: FALLBACK_SIGNAL, disclaimer: DISCLAIMER,
    },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  const legend = await screen.findByTestId("ask-provenance");
  expect(legend.textContent).toBe(PROV_BUILT_IN);
  expect(document.querySelectorAll(".lf-ask__answer--model")).toHaveLength(0);
});

test("§14-4: the legend is shown on EVERY answer, so its absence is never the signal", async () => {
  // Rendering a legend only when a model was involved would make the built-in state legible by
  // OMISSION — the silent-fallback failure D-070 exists to prevent, reintroduced on a new field.
  mockStream([
    { type: "facts", facts: [{ label: "Net worth", value: "1.00 SGD" }] },
    { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
    { type: "delta", delta: DISCLAIMER },
    { type: "done", grounded: true, provider: "fallback", disclaimer: DISCLAIMER },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);
  expect((await screen.findByTestId("ask-provenance")).textContent).toBe(PROV_BUILT_IN);
});

// --- §17-1: ONE LOCALITY STATEMENT ON SCREEN AT EVERY MOMENT (owner ruling, 2026-07-20) -------- //
//
// The owner found the panel stating where the answer goes TWICE at once: the posture line
// ("On-device … stays on this device") above, the provenance legend ("nothing left this device")
// below. Both true, both served, and together they read as two different claims rather than one
// claim said twice — the reader is left checking whether they agree.
//
// The ruling is a HANDOVER, not a deletion. D-067's "privacy-mode label always visible" is about
// the READER never being without a locality statement, and both halves of that survive:
//
//   pre-answer   the posture line — a user must know where a question goes BEFORE sending it
//   post-answer  the legend — which says where it ACTUALLY went, which is strictly more than the
//                posture line could promise
//
// Never both, and never neither. The "never neither" half is the one worth guarding hardest: the
// obvious implementation of this ruling — dropping the posture line — would leave the pre-ask
// state with no locality statement at all, which is the D-067 breach the ruling is careful not to
// commit.

test("§17-1: BEFORE an answer, the posture line carries the locality statement", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await waitFor(() =>
    expect(screen.getByTestId("ask-privacy-label")).toHaveTextContent(STATUS.privacy_label),
  );
  // Still there while the question is being typed, and while it is in flight — the whole point is
  // that it is on screen at the moment the user decides to press Ask.
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  expect(screen.getByTestId("ask-privacy-label")).toBeInTheDocument();
  expect(screen.queryByTestId("ask-provenance")).toBeNull();
});

test("§17-1: ONCE the legend renders, the posture line collapses — never both", async () => {
  mockStream(GROUNDED_RUN);
  const user = await openPanel();
  await waitFor(() => expect(screen.getByTestId("ask-privacy-label")).toBeInTheDocument());

  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  // The legend IS the privacy label now, and it is the better one: it reports what happened
  // rather than what was configured (§15-4).
  expect((await screen.findByTestId("ask-provenance")).textContent).toBe(PROV_ON_DEVICE);
  expect(screen.queryByTestId("ask-privacy-label")).toBeNull();
});

test("§17-1: the fallback answer hands over too — legend in, posture line out", async () => {
  // Asserted separately because the fallback legend is the SHORTEST of the three and says nothing
  // about egress in so many words ("Built-in intelligence only — no model was used."). It is
  // still a complete locality statement — no model ran, so nothing was sent anywhere — and the
  // handover must not be quietly conditional on the narrated path.
  mockStream([
    { type: "facts", facts: [{ label: "Net worth", value: "1.00 SGD" }] },
    { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
    { type: "delta", delta: DISCLAIMER },
    {
      type: "done", grounded: true, provider: "fallback",
      fallback_signal: FALLBACK_SIGNAL, disclaimer: DISCLAIMER,
    },
  ]);
  const user = await openPanel();
  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);

  expect((await screen.findByTestId("ask-provenance")).textContent).toBe(PROV_BUILT_IN);
  expect(screen.queryByTestId("ask-privacy-label")).toBeNull();
});

test("§17-1: NEVER NEITHER — every state carries exactly one locality statement", async () => {
  // The anti-blind arm. Both of the above would stay green on a build that rendered NOTHING in
  // either place; this one counts. It also re-checks after the panel is closed and reopened,
  // because `reset()` clears the legend and the posture line has to come back with it.
  mockStream(GROUNDED_RUN);
  const user = await openPanel();

  const localityStatements = () =>
    (screen.queryByTestId("ask-privacy-label") ? 1 : 0) +
    (screen.queryByTestId("ask-provenance") ? 1 : 0);

  await waitFor(() => expect(localityStatements()).toBe(1));

  await user.type(screen.getByLabelText("Your question"), "how is my portfolio?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]);
  await screen.findByTestId("ask-provenance");
  expect(localityStatements()).toBe(1);

  // Closed and reopened: back to the pre-ask state, and back to the posture line.
  await user.click(screen.getByRole("button", { name: /close/i }));
  await user.click(screen.getByRole("button", { name: "Ask" }));
  await waitFor(() => expect(screen.getByTestId("ask-privacy-label")).toBeInTheDocument());
  expect(localityStatements()).toBe(1);
});

// ── R-54 delta 4b — THE LINK AFFORDANCE: the panel POINTS, the page ACTS (§9-D/§9-E) ──────────
//
// A fact carrying a SERVED link_id renders a pointer to its canonical page; a fact with none renders
// no pointer (never an arrow to nowhere); following one closes the ephemeral panel. The panel now
// renders react-router `Link`, so these mount it in a router — the existing tests do not, and stay
// unrouted because their mock facts carry no link_id and so render no Link.

const LINKED_RUN: ChatEvent[] = [
  {
    type: "facts",
    facts: [
      { label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z", link_id: "page:/net-worth" },
      { label: "Today's change", value: "1,204.10 SGD", timestamp: "2026-07-20T00:00:00Z" }, // no link
    ],
  },
  { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
  { type: "done", grounded: true, provider: "fallback", disclaimer: DISCLAIMER },
];

async function runAskRouted(events: ChatEvent[]) {
  mockStream(events);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <AskPanel />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole("button", { name: "Ask" })); // open the dialog
  await user.type(screen.getByLabelText("Your question"), "what is my net worth?");
  await user.click(screen.getAllByRole("button", { name: "Ask" })[1]); // submit
  return user;
}

test("AskPanel: a fact with a served link renders a pointer that NAMES its destination (§9-D)", async () => {
  await runAskRouted(LINKED_RUN);
  const pointer = await screen.findByRole("link", { name: "Open Net worth" });
  // The destination is the page that owns the figure, from the ONE nav model — not a typed string.
  expect(pointer.getAttribute("href")).toContain("/net-worth");
});

test("AskPanel: a fact with no resolvable link renders NO pointer — never an arrow to nowhere", async () => {
  await runAskRouted(LINKED_RUN);
  // Two facts, exactly one linked → exactly one pointer.
  expect(screen.getAllByTestId("ask-pointer")).toHaveLength(1);
  const unlinkedRow = screen.getByText("Today's change").closest("li");
  expect(unlinkedRow).not.toBeNull();
  expect(unlinkedRow!.querySelector('[data-testid="ask-pointer"]')).toBeNull();
});

test("AskPanel: following a pointer closes the ephemeral panel — it points, then leaves", async () => {
  const user = await runAskRouted(LINKED_RUN);
  await user.click(await screen.findByRole("link", { name: "Open Net worth" }));
  // close() runs on navigate: the dialog unmounts, so its composer is gone.
  await waitFor(() => expect(screen.queryByLabelText("Your question")).toBeNull());
});

// ── W-4: THE ANSWER MUST VISIBLY POINT (owner ruling 2026-07-22, DS §5.5 second variant) ─────────
// A tier-1 ACTION/NAV answer is scoped (backend) to a SINGLE page-linked help fact, so its pointer
// is a LABELED LINK LINE — "→ Open Holdings" / "→ Open Appearance settings" — not a floating arrow
// tucked under "Show more". Every other pack keeps the ratified trailing arrows. Still a LINK, never
// a control (§9-E, still links only).
const ACTION_RUN: ChatEvent[] = [
  {
    type: "facts",
    facts: [
      { label: "Help · Holdings", value: "The one place to add, edit and delete positions.\nMore.",
        timestamp: "2026-07-20T00:00:00Z", link_id: "page:/holdings" },
    ],
  },
  { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
  { type: "done", grounded: true, provider: "fallback", disclaimer: DISCLAIMER },
];

const NAV_RUN: ChatEvent[] = [
  {
    type: "facts",
    facts: [
      { label: "Help · Settings", value: "Preferences across seven tabs.\nAppearance is theme.",
        timestamp: "2026-07-20T00:00:00Z", link_id: "page:/settings?tab=appearance" },
    ],
  },
  { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
  { type: "done", grounded: true, provider: "fallback", disclaimer: DISCLAIMER },
];

test("AskPanel W-4: a scoped action answer POINTS with a labeled link line (not a bare arrow)", async () => {
  await runAskRouted(ACTION_RUN);
  const line = await screen.findByTestId("ask-linkline");
  expect(line).toHaveTextContent("Open Holdings");
  expect(line.tagName).toBe("A"); // a LINK, never a control (§9-E)
  expect(line.getAttribute("href")).toContain("/holdings");
  // The orphaned trailing arrow is GONE on the action answer — the labeled line is the pointer.
  expect(screen.queryByTestId("ask-pointer")).toBeNull();
});

test("AskPanel W-4: the labeled line names a Settings TAB destination (askLinkLabel vocabulary)", async () => {
  await runAskRouted(NAV_RUN);
  const line = await screen.findByRole("link", { name: "Open Appearance settings" });
  expect(line.getAttribute("href")).toContain("tab=appearance");
});

test("AskPanel W-4: following the labeled line closes the ephemeral panel", async () => {
  const user = await runAskRouted(ACTION_RUN);
  await user.click(await screen.findByRole("link", { name: "Open Holdings" }));
  await waitFor(() => expect(screen.queryByLabelText("Your question")).toBeNull());
});

test("AskPanel W-4 (loop-2 extension): a PROSE fact renders NO pointer glyph; only VALUE rows do", async () => {
  // Owner ruling 2026-07-22 (loop-2): the bare trailing/orphan arrow is removed from prose facts
  // EVERYWHERE. In a multi-fact pack (not the scoped action/nav shape), a page-linked help fact
  // renders NEITHER a trailing arrow NOR a labeled line — the help content is the reference, not a
  // door. The VALUE row beside it keeps the ratified trailing arrow. Guard: a prose fact with a
  // pointer glyph outside the labeled-line variant reds.
  const MIXED: ChatEvent[] = [
    {
      type: "facts",
      facts: [
        { label: "Help · Portfolio", value: "Investment analytics.\nMore.",
          timestamp: "2026-07-20T00:00:00Z", link_id: "page:/portfolio" },
        { label: "Net worth", value: "796,543.93 SGD", timestamp: "2026-07-20T00:00:00Z", link_id: "page:/net-worth" },
      ],
    },
    { type: "provenance", kind: "built_in", narrated: false, provenance: PROV_BUILT_IN },
    { type: "done", grounded: true, provider: "fallback", disclaimer: DISCLAIMER },
  ];
  await runAskRouted(MIXED);
  const proseRow = (await screen.findByText("Help · Portfolio")).closest("li");
  expect(proseRow).not.toBeNull();
  // The prose fact carries NO pointer of any kind — not a trailing arrow, not a labeled line.
  expect(proseRow!.querySelector('[data-testid="ask-pointer"]')).toBeNull();
  expect(proseRow!.querySelector('[data-testid="ask-linkline"]')).toBeNull();
  // The VALUE row keeps the ratified trailing arrow — the discriminator (not "no pointer anywhere").
  const valueRow = screen.getByText("Net worth").closest("li");
  expect(valueRow!.querySelector('[data-testid="ask-pointer"]')).not.toBeNull();
});
