import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { timeAgo } from "../lib/format";

export default function News() {
  const news = useApi(api.news, 120000);
  const home = useApi(api.home, 120000);
  const rss = news.data?.rss_count ?? 0;

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="AI briefing" className="col-span-12 lg:col-span-5">
        <p className="text-ink leading-relaxed">{home.data?.briefing.text ?? "—"}</p>
        <p className="text-xs text-faint mt-3">Grounded in your portfolio + market data. Information only, not financial advice.</p>
      </Card>

      <Card
        title="Headlines"
        className="col-span-12 lg:col-span-7"
        action={<span className="text-xs text-faint">{rss > 0 ? `${rss} from RSS` : "RSS: 0"}</span>}
      >
        {news.loading && !news.data && <p className="text-muted text-sm">Loading headlines…</p>}
        <ul className="divide-y divide-line/50">
          {news.data?.items.map((item, i) => (
            <li key={i} className="py-3">
              {item.url ? (
                <a className="text-ink hover:text-accent" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
              ) : (
                <div className="text-ink">{item.headline}</div>
              )}
              {item.summary && <div className="text-sm text-muted mt-1 line-clamp-2">{item.summary}</div>}
              <div className="text-xs text-faint mt-1">
                {item.source} · {timeAgo(item.published_at)}
                {item.symbols.length > 0 && ` · ${item.symbols.join(", ")}`}
              </div>
            </li>
          ))}
          {news.data && news.data.items.length === 0 && (
            <li className="py-3 text-muted text-sm">
              No headlines. Add RSS feed URLs in <Link to="/settings" className="text-accent">Settings → News feeds</Link>,
              then use <span className="text-ink">Test feeds</span> there to check they work.
            </li>
          )}
        </ul>
        {rss === 0 && news.data && news.data.items.length > 0 && (
          <p className="text-xs text-warn mt-3">
            Showing provider headlines only — your RSS feeds returned nothing. Open
            <Link to="/settings" className="text-accent"> Settings → News feeds → Test feeds</Link> to see why.
          </p>
        )}
      </Card>
    </div>
  );
}
