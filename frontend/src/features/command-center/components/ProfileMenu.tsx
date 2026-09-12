import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return chars.toUpperCase();
}

/** Header profile widget: Google photo (or initials for email accounts),
 * a dropdown with the account details, and Sign out — which clears the
 * Firebase session and returns to the landing page. */
export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const showPhoto = Boolean(user.photoURL) && !imgFailed;

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex h-8 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pr-2.5 pl-0.5 transition-colors hover:bg-white/[0.08]",
          open && "bg-white/[0.08]",
        )}
      >
        <span className="bg-accent/20 text-accent-strong flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold">
          {showPhoto ? (
            <img src={user.photoURL ?? ""} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
          ) : (
            initials(user.displayName, user.email)
          )}
        </span>
        <span className="text-ink hidden max-w-[120px] truncate text-xs font-medium md:inline">{user.displayName ?? user.email}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-[8px] border border-white/[0.08] bg-[rgba(9,14,20,0.9)] shadow-[0_18px_48px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.06] p-3">
            <span className="bg-accent/20 text-accent-strong flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold">
              {showPhoto ? <img src={user.photoURL ?? ""} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initials(user.displayName, user.email)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-ink truncate text-sm font-medium">{user.displayName ?? "—"}</span>
              <span className="text-ink-faint truncate text-[11px]">{user.email ?? "—"}</span>
              <span className="text-ink-faint mt-1 text-[10px] tracking-[0.14em] uppercase">
                {user.providerId === "google.com" ? "Google account" : "Email account"}
              </span>
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="text-ink-soft hover:text-ink flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-white/[0.05]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
