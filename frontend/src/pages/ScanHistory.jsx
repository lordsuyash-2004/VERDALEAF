// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { History, Trash2, LogIn, Leaf, ShieldAlert, Sprout, Search, X } from "lucide-react";
import Header from "@/components/Header";
import DiagnosisResult from "@/components/DiagnosisResult";
import { Button } from "@/components/ui/button";
import { API, useAuth } from "@/App";
import { useTheme } from "@/theme";
import { toast } from "sonner";

const PAGE = 12;
const FILTERS = [
  { key: "all", label: "All scans" },
  { key: "diseased", label: "Needs attention" },
  { key: "healthy", label: "Healthy" },
];

const sevText = (theme, severity, healthy) => {
  if (healthy) return theme === "dark" ? "#7CBF85" : "#4A6741";
  if (severity === "severe") return theme === "dark" ? "#E8927C" : "#D97757";
  if (severity === "moderate") return theme === "dark" ? "#E8BC84" : "#DDA76A";
  return theme === "dark" ? "#7CBF85" : "#4A6741";
};

const StatCard = ({ icon: Icon, label, value, hint, testid, small }) => (
  <div
    className="rounded-2xl bg-botanical-card border border-botanical-forest/10 p-4 sm:p-5"
    data-testid={testid}
  >
    <div className="flex items-center gap-2 text-botanical-moss">
      <Icon className="w-4 h-4" />
      <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase font-semibold">{label}</p>
    </div>
    <p className={`font-serif mt-2 text-botanical-ink leading-tight truncate ${small ? "text-lg sm:text-xl" : "text-3xl sm:text-4xl leading-none"}`}>{value}</p>
    {hint && <p className="text-xs text-botanical-muted mt-2 truncate">{hint}</p>}
  </div>
);

export default function ScanHistory() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState(null);
  const detailRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (skip = 0) => {
      if (!user) return;
      setBusy(true);
      try {
        const r = await axios.get(`${API}/history`, {
          params: { q: debounced, status, limit: PAGE, skip },
        });
        setItems((prev) => (skip === 0 ? r.data.items : [...prev, ...r.data.items]));
        setTotal(r.data.total);
      } catch {
        toast.error("Could not load your scan history");
      } finally {
        setBusy(false);
      }
    },
    [user, debounced, status]
  );

  useEffect(() => {
    setSelected(null);
    load(0);
  }, [load]);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/history/stats`).then((r) => setStats(r.data)).catch(() => {});
  }, [user, items.length]);

  const open = (item) => {
    setSelected(item);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API}/history/${id}`);
      setItems((h) => h.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (selected?.id === id) setSelected(null);
      toast.success("Removed from history");
    } catch {
      toast.error("Could not delete that scan");
    }
  };

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/history";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-botanical-bg">
        <Leaf className="w-8 h-8 animate-pulse text-botanical-forest" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-botanical-bg text-botanical-ink" data-testid="history-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Your garden log</p>
          <h1 className="font-serif text-4xl sm:text-5xl mt-2 tracking-tight">Scan history</h1>
          <p className="text-sm md:text-base text-botanical-muted mt-2 max-w-xl">
            Every leaf you have diagnosed, newest first. Tap a scan to reopen the full report.
          </p>
        </div>

        {!user ? (
          <div
            className="mt-10 rounded-3xl border border-dashed border-botanical-forest/25 p-8 sm:p-14 text-center"
            data-testid="history-signin-prompt"
          >
            <div className="w-14 h-14 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 text-botanical-forest dark:text-botanical-moss flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl md:text-3xl mt-6">Sign in to keep your scans</h2>
            <p className="text-sm text-botanical-muted mt-2 max-w-sm mx-auto">
              Your history is tied to your account so you can compare a plant week to week.
            </p>
            <Button
              onClick={handleLogin}
              className="mt-8 rounded-full bg-botanical-forest text-white hover:bg-botanical-hover h-12 px-8 w-full sm:w-auto"
              data-testid="history-signin-btn"
            >
              <LogIn className="w-4 h-4 mr-2" /> Sign in with Google
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="history-stats">
              <StatCard icon={History} label="Total scans" value={stats?.total ?? "—"} hint={`${stats?.plants_tracked ?? 0} plants tracked`} testid="stat-total" />
              <StatCard icon={Sprout} label="Healthy" value={stats?.healthy ?? "—"} hint="Leaves given the all-clear" testid="stat-healthy" />
              <StatCard icon={ShieldAlert} label="Needs care" value={stats?.diseased ?? "—"} hint={`${stats?.severe ?? 0} marked severe`} testid="stat-diseased" />
              <StatCard icon={Leaf} label="Most common" value={stats?.top_issue || "—"} small hint={stats?.top_issue ? `Seen ${stats.top_issue_count}×` : "No issues found yet"} testid="stat-top-issue" />
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-botanical-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by disease or plant…"
                  className="w-full h-12 rounded-full bg-botanical-card border border-botanical-forest/15 pl-11 pr-11 text-sm text-botanical-ink placeholder:text-botanical-muted outline-none focus:border-botanical-forest/40 transition-colors"
                  data-testid="history-search-input"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-botanical-sage/40 flex items-center justify-center text-botanical-muted"
                    aria-label="Clear search"
                    data-testid="history-search-clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatus(f.key)}
                    className={`shrink-0 h-10 px-4 rounded-full text-sm border transition-colors ${
                      status === f.key
                        ? "bg-botanical-forest text-white border-botanical-forest"
                        : "border-botanical-forest/20 text-botanical-muted hover:bg-botanical-sage/30"
                    }`}
                    data-testid={`history-filter-${f.key}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <div
                className="mt-8 rounded-2xl border border-dashed border-botanical-forest/20 p-10 sm:p-14 text-center text-botanical-muted"
                data-testid="history-empty"
              >
                {busy ? "Loading your scans…" : debounced || status !== "all" ? "No scans match that filter." : "No scans yet — diagnose a leaf and it lands here."}
              </div>
            ) : (
              <>
                <p className="mt-8 text-sm text-botanical-muted" data-testid="history-count">
                  Showing {items.length} of {total}
                </p>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="history-grid">
                  {items.map((h, i) => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.04 }}
                      className="group relative rounded-2xl overflow-hidden border border-botanical-forest/10 bg-botanical-card"
                    >
                      <button
                        onClick={() => open(h)}
                        className="block w-full text-left active:scale-[0.98] transition-transform"
                        data-testid={`history-card-${i}`}
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={h.image_data_url}
                            alt={h.disease_name}
                            loading="lazy"
                            className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-botanical-ink truncate">{h.disease_name}</p>
                          <p className="text-xs text-botanical-muted truncate">{h.plant}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
                              style={{ color: sevText(theme, h.severity, h.is_healthy) }}
                            >
                              {h.is_healthy ? "healthy" : h.severity}
                            </span>
                            <span className="text-[10px] text-botanical-muted">
                              {new Date(h.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => remove(h.id)}
                        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-botanical-card/90 backdrop-blur flex items-center justify-center text-botanical-forest dark:text-botanical-moss md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        aria-label="Delete scan"
                        data-testid={`history-delete-${i}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>

                {items.length < total && (
                  <div className="mt-8 flex justify-center">
                    <Button
                      onClick={() => load(items.length)}
                      disabled={busy}
                      variant="outline"
                      className="rounded-full border-botanical-forest/30 text-botanical-forest dark:text-botanical-moss dark:border-botanical-moss/40 hover:bg-botanical-sage/40 h-11 px-8"
                      data-testid="history-load-more"
                    >
                      {busy ? "Loading…" : `Load ${Math.min(PAGE, total - items.length)} more`}
                    </Button>
                  </div>
                )}
              </>
            )}

            {selected && (
              <section ref={detailRef} className="mt-12 sm:mt-16 scroll-mt-24" data-testid="history-detail">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Saved report</p>
                    <h2 className="font-serif text-3xl sm:text-4xl mt-2">{selected.disease_name}</h2>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-10 h-10 shrink-0 rounded-full border border-botanical-forest/20 flex items-center justify-center text-botanical-muted hover:bg-botanical-sage/30 transition-colors"
                    aria-label="Close report"
                    data-testid="history-detail-close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-6">
                  <DiagnosisResult data={selected} />
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
