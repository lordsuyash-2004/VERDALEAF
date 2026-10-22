// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Leaf, History, BookOpen, Sparkles, LogIn, ArrowRight, CloudSun } from "lucide-react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import DiagnosisResult from "@/components/DiagnosisResult";
import WeatherRisk from "@/components/WeatherRisk";
import { CollectionStatus } from "@/components/CollectionStatus";
import { usePublicCollection } from "@/hooks/usePublicCollection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { API, useAuth } from "@/App";
import { useTheme } from "@/theme";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const { items: diseases, loading: diseasesLoading, error: diseasesError, reload: retryDiseases } = usePublicCollection("diseases");
  const { items: tips, loading: tipsLoading, error: tipsError, reload: retryTips } = usePublicCollection("tips");
  const [historyTotal, setHistoryTotal] = useState(0);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const r = await axios.get(`${API}/history`, { params: { limit: 6 } });
      setHistory(r.data.items);
      setHistoryTotal(r.data.total);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (result && user) loadHistory();
  }, [result, user, loadHistory]);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
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
    <div className="min-h-screen bg-botanical-bg text-botanical-ink" data-testid="dashboard-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14 lg:py-16">
        <section>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Diagnose</p>
              <h1 className="font-serif text-4xl sm:text-5xl mt-2 tracking-tight text-botanical-ink">
                {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Try a scan"}
              </h1>
              <p className="text-sm md:text-base text-botanical-muted mt-2 max-w-lg">
                Upload a clear photo of a single leaf. Fill the frame, natural light, one leaf per shot.
              </p>
            </div>
            {!user && (
              <Button onClick={handleLogin} variant="outline" className="rounded-full border-botanical-forest/30 text-botanical-forest dark:text-botanical-moss dark:border-botanical-moss/40 hover:bg-botanical-sage/40" data-testid="dashboard-signin-btn">
                <LogIn className="w-4 h-4 mr-2" /> Sign in to save history
              </Button>
            )}
          </div>

          <div className="mt-8 sm:mt-10">
            <UploadZone onResult={setResult} />
          </div>

          {result && (
            <div className="mt-10">
              <DiagnosisResult data={result} />
            </div>
          )}
        </section>

        {/* WEATHER RISK */}
        <section id="weather" className="mt-16 sm:mt-24" data-testid="weather-section">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Field conditions</p>
              <h2 className="font-serif text-3xl sm:text-4xl mt-2 tracking-tight text-botanical-ink">Weather disease risk</h2>
              <p className="text-sm md:text-base text-botanical-muted mt-2 max-w-xl">
                Humid nights and rain splash wake up fungi and bacteria. See what the next three days mean for your plants.
              </p>
            </div>
            <p className="text-sm text-botanical-muted flex items-center gap-2"><CloudSun className="w-4 h-4" /> Live forecast</p>
          </div>
          <div className="mt-8">
            <WeatherRisk />
          </div>
        </section>

        {/* RECENT SCANS */}
        {user && history.length > 0 && (
          <section id="history" className="mt-16 sm:mt-24">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Your history</p>
                <h2 className="font-serif text-3xl sm:text-4xl mt-2 tracking-tight text-botanical-ink">Recent scans</h2>
              </div>
              <Link
                to="/history"
                className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-botanical-forest dark:text-botanical-moss hover:gap-2.5 transition-all"
                data-testid="view-all-history-link"
              >
                <History className="w-4 h-4" /> All {historyTotal} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-6 flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
              {history.map((h, i) => (
                <Link
                  key={h.id}
                  to="/history"
                  className="group relative shrink-0 w-36 sm:w-auto snap-start rounded-2xl overflow-hidden border border-botanical-forest/10 bg-botanical-card active:scale-[0.98] transition-transform"
                  data-testid={`recent-scan-${i}`}
                >
                  <div className="aspect-square overflow-hidden">
                    <img src={h.image_data_url} alt={h.disease_name} loading="lazy" className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                    <p className="text-white text-xs font-semibold truncate">{h.disease_name}</p>
                    <p className="text-white/70 text-[10px] truncate">{h.plant} · {h.is_healthy ? "healthy" : h.severity}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* DISEASE LIBRARY */}
        <section id="library" className="mt-16 sm:mt-24" data-testid="library-section">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Encyclopedia</p>
              <h2 className="font-serif text-3xl sm:text-4xl mt-2 tracking-tight text-botanical-ink">Common leaf diseases</h2>
            </div>
            <p className="text-sm text-botanical-muted flex items-center gap-2" data-testid="library-entry-count"><BookOpen className="w-4 h-4" /> {diseasesLoading ? "Loading…" : diseasesError ? "Unavailable" : `${diseases.length} entries`}</p>
          </div>

          <CollectionStatus name="library" label="the disease library" loading={diseasesLoading} error={diseasesError} empty={!diseases.length} onRetry={retryDiseases} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {diseases.map((d, i) => (
              <motion.article
                key={d.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl overflow-hidden bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.04)] hover:-translate-y-1 transition-transform"
                data-testid={`disease-card-${i}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={d.image} alt={d.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase tracking-[0.2em] font-semibold text-botanical-moss">{d.type}</span>
                    <span className="text-botanical-muted">·</span>
                    <span className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: theme === "dark" ? (d.severity === "severe" ? "#E8927C" : d.severity === "moderate" ? "#E8BC84" : "#7CBF85") : (d.severity === "severe" ? "#D97757" : d.severity === "moderate" ? "#DDA76A" : "#4A6741") }}>{d.severity}</span>
                  </div>
                  <h3 className="font-serif text-2xl mt-3 text-botanical-ink">{d.name}</h3>
                  <p className="text-xs text-botanical-muted mt-1">{d.plant}</p>
                  <p className="text-sm text-botanical-ink mt-4 leading-relaxed"><span className="font-semibold">Symptoms · </span>{d.symptoms}</p>
                  <p className="text-sm text-botanical-muted mt-2 leading-relaxed"><span className="font-semibold text-botanical-forest dark:text-botanical-moss">Treatment · </span>{d.treatment}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* CARE TIPS */}
        <section id="tips" className="mt-16 sm:mt-24 mb-12 sm:mb-16" data-testid="care-tips-section">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Care & prevention</p>
              <h2 className="font-serif text-3xl sm:text-4xl mt-2 tracking-tight text-botanical-ink">Six habits that keep leaves clean</h2>
            </div>
            <p className="text-sm text-botanical-muted flex items-center gap-2"><Sparkles className="w-4 h-4" /> Agronomist-approved</p>
          </div>

          <CollectionStatus name="care-tips" label="care tips" loading={tipsLoading} error={tipsError} empty={!tips.length} onRetry={retryTips} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {tips.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl overflow-hidden bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.04)]"
                data-testid={`tip-card-${i}`}
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img src={t.image} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-serif text-2xl text-botanical-ink">{t.title}</h3>
                  <p className="text-sm text-botanical-muted mt-3 leading-relaxed">{t.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
