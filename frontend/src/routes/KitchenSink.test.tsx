import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { KitchenSink } from "./KitchenSink";

afterEach(cleanup);

// Rendering the whole sink exercises every §5 component (incl. the house-SVG
// charts and the squarified treemap) — a crash test for the full inventory.
test("kitchen sink renders every section without throwing", () => {
  render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter>
          <KitchenSink />
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );

  expect(screen.getByRole("heading", { name: "Kitchen sink" })).toBeInTheDocument();
  for (const section of [
    /Colour palette/,
    /Type scale/,
    /Spacing scale/,
    /Inputs \(§5\.1\)/,
    /Provenance & status/,
    /DataTable/,
    /charts/,
    /quotes/,
    /Structure & chrome/,
  ]) {
    expect(screen.getByRole("heading", { name: section })).toBeInTheDocument();
  }

  // A house-SVG chart and the treemap actually drew.
  expect(screen.getByLabelText("Holdings heatmap")).toBeInTheDocument();
  expect(screen.getAllByRole("img").length).toBeGreaterThan(3);
});
