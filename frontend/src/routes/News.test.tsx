import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";

const BRIEFING = {
  ok: true,
  data: {
    text: "Your portfolio 100,000.00 SGD, today +500.00 SGD. Information only, not financial advice.",
    generated_at: "2026-07-13T00:00:00Z",
  },
};
const GROUPED = {
  ok: true,
  data: {
    groups: [
      { name: "My holdings", items: [{ headline: "Apple steadies as the market digests rate expectations", source: "BBC", url: "https://example.com/a", published_at: "2026-07-13T00:00:00Z", symbols: ["AAPL"] }] },
      { name: "India", items: [{ headline: "Rupee firms <script>alert(1)</script> on strong inflows", source: "Reuters", url: "https://example.com/b", published_at: "2026-07-12T00:00:00Z", symbols: [] }] },
    ],
    total: 2,
    no_egress: false,
  },
};

const getBriefing = vi.fn(async () => BRIEFING);
const getGroupedNews = vi.fn(async () => GROUPED);
vi.mock("../api/news", () => ({
  getBriefing: () => getBriefing(),
  getGroupedNews: () => getGroupedNews(),
}));

import { News } from "./News";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter initialEntries={["/news"]}>
          <News />
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("briefing renders the SERVED deterministic text; the card carries NO AI copy (ND-1)", async () => {
  const { container } = renderPage();
  expect(await screen.findByText(/Information only, not financial advice/)).toBeTruthy();
  // ND-1: LLM narration is deferred — no AI wording appears on the page.
  expect(container.textContent ?? "").not.toMatch(/\bAI\b|narrat|artificial intelligence/i);
});

test("grouped headlines render the SERVED buckets verbatim, a NewsList per group (ND-3)", async () => {
  renderPage();
  expect(await screen.findByText("My holdings")).toBeTruthy();
  expect(screen.getByText("India")).toBeTruthy();
  expect(screen.getByText(/Apple steadies/)).toBeTruthy();
  // A headline's symbol links to InstrumentDetail (showSymbols).
  const sym = screen.getByRole("link", { name: "AAPL" });
  expect(sym.getAttribute("href")).toContain("/instrument/AAPL");
});

test("a headline containing markup renders as INERT plain text (ND-12 sanitisation)", async () => {
  renderPage();
  const el = await screen.findByText(/Rupee firms/);
  // The <script> is a literal text node, never a DOM element — no HTML injection path.
  expect(el.textContent).toContain("<script>alert(1)</script>");
  expect(el.querySelector("script")).toBeNull();
});

test("external headline links open in a new tab with a safe rel (ND-5)", async () => {
  renderPage();
  const link = await screen.findByRole("link", { name: /Apple steadies/ });
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toContain("noreferrer");
});

test("no-egress renders an honest reason, never fabricated headlines (ND-2)", async () => {
  getGroupedNews.mockResolvedValueOnce({ ok: true, data: { groups: [], total: 0, no_egress: true } });
  renderPage();
  expect(await screen.findByText(/no-egress is on/)).toBeTruthy();
});

test("empty headlines show a configure-feeds reason (honest empty)", async () => {
  getGroupedNews.mockResolvedValueOnce({ ok: true, data: { groups: [], total: 0, no_egress: false } });
  renderPage();
  expect(await screen.findByText(/No headlines right now/)).toBeTruthy();
});
