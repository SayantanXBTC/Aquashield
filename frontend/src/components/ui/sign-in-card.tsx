import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Glassmorphic auth card — adapted from the "sign-in-card-2" community
 * component: framer-motion 3D tilt, travelling edge beams, and animated
 * inputs kept; the purple palette, next/link and the fake 2 s submit
 * replaced with AQUASHIELD's cyan-on-void tokens, plain callbacks, and
 * three real modes (sign in / create account / reset password).
 *
 * The card owns only form state. Every credential action is a prop the
 * gateway page wires to Firebase; the card never imports firebase itself.
 */

export type AuthMode = "signin" | "signup" | "reset";

export interface SignInCardProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  onReset: (email: string) => Promise<void>;
  onGoogle: () => Promise<void>;
  /** A blocking, non-recoverable problem (Firebase not configured). */
  disabledReason?: string | null;
  className?: string;
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-transparent bg-white/5 px-3 py-1 text-sm text-ink outline-none transition-all duration-300 placeholder:text-white/30",
        "focus:border-accent/40 focus:bg-white/10",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

const BEAM = "absolute bg-gradient-to-r from-transparent via-accent-strong to-transparent opacity-70";

function EdgeBeams() {
  const shared = { ease: "easeInOut" as const, repeat: Infinity, repeatDelay: 1, duration: 2.5 };
  return (
    <div className="absolute -inset-[1px] overflow-hidden rounded-2xl" aria-hidden="true">
      <motion.div
        className={cn(BEAM, "top-0 left-0 h-[2px] w-[50%]")}
        initial={{ filter: "blur(2px)" }}
        animate={{ left: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
        transition={{ left: shared, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror" } }}
      />
      <motion.div
        className="absolute top-0 right-0 h-[50%] w-[2px] bg-gradient-to-b from-transparent via-accent-strong to-transparent opacity-70"
        initial={{ filter: "blur(2px)" }}
        animate={{ top: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
        transition={{ top: { ...shared, delay: 0.6 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 0.6 } }}
      />
      <motion.div
        className={cn(BEAM, "right-0 bottom-0 h-[2px] w-[50%]")}
        initial={{ filter: "blur(2px)" }}
        animate={{ right: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
        transition={{ right: { ...shared, delay: 1.2 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.2 } }}
      />
      <motion.div
        className="absolute bottom-0 left-0 h-[50%] w-[2px] bg-gradient-to-b from-transparent via-accent-strong to-transparent opacity-70"
        initial={{ filter: "blur(2px)" }}
        animate={{ bottom: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
        transition={{ bottom: { ...shared, delay: 1.8 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.8 } }}
      />
    </div>
  );
}

const COPY: Record<AuthMode, { title: string; subtitle: string; cta: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to the command center", cta: "Sign in" },
  signup: { title: "Create account", subtitle: "Your scenarios stay private to you", cta: "Create account" },
  reset: { title: "Reset password", subtitle: "We'll email you a reset link", cta: "Send reset link" },
};

export function SignInCard({ onSignIn, onSignUp, onReset, onGoogle, disabledReason = null, className }: SignInCardProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const run = async (kind: "form" | "google", action: () => Promise<void>) => {
    if (busy || disabledReason) return;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run("form", async () => {
      if (mode === "signin") await onSignIn(email, password);
      else if (mode === "signup") await onSignUp(email, password, displayName);
      else {
        await onReset(email);
        setNotice("Reset link sent — check your inbox.");
        setMode("signin");
      }
    });
  };

  const copy = COPY[mode];
  const disabled = Boolean(disabledReason) || busy !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className={cn("relative z-10 w-full max-w-sm", className)}
      style={{ perspective: 1500 }}
    >
      <motion.div className="relative" style={{ rotateX, rotateY }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="group relative">
          <EdgeBeams />
          <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-accent/5 via-accent/15 to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-70" />

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/45 p-6 shadow-2xl backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                backgroundSize: "30px 30px",
              }}
            />

            <div className="mb-5 space-y-1 text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="relative mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-accent/30"
              >
                <ShieldCheck className="h-5 w-5 text-accent-strong" />
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-60" />
              </motion.div>
              <motion.h1
                key={copy.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-b from-white to-white/80 bg-clip-text text-xl font-bold text-transparent"
              >
                {copy.title}
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-xs text-white/60">
                {copy.subtitle}
              </motion.p>
            </div>

            {disabledReason ? (
              <p role="alert" className="mb-4 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-[11px] leading-relaxed text-status-warning">
                {disabledReason}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                {mode === "signup" ? (
                  <motion.div className="relative" whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <User className={cn("absolute left-3 h-4 w-4 transition-colors", focusedInput === "name" ? "text-accent-strong" : "text-white/40")} />
                      <Input
                        type="text"
                        placeholder="Display name"
                        autoComplete="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onFocus={() => setFocusedInput("name")}
                        onBlur={() => setFocusedInput(null)}
                        disabled={disabled}
                        className="pl-10"
                      />
                    </div>
                  </motion.div>
                ) : null}

                <motion.div className="relative" whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Mail className={cn("absolute left-3 h-4 w-4 transition-colors", focusedInput === "email" ? "text-accent-strong" : "text-white/40")} />
                    <Input
                      type="email"
                      placeholder="Email address"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      disabled={disabled}
                      className="pl-10"
                    />
                  </div>
                </motion.div>

                {mode !== "reset" ? (
                  <motion.div className="relative" whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock className={cn("absolute left-3 h-4 w-4 transition-colors", focusedInput === "password" ? "text-accent-strong" : "text-white/40")} />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedInput("password")}
                        onBlur={() => setFocusedInput(null)}
                        disabled={disabled}
                        className="pr-10 pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 cursor-pointer text-white/40 transition-colors hover:text-white"
                      >
                        {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </div>

              {mode === "signin" ? (
                <div className="flex items-center justify-end pt-1 text-xs">
                  <button type="button" onClick={() => switchMode("reset")} className="cursor-pointer text-white/60 transition-colors hover:text-white">
                    Forgot password?
                  </button>
                </div>
              ) : null}

              <AnimatePresence mode="wait">
                {error ? (
                  <motion.p key="error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-[11px] leading-relaxed text-status-critical">
                    {error}
                  </motion.p>
                ) : notice ? (
                  <motion.p key="notice" role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-status-ok/40 bg-status-ok/10 px-3 py-2 text-[11px] leading-relaxed text-status-ok">
                    {notice}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={disabled} className="group/button relative mt-3 w-full cursor-pointer disabled:cursor-not-allowed">
                <div className="absolute inset-0 rounded-lg bg-accent/20 opacity-0 blur-lg transition-opacity duration-300 group-hover/button:opacity-70" />
                <div className="relative flex h-10 items-center justify-center overflow-hidden rounded-lg bg-white font-medium text-black transition-all duration-300">
                  <motion.div
                    className="absolute inset-0 -z-10 bg-gradient-to-r from-white/0 via-accent/30 to-white/0"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                    style={{ opacity: busy === "form" ? 1 : 0, transition: "opacity 0.3s ease" }}
                  />
                  <AnimatePresence mode="wait">
                    {busy === "form" ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/70 border-t-transparent" />
                      </motion.div>
                    ) : (
                      <motion.span key={copy.cta} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-1 text-sm font-medium">
                        {copy.cta}
                        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover/button:translate-x-1" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>

              {mode !== "reset" ? (
                <>
                  <div className="relative mt-2 mb-4 flex items-center">
                    <div className="flex-grow border-t border-white/5" />
                    <span className="mx-3 text-xs text-white/40">or</span>
                    <div className="flex-grow border-t border-white/5" />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={disabled}
                    onClick={() => void run("google", onGoogle)}
                    className="group/google relative w-full cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 blur transition-opacity duration-300 group-hover/google:opacity-70" />
                    <div className="relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 font-medium text-white transition-all duration-300 hover:border-white/20">
                      {busy === "google" ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      ) : (
                        <GoogleMark />
                      )}
                      <span className="text-xs text-white/80 transition-colors group-hover/google:text-white">
                        {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
                      </span>
                    </div>
                  </motion.button>
                </>
              ) : null}

              <motion.p className="mt-4 text-center text-xs text-white/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                {mode === "signin" ? (
                  <>
                    No account?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="group/link relative inline-block cursor-pointer font-medium text-white transition-colors hover:text-white/70">
                      Sign up
                      <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-white transition-all duration-300 group-hover/link:w-full" />
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => switchMode("signin")} className="inline-flex cursor-pointer items-center gap-1 font-medium text-white transition-colors hover:text-white/70">
                    <ArrowLeft className="h-3 w-3" /> Back to sign in
                  </button>
                )}
              </motion.p>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
