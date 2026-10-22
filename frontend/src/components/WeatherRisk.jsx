import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, LocateFixed, Search, Loader2, RefreshCw, Droplets, Thermometer, Wind, CloudRain,
  Sun, Moon, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudSnow, CloudLightning,
  ShieldAlert, ShieldCheck, AlertTriangle, Sprout, Bug, Flame, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWeather, weatherError } from "@/lib/weatherApi";
import { useTheme } from "@/theme";
import { toast } from "sonner";

const LOC_KEY = "verdaleaf-location";

const levelPalette = {
  light: { low: "#4A6741", moderate: "#C98B3E", high: "#D97757" },
  dark: { low: "#7CBF85", moderate: "#E8BC84", high: "#E8927C" },
};
const levelText = { low: "Low", moderate: "Moderate", high: "High" };
const riskIcon = { fungal: Sprout, bacterial: Bug, heat: Flame };

function weatherIcon(code, isDay) {
  if (code == null) return Cloud;
  if (code === 0) return isDay === 0 ? Moon : Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  return CloudLightning;
}

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY) || "null");
    if (v && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90
      && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180) return v;
  } catch {}
  return null;
}

function placeLabel(p) {
  return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
}

export default function WeatherRisk() {
  const { theme } = useTheme();
  const palette = levelPalette[theme] || levelPalette.light;
  const [location, setLocation] = useState(loadSaved);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(!loadSaved());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef();
  const riskRequestRef = useRef();
  const searchRequestRef = useRef();

  const fetchRisk = useCallback(async (loc) => {
    if (!loc) return;
    riskRequestRef.current?.abort();
    const controller = new AbortController();
    riskRequestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const data = await getWeather("risk", { lat: loc.latitude, lon: loc.longitude }, controller.signal);
      if (!controller.signal.aborted) setRisk(data);
    } catch (e) {
      if (!controller.signal.aborted && !axios.isCancel(e)) setError(weatherError(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) fetchRisk(location);
    return () => riskRequestRef.current?.abort();
  }, [location, fetchRisk]);

  const choose = (loc) => {
    riskRequestRef.current?.abort();
    searchRequestRef.current?.abort();
    clearTimeout(debounceRef.current);
    try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch {}
    setRisk(null);
    setError("");
    setSearchError("");
    setSearching(false);
    setLocation(loc);
    setPicking(false);
    setQuery("");
    setResults([]);
  };

  const useDevice = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device — search for your town instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        choose({
          name: "Your location",
          latitude: Math.round(pos.coords.latitude * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
          device: true,
        });
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === 1
            ? "Location permission denied — search for your town or village instead."
            : "Couldn't get your location — search for your town instead."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const onQuery = (v) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    searchRequestRef.current?.abort();
    setResults([]);
    setSearchError("");
    if (v.trim().length < 2) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await getWeather("geocode", { q: v.trim() }, controller.signal);
        if (!controller.signal.aborted) setResults(data);
      } catch (e) {
        if (!controller.signal.aborted && !axios.isCancel(e)) setSearchError(weatherError(e));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
  };

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    searchRequestRef.current?.abort();
  }, []);

  const overallColor = risk ? palette[risk.overall_level] : palette.low;
  const OverallIcon = risk?.overall_level === "low" ? ShieldCheck : risk?.overall_level === "high" ? ShieldAlert : AlertTriangle;
  const cur = risk?.current;
  const NowIcon = weatherIcon(cur?.weather_code, cur?.is_day);

  return (
    <div className="rounded-3xl bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.05)] p-5 sm:p-8" data-testid="weather-risk-card">
      {/* Location bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {location && !picking ? (
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <MapPin className="w-4 h-4 text-botanical-forest dark:text-botanical-moss shrink-0" />
            <span className="font-semibold text-botanical-ink truncate" data-testid="weather-location-name">{location.name}</span>
            {location.device && (
              <span className="text-xs text-botanical-muted hidden sm:inline" data-testid="weather-location-coordinates">
                {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-botanical-muted">Pick a location to see the next 3 days of disease risk.</p>
        )}
        {location && !picking && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchRisk(location)}
              disabled={loading}
              className="rounded-full text-botanical-muted hover:text-botanical-ink hover:bg-botanical-bg2"
              data-testid="weather-refresh-btn"
              aria-label="Refresh weather"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPicking(true)}
              className="rounded-full border-botanical-forest/30 text-botanical-forest dark:text-botanical-moss dark:border-botanical-moss/40 hover:bg-botanical-sage/40"
              data-testid="weather-change-location-btn"
            >
              Change
            </Button>
          </div>
        )}
      </div>

      {/* Location picker */}
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10"
          >
            <div className="mt-4 flex flex-col sm:flex-row gap-3" data-testid="weather-location-picker">
              <Button
                onClick={useDevice}
                disabled={locating}
                className="rounded-full bg-botanical-forest text-white hover:bg-botanical-hover h-11 px-5 shrink-0"
                data-testid="weather-use-location-btn"
              >
                {locating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LocateFixed className="w-4 h-4 mr-2" />}
                Use my location
              </Button>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-botanical-muted" />
                <input
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Search a city, town or village"
                  className="w-full h-11 rounded-full bg-botanical-bg2 border border-botanical-forest/15 pl-11 pr-10 text-sm text-botanical-ink placeholder:text-botanical-muted focus:outline-none focus:ring-2 focus:ring-botanical-forest/30"
                  data-testid="weather-search-input"
                />
                {searching && <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-botanical-muted" />}
                {results.length > 0 && (
                  <ul className="absolute z-20 mt-2 w-full rounded-2xl bg-botanical-card border border-botanical-forest/15 shadow-lg overflow-hidden" data-testid="weather-search-results">
                    {results.map((p, i) => (
                      <li key={`${p.latitude},${p.longitude}`}>
                        <button
                          type="button"
                          onClick={() => choose({ ...p, name: placeLabel(p) })}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-botanical-bg2 flex items-center gap-2 text-botanical-ink"
                          data-testid={`weather-search-result-${i}`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-botanical-muted shrink-0" />
                          <span className="truncate">{placeLabel(p)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {searchError && (
                  <p role="alert" className="mt-2 px-4 text-xs text-botanical-muted" data-testid="weather-search-error">{searchError}</p>
                )}
                {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
                  <p className="mt-2 px-4 text-xs text-botanical-muted" data-testid="weather-search-empty">No places found</p>
                )}
              </div>
              {location && (
                <Button
                  variant="ghost"
                  onClick={() => { onQuery(""); setPicking(false); }}
                  className="rounded-full h-11 text-botanical-muted hover:bg-botanical-bg2"
                  aria-label="Cancel"
                  data-testid="weather-picker-cancel"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* States */}
      {error && (
        <div role="alert" className="mt-6 rounded-2xl border border-botanical-forest/15 bg-botanical-bg2 p-4 text-sm text-botanical-ink flex items-center justify-between gap-3" data-testid="weather-error">
          <span data-testid="weather-error-message">{error}{risk ? " Showing the previous forecast." : ""}</span>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => fetchRisk(location)} className="rounded-full shrink-0" data-testid="weather-retry-btn">Retry</Button>
        </div>
      )}

      {loading && !risk && (
        <div className="mt-6 grid sm:grid-cols-3 gap-4" data-testid="weather-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-botanical-bg2 animate-pulse" />
          ))}
        </div>
      )}

      {risk && location && (
        <div className={`mt-6 space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Alert banner + now */}
          <div className="grid lg:grid-cols-5 gap-4">
            <div
              className="lg:col-span-3 rounded-2xl p-5 sm:p-6 relative overflow-hidden border"
              style={{ borderColor: `${overallColor}55`, backgroundColor: `${overallColor}14` }}
              data-testid="weather-alert-banner"
              data-level={risk.overall_level}
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${overallColor}26`, color: overallColor }}>
                  <OverallIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs tracking-[0.2em] uppercase font-semibold" style={{ color: overallColor }}>
                    {levelText[risk.overall_level]} risk · next 3 days
                  </p>
                  <h3 className="font-serif text-2xl sm:text-3xl mt-1 text-botanical-ink leading-tight" data-testid="weather-headline">{risk.headline}</h3>
                  <p className="text-sm text-botanical-muted mt-2">
                    {risk.metrics.wet_hours} damp-leaf hours · {risk.metrics.rain_mm} mm rain expected
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl bg-botanical-forest text-white p-5 sm:p-6 relative overflow-hidden" data-testid="weather-now">
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-botanical-moss/50 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <p className="text-xs tracking-[0.25em] uppercase text-white/75 font-semibold">Right now</p>
                <NowIcon className="w-6 h-6 text-white/85" />
              </div>
              <p className="relative font-serif text-5xl mt-3" data-testid="weather-now-temp">{cur?.temperature != null ? Math.round(cur.temperature) : "–"}°C</p>
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs text-white/85">
                <span className="flex items-center gap-1.5" data-testid="weather-now-humidity"><Droplets className="w-3.5 h-3.5" />{cur?.humidity ?? "–"}%</span>
                <span className="flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5" />{cur?.precipitation ?? 0} mm</span>
                <span className="flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" />{cur?.wind_speed != null ? Math.round(cur.wind_speed) : "–"} km/h</span>
              </div>
            </div>
          </div>

          {/* Risk cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {risk.risks.map((r) => {
              const c = palette[r.level];
              const Icon = riskIcon[r.key] || Sprout;
              return (
                <div key={r.key} className="rounded-2xl border border-botanical-forest/10 bg-botanical-bg p-5" data-testid={`weather-risk-${r.key}`} data-level={r.level}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-botanical-sage/60 dark:bg-botanical-moss/20 text-botanical-forest dark:text-botanical-moss flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-botanical-ink truncate">{r.label}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ color: c, backgroundColor: `${c}1F` }} data-testid={`weather-risk-${r.key}-level`}>
                      {levelText[r.level]}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-botanical-bg2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(r.score, 3)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: c }}
                    />
                  </div>
                  <p className="text-xs text-botanical-muted mt-3">{r.examples}</p>
                  <p className="text-sm text-botanical-ink mt-2 leading-relaxed">{r.reason}</p>
                  <ul className="mt-3 space-y-1.5">
                    {r.advice.map((a, i) => (
                      <li key={i} className="text-sm text-botanical-muted flex gap-2 leading-relaxed">
                        <span style={{ color: c }}>•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* 3-day outlook */}
          <div className="grid grid-cols-3 gap-3" data-testid="weather-outlook">
            {risk.daily.map((d, i) => {
              const c = palette[d.fungal_level];
              return (
                <div key={d.date} className="rounded-2xl bg-botanical-bg2 p-3 sm:p-4" data-testid={`weather-day-${i}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-botanical-ink">{i === 0 ? "Today" : d.weekday}</p>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} title={`Fungal risk: ${levelText[d.fungal_level]}`} />
                  </div>
                  <p className="text-xs text-botanical-muted mt-2 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" />{Math.round(d.temp_min)}° / {Math.round(d.temp_max)}°
                  </p>
                  <p className="text-xs text-botanical-muted mt-1 flex items-center gap-1">
                    <Droplets className="w-3 h-3" />{d.humidity_avg}% · {d.rain_mm} mm
                  </p>
                  <p className="text-[11px] mt-2 font-semibold" style={{ color: c }}>Fungal: {levelText[d.fungal_level]}</p>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-botanical-muted">
            {risk.disclaimer} Weather by Open-Meteo, updated every 15 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
