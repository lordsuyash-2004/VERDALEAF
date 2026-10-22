import { useState, useRef, useCallback } from "react";
import { Upload, Leaf, Loader2, X, Camera, Languages } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { API, useAuth } from "@/App";
import { CameraCapture } from "@/components/CameraCapture";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const RESULT_LANGUAGES = [
  { code: "en", label: "English", hint: "English" },
  { code: "hi", label: "हिन्दी", hint: "Hindi" },
  { code: "kn", label: "ಕನ್ನಡ", hint: "Kannada" },
];
const LANG_KEY = "verdaleaf-lang";

function initialLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return RESULT_LANGUAGES.some((l) => l.code === v) ? v : "en";
  } catch {
    return "en";
  }
}

export default function UploadZone({ onResult }) {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [language, setLanguageState] = useState(initialLang);
  const setLanguage = (code) => {
    setLanguageState(code);
    try { localStorage.setItem(LANG_KEY, code); } catch {}
  };
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef();
  const captureInputRef = useRef();

  const supportsLiveCamera =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

  const handleFiles = useCallback(async (files) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!/^image\/(jpeg|png|webp|jpg)$/i.test(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.");
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      setError("");
      setPreview(dataUrl);
    } catch {
      toast.error("Couldn't read this photo. Please select it again.");
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const runDetection = async () => {
    if (!preview || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = await axios.post(`${API}/detect`, { image_base64: preview, language }, {
        // Guests must not inherit credentialed CORS; signed-in scans still save to history.
        withCredentials: Boolean(user),
        timeout: 120000,
      });
      onResult(r.data);
      toast.success("Diagnosis ready");
    } catch (e) {
      const detail = e.response?.data?.detail;
      const message = typeof detail === "string" ? detail
        : e.code === "ECONNABORTED" ? "Diagnosis is taking too long. Please try again."
        : !e.response ? "Couldn't reach the diagnosis service. Check your connection and try again."
        : "Diagnosis is temporarily unavailable. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const openCamera = () => {
    if (supportsLiveCamera) {
      setCameraOpen(true);
    } else {
      captureInputRef.current?.click();
    }
  };

  const handleCapture = (dataUrl) => {
    setCameraOpen(false);
    setError("");
    setPreview(dataUrl);
  };

  const clear = () => {
    setError("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="rounded-3xl bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.05)] p-6 sm:p-10" data-testid="upload-card">
      {!preview ? (
        <>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 md:p-16 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? "border-botanical-forest bg-botanical-sage/40" : "border-botanical-forest/20 hover:border-botanical-forest/40 hover:bg-botanical-bg2"
          }`}
          data-testid="upload-area"
        >
          <div className="w-16 h-16 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 flex items-center justify-center text-botanical-forest dark:text-botanical-moss mb-6">
            <Leaf className="w-7 h-7" />
          </div>
          <p className="font-serif text-2xl text-botanical-ink">Drag & drop a leaf photo</p>
          <p className="text-sm text-botanical-muted mt-2">or click to browse — JPG, PNG, WebP up to 8 MB</p>
          <div className="mt-8 inline-flex items-center gap-2 text-sm text-botanical-forest dark:text-botanical-moss font-semibold">
            <Upload className="w-4 h-4" /> Select file
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            data-testid="upload-file-input"
          />
        </label>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span className="text-xs uppercase tracking-[0.25em] text-botanical-muted">or</span>
          <Button
            onClick={openCamera}
            variant="outline"
            className="rounded-full border-botanical-forest/30 text-botanical-forest dark:text-botanical-moss dark:border-botanical-moss/40 hover:bg-botanical-sage/40 h-11 px-6 w-full sm:w-auto"
            data-testid="open-camera-btn"
          >
            <Camera className="w-4 h-4 mr-2" /> Use live camera
          </Button>
        </div>
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="camera-fallback-input"
        />
        </>
      ) : (
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-botanical-forest/10 aspect-square"
            data-testid="upload-preview"
          >
            <img src={preview} alt="leaf preview" className="w-full h-full object-cover" />
            <button
              onClick={clear}
              disabled={loading}
              aria-label="Remove photo"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-botanical-card/90 backdrop-blur flex items-center justify-center text-botanical-forest hover:bg-botanical-card disabled:opacity-50"
              data-testid="clear-preview-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>

          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold">Ready to diagnose</p>
            <h3 className="font-serif text-3xl mt-2 text-botanical-ink">One click and Verdaleaf gets to work.</h3>
            <p className="text-sm text-botanical-muted mt-3 leading-relaxed">
              Our vision model reads the leaf, compares it against known disease patterns, and returns a full report.
            </p>
            <div className="mt-6" data-testid="language-picker">
              <p className="text-xs tracking-[0.2em] uppercase text-botanical-muted font-semibold flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" /> Results language
              </p>
              <div className="mt-2 inline-flex p-1 rounded-full bg-botanical-bg2 border border-botanical-forest/10" role="radiogroup" aria-label="Results language">
                {RESULT_LANGUAGES.map((l) => {
                  const active = language === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={l.hint}
                      onClick={() => setLanguage(l.code)}
                      disabled={loading}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                        active
                          ? "bg-botanical-forest text-white shadow-sm dark:bg-botanical-moss/25 dark:text-botanical-moss"
                          : "text-botanical-muted hover:text-botanical-ink"
                      }`}
                      data-testid={`lang-option-${l.code}`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              onClick={runDetection}
              disabled={loading}
              className="mt-6 rounded-full bg-botanical-forest text-white hover:bg-botanical-hover h-12 px-8 active:scale-95 transition-all disabled:opacity-70"
              data-testid="run-detection-btn"
            >
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>) : error ? "Retry diagnosis" : "Diagnose leaf"}
            </Button>
            {error && <p role="alert" className="mt-4 text-sm text-botanical-ink" data-testid="diagnosis-error">{error}</p>}
          </div>
        </div>
      )}

      {cameraOpen && (
        <CameraCapture onCapture={handleCapture} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
}
