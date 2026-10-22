// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Leaf, ScanLine, BookOpen, HeartPulse, ArrowUpRight, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";

const features = [
  { icon: ScanLine, title: "Instant leaf diagnosis", body: "Snap a leaf, get disease name, severity and confidence in seconds." },
  { icon: HeartPulse, title: "Treatment plans", body: "Actionable, non-generic treatment steps tailored to what we see." },
  { icon: BookOpen, title: "Disease library", body: "Browse a curated encyclopedia of common plant afflictions." },
  { icon: Sparkles, title: "Care tips", body: "Prevention advice from real agronomists, not chatbot fluff." },
];

export default function Landing() {
  const { user } = useAuth();

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-botanical-bg text-botanical-ink" data-testid="landing-page">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden grain">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16 pb-16 sm:pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7"
          >
            <span className="inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold mb-6" data-testid="hero-eyebrow">
              <Leaf className="w-3.5 h-3.5" /> Plant pathology, distilled
            </span>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] text-botanical-ink">
              Diagnose plant disease <span className="italic text-botanical-moss">from a single leaf.</span>
            </h1>
            <p className="mt-6 text-lg text-botanical-muted max-w-xl leading-relaxed">
              Verdaleaf reads photos of sick leaves with a vision model trained on plant pathology.
              You get the disease name, a severity meter, and a treatment plan — in under ten seconds.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              {user ? (
                <Link to="/dashboard">
                  <Button
                    className="rounded-full bg-botanical-forest text-white hover:bg-botanical-hover px-7 h-12 text-base active:scale-95 transition-all"
                    data-testid="hero-open-dashboard-button"
                  >
                    Open dashboard <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={handleLogin}
                  className="rounded-full bg-botanical-forest text-white hover:bg-botanical-hover px-7 h-12 text-base active:scale-95 transition-all"
                  data-testid="hero-cta-signin"
                >
                  Sign in & diagnose <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              <a href="#how">
                <Button
                  variant="outline"
                  className="rounded-full border-botanical-forest/30 text-botanical-forest dark:text-botanical-moss dark:border-botanical-moss/40 hover:bg-botanical-sage/40 px-7 h-12 text-base"
                  data-testid="hero-how-button"
                >
                  How it works
                </Button>
              </a>
            </div>

            <div className="mt-12 flex items-center gap-6 text-sm text-botanical-muted">
              <div className="flex -space-x-2">
                {[
                  "https://images.pexels.com/photos/34234358/pexels-photo-34234358.jpeg",
                  "https://images.pexels.com/photos/2974409/pexels-photo-2974409.jpeg",
                  "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8",
                ].map((src, i) => (
                  <img key={i} src={src} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-botanical-bg" />
                ))}
              </div>
              <span>Trained on 30+ common leaf diseases across ornamentals & crops.</span>
            </div>
          </motion.div>

          {/* Right bento */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-botanical-forest/10 shadow-[0_20px_60px_rgba(30,63,32,0.15)]">
              <img
                src="https://images.unsplash.com/photo-1580133318324-f2f76d987dd8"
                alt="leaf close up"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white/70 text-xs uppercase tracking-[0.25em]">Sample diagnosis</p>
                <p className="font-serif text-white text-3xl mt-1">Early Blight</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-[#DDA76A]" />
                  </div>
                  <span className="text-white text-xs">62% severe</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block absolute -left-8 -bottom-8 w-52 rounded-2xl bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.08)] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-botanical-moss font-semibold">Confidence</p>
              <p className="font-serif text-4xl mt-1 text-botanical-ink">94%</p>
              <p className="text-xs text-botanical-muted mt-2">Gemini 3 vision · 400ms</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.25em] uppercase text-botanical-moss font-semibold" data-testid="features-eyebrow">The workflow</p>
          <h2 className="font-serif text-4xl sm:text-5xl tracking-tight mt-3 text-botanical-ink">
            From a photo to a plan, in one page.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group p-8 rounded-2xl bg-botanical-card border border-botanical-forest/10 shadow-[0_8px_30px_rgba(30,63,32,0.04)] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(30,63,32,0.08)] transition-transform"
              data-testid={`feature-card-${i}`}
            >
              <div className="w-11 h-11 rounded-xl bg-botanical-sage/60 dark:bg-botanical-moss/20 flex items-center justify-center text-botanical-forest dark:text-botanical-moss">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl mt-6 text-botanical-ink">{f.title}</h3>
              <p className="text-sm text-botanical-muted mt-3 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-24">
        <div className="rounded-3xl bg-botanical-forest text-white p-12 lg:p-16 grid md:grid-cols-2 gap-10 items-center relative overflow-hidden">
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-botanical-moss/40 blur-3xl" />
          <div className="relative">
            <p className="text-xs tracking-[0.25em] uppercase text-white/75 font-semibold">Ready?</p>
            <h2 className="font-serif text-4xl lg:text-5xl mt-3 leading-tight">
              Your first diagnosis takes ten seconds.
            </h2>
            <p className="text-white/70 mt-4 max-w-md leading-relaxed">
              Sign in with Google to save your scan history and revisit past diagnoses whenever a plant looks off again.
            </p>
          </div>
          <div className="relative flex md:justify-end">
            {user ? (
              <Link to="/dashboard">
                <Button className="rounded-full bg-white text-[#1E3F20] hover:bg-[#E2EBE1] px-8 h-14 text-base" data-testid="cta-dashboard-btn">
                  Open the diagnosis tool <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleLogin}
                className="rounded-full bg-white text-[#1E3F20] hover:bg-[#E2EBE1] px-8 h-14 text-base"
                data-testid="cta-signin-btn"
              >
                Sign in with Google <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-botanical-muted border-t border-botanical-forest/10">
        <span className="font-serif text-lg text-botanical-ink">Verdaleaf</span>
        <span>© {new Date().getFullYear()} · Made for growers</span>
      </footer>
    </div>
  );
}
