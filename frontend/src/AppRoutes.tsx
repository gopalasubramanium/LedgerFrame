import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { KitchenSink } from "./routes/KitchenSink";
import { Holdings } from "./routes/Holdings";
import { Portfolio } from "./routes/Portfolio";
import { NetWorth } from "./routes/NetWorth";
import { Markets } from "./routes/Markets";
import { Heatmap } from "./routes/Heatmap";
import { News } from "./routes/News";
import { Review } from "./routes/Review";
import { Policy } from "./routes/Policy";
import { CashFlow } from "./routes/CashFlow";
import { Insurance } from "./routes/Insurance";
import { Scenarios } from "./routes/Scenarios";
import { PricingHealth } from "./routes/PricingHealth";
import { InstrumentDetail } from "./routes/InstrumentDetail";
import { Home } from "./routes/Home";
import { NotBuilt } from "./routes/NotBuilt";

// The app route tree (D-066): every product route renders inside the ONE AppShell;
// the kitchen-sink gallery is deliberately outside it. Extracted from main.tsx so the
// shell-hosting + redirects are unit-testable without booting the whole app.
export function AppRoutes() {
  return (
    <Routes>
      {/* Component gallery — OUTSIDE the shell (it demonstrates chrome). */}
      <Route path="/kitchen-sink" element={<KitchenSink />} />
      {/* Everything else inside the shell. */}
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              {/* Home — the ratified grid (§12ho1-5), wired to the canonical readers (§12ho1-6:
                * ONE layout, so there is no composition to choose). */}
              <Route path="/" element={<Home />} />
              <Route path="/net-worth" element={<NetWorth />} />
              <Route path="/holdings" element={<Holdings />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/markets" element={<Markets />} />
        <Route path="/heatmap" element={<Heatmap />} />
              <Route path="/news" element={<News />} />
              <Route path="/review" element={<Review />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/cash-flow" element={<CashFlow />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/instrument/:symbol" element={<InstrumentDetail />} />
              <Route path="/pricing-health" element={<PricingHealth />} />
              {/* Route redirects (D-042/D-022/D-056). */}
              <Route path="/snapshot" element={<Navigate to="/net-worth" replace />} />
              <Route path="/planning" element={<Navigate to="/cash-flow" replace />} />
              {/* /global removed — no legacy redirect (D-042). */}
              {/* Navigable-but-unbuilt routes + redirect targets land here. */}
              <Route path="*" element={<NotBuilt />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
