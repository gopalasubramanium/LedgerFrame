import { useCallback, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AskPanel } from "./components/AskPanel";
import { LockScreen } from "./components/LockScreen";
import { DemoBadge } from "./components/ui";
import { useRotation } from "./hooks/useRotation";
import { useApp } from "./store/app";
import { Clock } from "./components/Clock";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import Holdings from "./pages/Holdings";
import Markets from "./pages/Markets";
import HeatmapPage from "./pages/Heatmap";
import News from "./pages/News";
import Snapshot from "./pages/Snapshot";
import GlobalAssets from "./pages/GlobalAssets";
import InstrumentDetail from "./pages/InstrumentDetail";
import Settings from "./pages/Settings";

const NAV = [
  { path: "/", page: "home", label: "Home" },
  { path: "/portfolio", page: "portfolio", label: "Portfolio" },
  { path: "/holdings", page: "holdings", label: "Holdings" },
  { path: "/markets", page: "markets", label: "Markets" },
  { path: "/heatmap", page: "heatmap", label: "Heatmap" },
  { path: "/global", page: "global", label: "Global" },
  { path: "/news", page: "news", label: "News" },
  { path: "/snapshot", page: "snapshot", label: "Snapshot" },
  { path: "/settings", page: "settings", label: "Settings" },
];

const ROTATION_PAGES = ["/", "/portfolio", "/markets", "/heatmap", "/news"];

export default function App() {
  const { status, locked } = useApp();
  const [asking, setAsking] = useState(false);
  const [rotate, setRotate] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const onRotate = useCallback((path: string) => navigate(path), [navigate]);
  const { paused } = useRotation({
    pages: ROTATION_PAGES,
    intervalMs: 30000,
    enabled: rotate && !asking && !locked,
    current: location.pathname,
    onChange: onRotate,
  });

  // Force PIN setup when LAN is on but none is set (prevents a locked-out state).
  if (status?.allow_lan && status?.pin_set === false) return <LockScreen mode="setup" />;
  if (locked) return <LockScreen mode="unlock" />;

  return (
    <div className="h-screen flex flex-col bg-base text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-line bg-surface/60">
        <div className="flex items-center gap-4">
          <span className="text-accent font-semibold tracking-tight text-lg">LedgerFrame</span>
          {status?.demo_mode && <DemoBadge />}
        </div>
        <Clock timezone={status?.timezone} />
        <div className="flex items-center gap-2">
          <button
            className={`lf-btn ${rotate ? "border-accent text-accent" : ""}`}
            onClick={() => setRotate((v) => !v)}
            title="Toggle dashboard rotation"
          >
            {rotate ? (paused ? "❚❚ Paused" : "⟳ Rotating") : "⟳ Rotate"}
          </button>
          <button className="lf-btn-accent" onClick={() => setAsking(true)}>Ask</button>
        </div>
      </header>

      {/* Nav rail + content */}
      <div className="flex flex-1 min-h-0">
        <nav className="w-44 shrink-0 border-r border-line bg-surface/40 py-3 px-2 overflow-y-auto" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              className={({ isActive }) =>
                `touch flex items-center px-4 rounded-card mb-1 text-sm font-medium transition-colors ${
                  isActive ? "bg-elevated text-accent" : "text-muted hover:text-ink hover:bg-elevated/50"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 min-h-0 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            <Route path="/global" element={<GlobalAssets />} />
            <Route path="/news" element={<News />} />
            <Route path="/snapshot" element={<Snapshot />} />
            <Route path="/instrument/:symbol" element={<InstrumentDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>

      {/* Rotation page indicators */}
      {rotate && (
        <div className="flex justify-center gap-2 py-2 border-t border-line bg-surface/40">
          {ROTATION_PAGES.map((p) => (
            <span
              key={p}
              className={`h-2 w-2 rounded-full ${location.pathname === p ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      )}

      {asking && <AskPanel onClose={() => setAsking(false)} />}
    </div>
  );
}
