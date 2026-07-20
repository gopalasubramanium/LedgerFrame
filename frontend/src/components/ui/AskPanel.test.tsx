import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
