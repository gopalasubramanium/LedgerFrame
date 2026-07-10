import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { DisplayProvider } from "./theme/DisplayProvider";
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
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  const user = userEvent.setup();
  renderApp();

  // Icon-only button (recomposed 2026-07-11): state lives in the tooltip/aria-label.
  const btn = screen.getByRole("button", { name: /change theme/i });
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
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  const user = userEvent.setup();
  renderApp();

  // Default is comfortable.
  expect(document.documentElement).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await user.click(screen.getByRole("button", { name: /change density/i }));
  expect(document.documentElement).toHaveAttribute("data-density", "compact");
  expect(localStorage.getItem("lf.density")).toBe("compact");
});
