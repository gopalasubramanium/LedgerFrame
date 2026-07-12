import { Link } from "react-router-dom";
import "./news.css";
import { EmptyState } from "./EmptyState";
import { relativeTime } from "../../format/time";

// Extracted from the Instrument Detail news list (the recurring-pattern rule, page-news ND-5): a list
// of headlines, each an EXTERNAL link opening in a new tab + a `source · relative-time` meta line, with
// optional per-symbol links to InstrumentDetail. Headlines render as PLAIN TEXT (React escapes; the
// backend also sanitises untrusted feeds — ND-12) and are clamped with an ellipsis so a long headline
// never forces overflow. Shared by News (grouped) and InstrumentDetail (scoped).
export interface NewsListItem {
  headline: string;
  source: string;
  url?: string | null;
  published_at: string | null;
  symbols?: string[];
}

export interface NewsListProps {
  items: NewsListItem[];
  /** Show per-symbol links to InstrumentDetail (grouped News); off for the scoped instrument view. */
  showSymbols?: boolean;
  emptyMessage?: string;
  emptyReason?: string;
}

export function NewsList({
  items,
  showSymbols = false,
  emptyMessage = "No recent news",
  emptyReason = "No headlines right now.",
}: NewsListProps) {
  if (items.length === 0) return <EmptyState message={emptyMessage} reason={emptyReason} />;
  return (
    <ul className="lf-newslist">
      {items.map((n, i) => (
        <li className="lf-newslist__item" key={`${n.url ?? n.headline}-${i}`}>
          {n.url ? (
            <a className="lf-newslist__head" href={n.url} target="_blank" rel="noreferrer noopener">
              {n.headline}
            </a>
          ) : (
            <span className="lf-newslist__head lf-newslist__head--plain">{n.headline}</span>
          )}
          <span className="lf-newslist__meta">
            {n.source}
            {n.published_at ? ` · ${relativeTime(n.published_at)}` : ""}
            {showSymbols && n.symbols && n.symbols.length > 0 ? (
              <>
                {" · "}
                {n.symbols.map((s, j) => (
                  <span key={s}>
                    {j > 0 ? " " : ""}
                    <Link className="lf-newslist__sym" to={`/instrument/${encodeURIComponent(s)}`}>{s}</Link>
                  </span>
                ))}
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
