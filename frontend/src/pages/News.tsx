import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { timeAgo } from "../lib/format";

export default function News() {
  const news = useApi(api.news, 120000);
  const home = useApi(api.home, 120000);

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="AI briefing" className="col-span-12 lg:col-span-5">
        <p className="text-ink leading-relaxed">{home.data?.briefing.text ?? "—"}</p>
        <p className="text-xs text-faint mt-3">Grounded in your portfolio + market data. Information only, not financial advice.</p>
      </Card>

      <Card title="Headlines" className="col-span-12 lg:col-span-7">
        <ul className="divide-y divide-line/50">
          {news.data?.items.map((item, i) => (
            <li key={i} className="py-3">
              <div className="text-ink">{item.headline}</div>
              <div className="text-xs text-faint mt-1">
                {item.source} · {timeAgo(item.published_at)}
                {item.symbols.length > 0 && ` · ${item.symbols.join(", ")}`}
              </div>
            </li>
          ))}
          {(!news.data || news.data.items.length === 0) && (
            <li className="py-3 text-muted">No headlines available. Configure a market data provider for live news.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
