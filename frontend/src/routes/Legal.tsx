import { useCallback, useEffect, useState } from "react";
import "./Legal.css";
import { Button, EmptyState, PageHeader, Skeleton } from "../components/ui";
import { legalContent } from "../api/legal";
import type { LegalResponse } from "../api/legal";
import { HelpProse } from "./helpMarkup";

// Legal (System group). page-legal §9, ruled by the owner in chat 2026-07-19.
//
// §9-1 — NO FIFTH TEMPLATE. DESIGN-SYSTEM §3 maps pages to overview / entity-detail / worklist /
// settings, and Legal is none of them: no data, no rows, no controls. The temptation is to read
// "System group ⇒ settings template", which is exactly the inference TEMPLATE:145-149 forbids.
// Ruled instead: a PROSE DOCUMENT composed from RATIFIED PRIMITIVES — `PageHeader` plus a stack of
// cards, one per IA content — reusing the full-width prose rule already ruled and guarded at
// page-help §9-bis-14. A new template would have been a DESIGN-SYSTEM amendment, and nothing here
// needs one.
//
// §9-2 / D-106 — WHAT THIS PAGE OWNS. The product-level position, and only that. The ~25 scoped
// caveats served by individual readers stay exactly where they are: they are PART OF THE FIGURE,
// not copies of anything on this page. The "limits on each figure" section exists to say so in
// the user's hearing — and AC-L6 (`tests/unit/test_scoped_caveats.py`) makes the rule enforceable
// rather than merely written, because the failure mode is a diligent reviewer applying
// one-canonical-home and deleting all of them as duplication.
//
// §9-3 — THE COPY IS SERVED. Every string on this page comes from `GET /api/v1/legal` and is
// rendered verbatim. The page computes nothing, decides nothing, and hardcodes no sentence. That
// includes the states: loading and load-failure both ship served or ratified strings, never an
// invented reassurance.
//
// §9-8 — WHAT THIS PAGE NEVER CLAIMS. No jurisdiction-compliance claim, no warranty or indemnity
// term beyond what the AGPL already states, no abstract "secure"/"compliant"/"audited", no implied
// counsel review. Enforced server-side on the corpus (AC-L5) rather than by review here, because
// the copy lives there.
//
// WHY `HelpProse` IS IMPORTED RATHER THAN EXTRACTED. `helpMarkup.tsx` records the house rule:
// extract at the THIRD recurrence (the Segmented / StatusChip precedent). Legal is the SECOND
// surface to need served prose, so the rule says REUSE IN PLACE. If a third arrives, that is when
// this lifts into the DS — and this comment is the note that the count is now at two.

// Sub-clause letters. Deliberately NOT computed from a char code: `String.fromCharCode(97 + i)`
// runs off the end of the alphabet silently at the 27th item and starts emitting punctuation. An
// explicit list makes the ceiling visible, and 26 sub-clauses in one clause would be a drafting
// problem long before it were a rendering one.
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export function Legal() {
  // `undefined` = still loading · `null` = the read failed · a value = the served page.
  // Three states, distinguished, because "no content yet" and "content unavailable" are different
  // facts and a page about honesty should not render them the same way.
  const [content, setContent] = useState<LegalResponse | undefined | null>(undefined);

  const load = useCallback(() => {
    setContent(undefined);
    legalContent().then((r) => setContent(r.ok ? r.data : null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="lf-page legal">
      <PageHeader
        title="Legal"
        subtitle="Licence, disclaimer, Product Commitments, no-jurisdiction-tax stance."
      />

      {content === undefined && (
        <div className="lf-card">
          <Skeleton lines={6} />
        </div>
      )}

      {/* THE LOAD-FAILURE STATE. It says what is missing and offers the retry, and it does NOT
          reassure — a Legal page that cannot load its terms must not imply the terms are fine.
          The one thing it does say is the fact that remains true with the server unreachable:
          the licence ships in the source tree, so the reader is not stranded. */}
      {content === null && (
        <div className="lf-card">
          <EmptyState
            message="Legal is unavailable"
            reason="This page's text could not be loaded. The licence itself ships with the source, in the LICENSE file."
            action={<Button onClick={load}>Retry</Button>}
          />
        </div>
      )}

      {content && (
        <>
          {/* THE PREAMBLE. Register apparatus, not a seventh content (§11-4): it introduces no
              claim and states no limit, it only fixes what the document's Capitalised words mean.
              Unnumbered, because it is not a clause anything could cross-refer to. */}
          <section className="lf-card legal__preamble" aria-labelledby="legal-preamble">
            <h2 className="lf-card__title" id="legal-preamble">
              Preamble
            </h2>
            <div className="lf-card__body">
              <HelpProse text={content.preamble} />
            </div>
          </section>

          {content.sections.map((s, ai) => (
            <section className="lf-card legal__section" key={s.id} aria-labelledby={`legal-${s.id}`}>
              <h2 className="lf-card__title" id={`legal-${s.id}`}>
                <span className="legal__artnum">{ai + 1}.</span> {s.title}
              </h2>
              <div className="lf-card__body">
                <ol className="legal__clauses">
                  {s.clauses.map((c, ci) => (
                    <li className="legal__clause" key={ci}>
                      <span className="legal__num" aria-hidden="true">
                        {ai + 1}.{ci + 1}
                      </span>
                      <div className="legal__clausebody">
                        <HelpProse text={c.text} />
                        {c.items.length > 0 && (
                          <ol className="legal__subclauses">
                            {c.items.map((it, ii) => (
                              <li className="legal__subclause" key={ii}>
                                <span className="legal__num" aria-hidden="true">
                                  {ai + 1}.{ci + 1}.{LETTERS[ii]}
                                </span>
                                <div className="legal__clausebody">
                                  <HelpProse text={it} />
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ))}

          {/* THE COMMITMENTS — Article 5. Rendered from the served array in the served order.
              Their numbering is part of what they are ("Commitment 5" is cited by name across the
              specs), and here it coincides with the clause numbering: Commitment n IS clause 5.n.
              That is why this article is NOT re-implemented as a plain list — the register's
              numbering and the Commitments' own numbering must be the same numbers, not two
              schemes that happen to agree today. */}
          <section className="lf-card legal__section" aria-labelledby="legal-commitments">
            <h2 className="lf-card__title" id="legal-commitments">
              <span className="legal__artnum">{content.sections.length + 1}.</span>{" "}
              {content.commitments.title}
            </h2>
            <div className="lf-card__body">
              <HelpProse text={content.commitments.intro} />
              <ol className="legal__clauses legal__commitments">
                {content.commitments.items.map((g, i) => (
                  <li className="legal__clause legal__commitment" key={i}>
                    <span className="legal__num" aria-hidden="true">
                      {content.sections.length + 1}.{i + 1}
                    </span>
                    <div className="legal__clausebody">
                      <HelpProse text={g} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* THE POINTERS — Article 6. The FILE NAME is canonical (§9-5). §11-3 (9-5-bis) now
              permits a CONVENIENCE link beside it, and the three conditions are enforced here:
              it is marked as a convenience in the rendered text, it carries rel="noreferrer
              noopener", and it is NEVER LOAD-BEARING — delete every url and this article still
              says everything it says now, which is what a local-first page has to do. */}
          <section className="lf-card legal__section" aria-labelledby="legal-pointers">
            <h2 className="lf-card__title" id="legal-pointers">
              <span className="legal__artnum">{content.sections.length + 2}.</span> Where to Find
              the Full Record
            </h2>
            <div className="lf-card__body">
              <dl className="legal__pointers">
                {content.pointers.map((p) => (
                  <div className="legal__pointer" key={p.file}>
                    <dt className="legal__file">{p.file}</dt>
                    <dd className="legal__what">
                      {p.what}
                      {p.url && (
                        <>
                          {" "}
                          <a
                            className="legal__convenience"
                            href={p.url}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Read it online
                          </a>{" "}
                          <span className="legal__conveniencenote">
                            (a convenience link — the file above is the canonical text)
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Legal;
