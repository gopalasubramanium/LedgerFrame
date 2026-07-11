import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

afterEach(cleanup);

// §11-14 regression guard. The batch-2 narrow-width subtitle `nowrap` (page-chrome
// §11-9) caused horizontal overflow because PageHeader wrapped its title + subtitle in
// a plain <div> that could not shrink — the nowrap text expanded it past the viewport.
// The fix nests them in `.lf-pageheader__titles` (min-width:0; flex:1 1 auto) so the
// subtitle clamps instead of pushing the page wide.
//
// NOTE: a true pixel test (scrollWidth <= clientWidth at 320/375/900/1366px on the
// document and the shell content container) needs a real browser — jsdom has no layout
// engine, so scrollWidth/clientWidth are always 0 here and such a test would pass
// vacuously. That breakpoint test is specced for a Playwright suite (ADR pending); this
// jsdom test permanently guards the structural invariant that prevented the regression.
test("PageHeader nests title+subtitle in a shrinkable wrapper (overflow regression guard)", () => {
  const longSubtitle =
    "Management surface — add/edit holdings, transactions, and manual assets; import; export.";
  const { container } = render(
    <PageHeader
      title="Holdings"
      subtitle={longSubtitle}
      actions={<button type="button">Add</button>}
    />,
  );
  const titles = container.querySelector(".lf-pageheader__titles");
  expect(titles).not.toBeNull();
  // The subtitle (the element that gets `nowrap` at narrow widths) lives INSIDE the
  // shrinkable wrapper — otherwise it can't clamp.
  expect(titles!.querySelector(".lf-pageheader__subtitle")?.textContent).toBe(longSubtitle);
  // Actions are a separate flex child (they don't share the shrink wrapper).
  expect(container.querySelector(".lf-pageheader__actions")).not.toBeNull();
});
