import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoadingOverlay } from "@/components/ui";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { LandingPage } from "@/features/landing/LandingPage";
import { ExploreGatewayPage } from "@/features/landing/ExploreGatewayPage";

// The command center (Three.js/R3F/drei) stays out of the initial bundle —
// the landing page is the first thing a visitor loads (CLAUDE.md §27).
const CommandCenterPage = lazy(() => import("@/features/command-center/CommandCenterPage"));

const COMMAND_CENTER_LOADING_STAGES = ["Environment", "Simulation", "Visualization", "Command Systems"];

function CommandCenterRoute() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingOverlay stages={COMMAND_CENTER_LOADING_STAGES} />}>
        <CommandCenterPage />
      </Suspense>
    </RequireAuth>
  );
}

/** Routes: "/" landing, "/explore" sign-in gateway, "/command-center" the
 * authenticated console. The standalone scenario builder route is gone —
 * scenarios are created and tuned inside the command center. */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<ExploreGatewayPage />} />
          <Route path="/command-center" element={<CommandCenterRoute />} />
          <Route path="/scenarios" element={<Navigate to="/command-center" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
