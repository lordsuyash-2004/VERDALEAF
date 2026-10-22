// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  const links = [
    { to: "/dashboard", label: "Diagnose", testid: "diagnose" },
    ...(user ? [{ to: "/history", label: "History", testid: "history" }] : []),
    { to: "/dashboard#library", label: "Library", testid: "library" },
    { to: "/dashboard#tips", label: "Care Tips", testid: "tips" },
  ];

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl bg-botanical-bg/70 border-b border-botanical-forest/10"
      data-testid="app-header"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group shrink-0" data-testid="brand-link">
          <span className="w-8 h-8 rounded-full bg-botanical-forest flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Leaf className="w-4 h-4 text-white" />
          </span>
          <span className="font-serif text-xl text-botanical-ink tracking-tight">Verdaleaf</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-botanical-muted">
          {links.map((l) =>
            l.to.includes("#") ? (
              <a key={l.to} href={l.to} className="hover:text-botanical-forest transition-colors" data-testid={`nav-${l.testid}`}>
                {l.label}
              </a>
            ) : (
              <Link key={l.to} to={l.to} className="hover:text-botanical-forest transition-colors" data-testid={`nav-${l.testid}`}>
                {l.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2" data-testid="user-badge">
                {user.picture && (
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-botanical-forest/20" />
                )}
                <span className="text-sm text-botanical-ink max-w-[10rem] truncate">{user.name}</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="hidden md:inline-flex rounded-full text-botanical-muted hover:text-botanical-forest hover:bg-botanical-sage/30"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4 mr-1" /> Sign out
              </Button>
            </>
          ) : (
            <Button
              onClick={handleLogin}
              className="rounded-full bg-botanical-forest text-white hover:bg-botanical-hover active:scale-95 transition-all text-xs sm:text-sm px-3 sm:px-4"
              data-testid={location.pathname === "/" ? "header-login-button" : "header-login-button-dash"}
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with Google</span>
            </Button>
          )}

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden w-9 h-9 rounded-full border border-botanical-forest/20 flex items-center justify-center text-botanical-forest dark:text-botanical-moss active:scale-90 transition-transform"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            data-testid="mobile-menu-btn"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden border-t border-botanical-forest/10 bg-botanical-bg/95 backdrop-blur-xl px-4 py-3 animate-in slide-in-from-top-2 duration-200"
          data-testid="mobile-menu"
        >
          {user && (
            <div className="flex items-center gap-3 pb-3 mb-1 border-b border-botanical-forest/10">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full border border-botanical-forest/20" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 flex items-center justify-center text-botanical-forest dark:text-botanical-moss text-sm font-semibold">
                  {user.name?.[0] || "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm text-botanical-ink truncate">{user.name}</p>
                <p className="text-xs text-botanical-muted truncate">{user.email}</p>
              </div>
            </div>
          )}
          {links.map((l) =>
            l.to.includes("#") ? (
              <a
                key={l.to}
                href={l.to}
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-base text-botanical-ink border-b border-botanical-forest/5 last:border-0"
                data-testid={`mobile-nav-${l.testid}`}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-base text-botanical-ink border-b border-botanical-forest/5 last:border-0"
                data-testid={`mobile-nav-${l.testid}`}
              >
                {l.label}
              </Link>
            )
          )}
          {user && (
            <button
              onClick={handleLogout}
              className="w-full text-left py-3 text-base text-botanical-muted flex items-center gap-2"
              data-testid="mobile-logout-button"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
