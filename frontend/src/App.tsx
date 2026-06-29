import { useCallback, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import InstrumentDetail from "./pages/InstrumentDetail";
import Settings from "./pages/Settings";
import Legal from "./pages/Legal";
import { UpdateBanner } from "./components/UpdateBanner";
import { Footer } from "./components/Footer";
import { ActivityPip } from "./components/Activity";

const NAV = [
  { path: "/", label: "Home" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/holdings", label: "Holdings" },
  { path: "/markets", label: "Markets" },
  { path: "/heatmap", label: "Heatmap" },
  { path: "/news", label: "News" },
  { path: "/snapshot", label: "Snapshot" },
  { path: "/settings", label: "Settings" },
  { path: "/legal", label: "Legal" },
];

const ROTATION_PAGES = ["/", "/portfolio", "/markets", "/heatmap", "/news"];

export default function App() {
  const { status, locked, theme, setTheme } = useApp();
  const [asking, setAsking] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  if (status?.allow_lan && status?.pin_set === false) return <LockScreen mode="setup" />;
  if (locked) return <LockScreen mode="unlock" />;

  const cycleTheme = () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  const themeIcon = theme === "light" ? "☀" : theme === "dark" ? "☾" : "◑";

  const navLinks = (onClick?: () => void) =>
    NAV.map((n) => (
      <NavLink
        key={n.path}
        to={n.path}
        end={n.path === "/"}
        onClick={onClick}
        className={({ isActive }) =>
          `touch flex items-center px-4 rounded-card mb-1 text-sm font-medium transition-colors ${
            isActive ? "bg-elevated text-accent" : "text-muted hover:text-ink hover:bg-elevated/50"
          }`
        }
      >
        {n.label}
      </NavLink>
    ));

  return (
    <div className="h-screen flex flex-col bg-base text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 border-b border-line bg-surface/60">
        <div className="flex items-center gap-3 min-w-0">
          <button className="lf-btn md:hidden px-3" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
          <span className="lf-wordmark text-accent font-semibold text-lg">LedgerFrame</span>
          {status?.demo_mode && <span className="hidden sm:inline"><DemoBadge /></span>}
        </div>
        <div className="hidden md:block"><Clock timezone={status?.timezone} /></div>
        <div className="flex items-center gap-2">
          <ActivityPip />
          <button className="lf-btn px-3" onClick={cycleTheme} title={`Theme: ${theme}`} aria-label="Toggle theme">{themeIcon}</button>
          <button
            className={`lf-btn hidden sm:inline-flex ${rotate ? "border-accent text-accent" : ""}`}
            onClick={() => setRotate((v) => !v)}
            title="Toggle dashboard rotation"
          >
            {rotate ? (paused ? "❚❚" : "⟳") : "⟳"}
          </button>
          <button className="lf-btn-accent" onClick={() => setAsking(true)}>Ask</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop side rail */}
        <nav className="hidden md:block w-44 shrink-0 border-r border-line bg-surface/40 py-3 px-2 overflow-y-auto" aria-label="Primary">
          {navLinks()}
        </nav>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <nav className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-line py-4 px-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="lf-wordmark text-accent font-semibold">LedgerFrame</span>
                <button className="lf-btn px-3" onClick={() => setMenuOpen(false)} aria-label="Close">✕</button>
              </div>
              {navLinks(() => setMenuOpen(false))}
            </nav>
          </div>
        )}

        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            <Route path="/global" element={<Navigate to="/markets" replace />} />
            <Route path="/news" element={<News />} />
            <Route path="/snapshot" element={<Snapshot />} />
            <Route path="/instrument/:symbol" element={<InstrumentDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/legal" element={<Legal />} />
          </Routes>
        </main>
      </div>

      {rotate && (
        <div className="hidden sm:flex justify-center gap-2 py-2 border-t border-line bg-surface/40">
          {ROTATION_PAGES.map((p) => (
            <span key={p} className={`h-2 w-2 rounded-full ${location.pathname === p ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      )}

      <Footer />

      {asking && <AskPanel onClose={() => setAsking(false)} />}
      <UpdateBanner />
    </div>
  );
}
