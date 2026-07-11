import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { DisplayProvider } from "./theme/DisplayProvider";
import { DisplayControls } from "./components/DisplayControls";
import App from "./App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  for (const a of ["data-theme", "data-density", "data-contrast", "data-motion"]) {
    document.documentElement.removeAttribute(a);
  }
  vi.restoreAllMocks();
});

function renderApp() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

// DisplayControls moved out of the page into the chrome TopBar (D-066, Phase 1);
// the per-device axis behaviour is tested against the component directly.
function renderControls() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <DisplayControls />
      </DisplayProvider>
    </ThemeProvider>,
  );
}

test("shows backend health from /health", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ status: "ok", version: "2.0.0" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  renderApp();
  await waitFor(() =>
    expect(screen.getByText(/ok · v2\.0\.0/)).toBeInTheDocument(),
  );
});

test("shows an unreachable state when /health fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("boom");
    }),
  );
  renderApp();
  await waitFor(() =>
    expect(screen.getByText(/unreachable/)).toBeInTheDocument(),
  );
});

test("theme cycle advances light → dark → system and stamps data-theme", async () => {
  const user = userEvent.setup();
  renderControls();

  // Icon-only button (recomposed 2026-07-11): state lives in the tooltip/aria-label.
  const btn = screen.getByRole("button", { name: /^Theme:/i });
  // Default choice is system.
  expect(btn.getAttribute("title")).toMatch(/System/);

  await user.click(btn);
  expect(btn.getAttribute("title")).toMatch(/Light/);
  expect(document.documentElement).toHaveAttribute("data-theme", "light");

  await user.click(btn);
  expect(btn.getAttribute("title")).toMatch(/Dark/);
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");

  await user.click(btn);
  expect(btn.getAttribute("title")).toMatch(/System/);
});

test("density toggle stamps data-density and persists per-device", async () => {
  const user = userEvent.setup();
  renderControls();

  // Default is comfortable.
  expect(document.documentElement).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await user.click(screen.getByRole("button", { name: /^Density:/i }));
  expect(document.documentElement).toHaveAttribute("data-density", "compact");
  expect(localStorage.getItem("lf.density")).toBe("compact");
});
