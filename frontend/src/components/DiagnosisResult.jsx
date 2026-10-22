import { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Flame, Sparkles, Shield, FileDown, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { API } from "@/App";
import { useTheme } from "@/theme";
import { toast } from "sonner";

const sevColor = {
  light: { low: "#4A6741", moderate: "#DDA76A", severe: "#D97757" },
  dark: { low: "#7CBF85", moderate: "#E8BC84", severe: "#E8927C" },
};

const sevIcon = {
  low: CheckCircle2,
  moderate: AlertTriangle,
  severe: Flame,
};

const LANG_LABEL = { hi: "हिन्दी", kn: "ಕನ್ನಡ" };

export default function DiagnosisResult({ data }) {
  const [downloading, setDownloading] = useState(false);
  const { theme } = useTheme();

  if (!data) return null;
  const palette = sevColor[theme] || sevColor.light;
  const SevIcon = data.is_healthy ? CheckCircle2 : sevIcon[data.severity] || AlertTriangle;
  const color = data.is_healthy ? palette.low : palette[data.severity] || palette.low;

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const r = await axios.post(`${API}/report/pdf`, data, { responseType: "blob", withCredentials: false, timeout: 60000 });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      const slug = (data.disease_name_en || data.disease_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      a.download = `verdaleaf-${slug || "diagnosis"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Could not generate PDF report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="grid lg:grid-cols-5 gap-4 sm:gap-6"
      data-testid="diagnosis-result"
      lang={data.language || "en"}
      data-lang={data.language || "en"}
    >
      {/* Left: hero result */}
      <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-botanical-forest/10 bg-botanical-card shadow-[0_8px_30px_rgba(30,63,32,0.05)]">
        <div className="relative aspect-square">
          <img src={data.image_data_url} alt="leaf" className="w-full h-full object-cover" data-testid="result-image" />
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-botanical-card/90 backdrop-blur text-xs font-semibold text-botanical-ink" data-testid="result-plant-badge">
            {data.plant}
          </div>
          {LANG_LABEL[data.language] && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-botanical-forest/90 backdrop-blur text-xs font-semibold text-white" data-testid="result-language-badge">
              {LANG_LABEL[data.language]}
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Diagnosis</p>
          <h3 className="font-serif text-3xl mt-2 text-botanical-ink" data-testid="result-disease-name">{data.disease_name}</h3>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5" style={{ color }}>
              <SevIcon className="w-4 h-4" />
              <span className="capitalize font-semibold" data-testid="result-severity-label">
                {data.is_healthy ? "Healthy" : data.severity}
              </span>
            </div>
            <span className="text-botanical-muted">·</span>
            <span className="text-botanical-muted" data-testid="result-confidence">{data.confidence}% confidence</span>
          </div>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-botanical-forest text-white text-sm font-semibold px-5 py-2.5 hover:bg-botanical-hover transition-colors disabled:opacity-60"
            data-testid="download-pdf-btn"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {downloading ? "Preparing report…" : "Download PDF report"}
          </button>
        </div>
      </div>

      {/* Right: bento data */}
      <div className="lg:col-span-3 grid grid-rows-[auto_1fr] gap-4 sm:gap-6">
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-2xl bg-botanical-card border border-botanical-forest/10 p-5 sm:p-6 shadow-[0_8px_30px_rgba(30,63,32,0.04)]">
            <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Severity</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-serif text-5xl text-botanical-ink" data-testid="result-severity-score">{data.severity_score}</span>
              <span className="text-botanical-muted text-sm">/ 100</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-botanical-bg2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.severity_score}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
          <div className="rounded-2xl bg-botanical-forest text-white p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-botanical-moss/50 blur-3xl" />
            <p className="text-xs tracking-[0.25em] uppercase text-white/75 font-semibold relative">Symptoms observed</p>
            <ul className="mt-4 space-y-2 text-sm text-white/90 relative">
              {(data.symptoms || []).map((s, i) => (
                <li key={i} className="flex gap-2" data-testid={`symptom-${i}`}>
                  <span className="text-white/75">·</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-botanical-card border border-botanical-forest/10 p-5 sm:p-6 shadow-[0_8px_30px_rgba(30,63,32,0.04)]">
          <Tabs defaultValue="treatment" className="w-full">
            <TabsList className="bg-botanical-bg2 rounded-full p-1">
              <TabsTrigger value="treatment" className="rounded-full px-4 sm:px-5 text-xs sm:text-sm data-[state=active]:bg-botanical-card data-[state=active]:text-botanical-forest data-[state=active]:shadow-sm dark:data-[state=active]:bg-botanical-sage dark:data-[state=active]:text-botanical-moss" data-testid="tab-treatment">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Treatment
              </TabsTrigger>
              <TabsTrigger value="prevention" className="rounded-full px-4 sm:px-5 text-xs sm:text-sm data-[state=active]:bg-botanical-card data-[state=active]:text-botanical-forest data-[state=active]:shadow-sm dark:data-[state=active]:bg-botanical-sage dark:data-[state=active]:text-botanical-moss" data-testid="tab-prevention">
                <Shield className="w-3.5 h-3.5 mr-1.5" /> Prevention
              </TabsTrigger>
            </TabsList>
            <TabsContent value="treatment" className="pt-6">
              <ol className="space-y-3">
                {(data.treatments || []).map((t, i) => (
                  <li key={i} className="flex gap-3" data-testid={`treatment-${i}`}>
                    <span className="w-6 h-6 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 text-botanical-forest dark:text-botanical-moss text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-botanical-ink leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="prevention" className="pt-6">
              <ol className="space-y-3">
                {(data.prevention || []).map((p, i) => (
                  <li key={i} className="flex gap-3" data-testid={`prevention-${i}`}>
                    <span className="w-6 h-6 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 text-botanical-forest dark:text-botanical-moss text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-botanical-ink leading-relaxed">{p}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
}
