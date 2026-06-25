import { useEffect, useState } from "react";

export function Clock({ timezone }: { timezone?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(now);

  return (
    <div className="text-center leading-tight">
      <div className="tnum text-xl font-semibold">{time}</div>
      <div className="text-xs text-muted">{date}{timezone ? ` · ${timezone}` : ""}</div>
    </div>
  );
}
