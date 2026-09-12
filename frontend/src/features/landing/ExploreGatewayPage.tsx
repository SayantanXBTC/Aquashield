import { useCallback, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { IconShield } from "@/components/ui/icons";
import { SignInCard } from "@/components/ui/sign-in-card";
import { describeAuthError } from "@/features/auth/authErrors";
import { MISSING_FIREBASE_CONFIG_MESSAGE } from "@/features/auth/firebase";
import { useAuth } from "@/features/auth/useAuth";
import { FluidBackdrop } from "./FluidBackdrop";
import { WarpTransition } from "./WarpTransition";

/**
 * "/explore" — the sign-in gateway. Nothing on this screen but the auth
 * card over the fluid backdrop. A successful sign-in (or an already-active
 * session arriving here) triggers the warp transition, then hands off to
 * the command center, whose camera continues the motion with its own
 * dolly-in.
 */
export function ExploreGatewayPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [warping, setWarping] = useState(false);
  // Firebase flips `status` to signed-in before the sign-in promise
  // resolves; this keeps the redirect guard below from short-circuiting the
  // warp in that window.
  const [attempting, setAttempting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from.startsWith("/") ? from : "/command-center";

  const wrap = useCallback(
    (action: () => Promise<void>) => async () => {
      setAttempting(true);
      try {
        await action();
        setWarping(true);
      } catch (err) {
        setAttempting(false);
        throw new Error(describeAuthError(err), { cause: err });
      }
    },
    [],
  );

  const handleComplete = useCallback(() => {
    navigate(destination, { replace: true, state: { entrance: "warp" } });
  }, [navigate, destination]);

  // Already signed in and not mid-warp: skip the card entirely.
  if (auth.status === "signed-in" && !warping && !attempting) {
    return <Navigate to={destination} replace />;
  }

  const disabledReason = auth.status === "unconfigured" ? MISSING_FIREBASE_CONFIG_MESSAGE : null;

  return (
    <main className="bg-void relative h-screen w-screen overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={warping ? { scale: 1.35, opacity: 0.4 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.4, 0, 1, 1] }}
      >
        <FluidBackdrop />
      </motion.div>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="text-ink flex items-center gap-2.5" aria-label="AQUASHIELD home">
          <IconShield size={18} className="text-accent" />
          <span className="text-xs font-bold tracking-[0.26em]">AQUASHIELD</span>
        </Link>
      </header>

      <motion.div
        className="relative z-10 flex h-full items-center justify-center px-6"
        animate={warping ? { scale: 2.4, opacity: 0, filter: "blur(6px)" } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.5, 0, 0.9, 0.2] }}
      >
        <SignInCard
          disabledReason={disabledReason}
          onSignIn={(email, password) => wrap(() => auth.signInWithEmail(email, password))()}
          onSignUp={(email, password, name) => wrap(() => auth.signUpWithEmail(email, password, name))()}
          onGoogle={() => wrap(auth.signInWithGoogle)()}
          onReset={async (email) => {
            try {
              await auth.resetPassword(email);
            } catch (err) {
              throw new Error(describeAuthError(err), { cause: err });
            }
          }}
        />
      </motion.div>

      {warping ? <WarpTransition onComplete={handleComplete} /> : null}
    </main>
  );
}
