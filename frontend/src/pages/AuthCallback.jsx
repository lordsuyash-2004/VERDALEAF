// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Leaf } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(match[1]);

    (async () => {
      try {
        const r = await axios.post(`${API}/auth/session`, { session_id });
        setUser(r.data);
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: r.data } });
      } catch (e) {
        console.error("Auth exchange failed", e);
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-botanical-bg" data-testid="auth-callback">
      <div className="flex flex-col items-center gap-4">
        <Leaf className="w-10 h-10 text-botanical-forest animate-pulse" />
        <p className="font-serif text-2xl text-botanical-ink">Growing your session…</p>
      </div>
    </div>
  );
}
