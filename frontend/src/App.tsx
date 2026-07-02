import { useCallback, useEffect, useState } from "react";
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
import { NavIcon } from "./components/NavIcon";
import { loadNav, NAV_CHANGED_EVENT } from "./lib/nav";

const ROTATION_PAGES = ["/", "/portfolio", "/markets", "/heatmap", "/news"];

export default function App() {
  const { status, locked, theme, setTheme } = useApp();
  const [asking, setAsking] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("lf_sidebar_collapsed") === "1");
  const [nav, setNav] = useState(loadNav);

  const toggleCollapsed = () =>
    setCollapsed((v) => { const n = !v; localStorage.setItem("lf_sidebar_collapsed", n ? "1" : "0"); return n; });
  const navigate = useNavigate();
  const location = useLocation();

  // Re-read the (user-customised) nav order/labels when Settings changes them.
  useEffect(() => {
    const onChange = () => setNav(loadNav());
    window.addEventListener(NAV_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(NAV_CHANGED_EVENT, onChange);
  }, []);

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

  const navLinks = (onClick?: () => void, mini = false) =>
    nav.map((n) => (
      <NavLink
        key={n.path}
        to={n.path}
        end={n.path === "/"}
        onClick={onClick}
        title={mini ? n.label : undefined}
        className={({ isActive }) =>
          `touch flex items-center gap-3 rounded-card mb-1 text-sm font-medium transition-colors ${
            mini ? "justify-center px-0" : "px-4"
          } ${isActive ? "bg-elevated text-accent" : "text-muted hover:text-ink hover:bg-elevated/50"}`
        }
      >
        <NavIcon path={n.path} />
        {!mini && <span className="truncate">{n.label}</span>}
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
        {/* Desktop side rail — collapsible to reclaim screen real estate */}
        <nav
          className={`hidden md:flex md:flex-col shrink-0 border-r border-line bg-surface/40 py-3 px-2 transition-[width] duration-200 ${collapsed ? "w-16" : "w-44"}`}
          aria-label="Primary"
        >
          <button
            className={`touch flex items-center gap-3 mb-2 rounded-card text-sm font-medium text-muted hover:text-ink hover:bg-elevated/60 ${collapsed ? "justify-center px-0" : "px-4 justify-start"}`}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
              {collapsed ? <path d="M13 18l6-6-6-6M5 18l6-6-6-6" /> : <path d="M11 18l-6-6 6-6M19 18l-6-6 6-6" />}
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
          <div className="flex-1 overflow-y-auto">{navLinks(undefined, collapsed)}</div>
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
