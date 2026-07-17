// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstrumentLabel } from "./InstrumentLabel";

// §14dr-19: the one symbol+name pattern — symbol prominent, name secondary,
// name suppressed when it is null or equals the symbol.
function renderIt(props: Parameters<typeof InstrumentLabel>[0]) {
  return render(
    <MemoryRouter>
      <InstrumentLabel {...props} />
    </MemoryRouter>,
  );
}

describe("InstrumentLabel", () => {
  it("renders symbol prominent and name secondary", () => {
    renderIt({ symbol: "AAPL", name: "Apple Inc." });
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    // symbol links to the instrument detail page
    expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/instrument/AAPL");
  });

  it("suppresses the name when it equals the symbol", () => {
    renderIt({ symbol: "103504", name: "103504" });
    expect(screen.getByText("103504")).toBeInTheDocument();
    expect(screen.queryByText(/^103504$/)).toBeInTheDocument();
    // no second (name) node — only the symbol span renders
    expect(screen.getAllByText("103504")).toHaveLength(1);
  });

  it("falls back to the label with no link when there is no symbol", () => {
    renderIt({ symbol: null, name: null, fallback: "Cash transfer" });
    expect(screen.getByText("Cash transfer")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("§14dr-22: truncate mode adds the class and a full-identity title tooltip", () => {
    const { container } = renderIt({ symbol: "MSFT", name: "Microsoft Corporation", truncate: true });
    const el = container.querySelector(".lf-instr");
    expect(el).toHaveClass("lf-instr--truncate");
    expect(el).toHaveAttribute("title", "MSFT — Microsoft Corporation");
  });

  it("§14dr-22: no truncate → no class and no title", () => {
    const { container } = renderIt({ symbol: "MSFT", name: "Microsoft Corporation" });
    const el = container.querySelector(".lf-instr");
    expect(el).not.toHaveClass("lf-instr--truncate");
    expect(el).not.toHaveAttribute("title");
  });
});
