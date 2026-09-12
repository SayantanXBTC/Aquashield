import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingOverlay } from "@/components/ui";
import { useAuth } from "./useAuth";

/** Route guard: renders children only for a signed-in user; otherwise
 * bounces to the sign-in gateway (`/explore`), remembering where the user
 * was headed. Unconfigured Firebase also lands on the gateway, which is
 * where the configuration error is explained. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <LoadingOverlay stages={["Session"]} />;
  if (status !== "signed-in") return <Navigate to="/explore" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
