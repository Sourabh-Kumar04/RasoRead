"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, BookOpen, Mic2, ArrowRight, 
  Play, BarChart3, Moon, Zap, Layers,
  ChevronRight, Globe, Command, Headphones
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (token) {
      router.replace("/library");
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  if (isLoggedIn === null || isLoggedIn === true) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 selection:text-white font-sans">
      {/* ── Background Patterns ─────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-grid z-0 opacity-20 pointer-events-none" />
      <div className="fixed inset-0 bg-sanctuary z-0 opacity-40 pointer-events-none" />
      
      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 px-6 py-3 rounded-2xl",
        scrolled ? "w-[90%] md:w-auto bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl" : "w-full md:w-auto bg-transparent border-transparent"
      )}>
        <div className="flex items-center justify-between gap-12 md:gap-24">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen size={18} className="text-white" fill="currentColor" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white font-sans">RasoRead</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#experience" className="text-sm text-zinc-400 hover:text-white transition-colors">Experience</a>
            <button 
              onClick={() => router.push("/login")}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => router.push("/register")}
              className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative pt-44 pb-32 overflow-hidden z-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Architecture of Silence</span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight text-white mb-8 leading-[1.05]">
              Your library, <br />
              <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent italic font-serif">in motion.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12">
              A sanctuary for focused scholars. Experience your books through studio-quality AI voices and instant deep-learning insights.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => router.push("/register")}
                className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2 group h-14 px-8"
              >
                Create Sanctuary
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => router.push("/login")}
                className="w-full sm:w-auto h-14 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
              >
                Explore Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Showcase: Real Book Experience ───────────────────────────── */}
      <section id="features" className="py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">The Neural Library</h2>
            <p className="text-zinc-500 max-w-xl mx-auto font-medium">Experience your corpus as a living, breathing entity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Feature 1: The Reader Preview (Large) */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-8 p-12 rounded-[3rem] glass-card overflow-hidden group"
            >
              <div className="flex flex-col md:flex-row gap-12 items-center">
                <div className="flex-1 space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-8">
                    <Headphones className="text-primary" size={28} />
                  </div>
                  <h3 className="text-4xl font-bold text-white leading-tight">Neural Narrative <br /><span className="text-primary italic font-serif">Synthesizer</span></h3>
                  <p className="text-zinc-400 text-lg leading-relaxed">
                    Studio-quality AI voices that don't just read—they perform. Our neural models understand subtext, emphasis, and the architectural rhythm of your books.
                  </p>
                  <div className="flex items-center gap-4 pt-4">
                    <div className="audio-wave">
                      <span className="h-4 animate-[wave_1s_ease-in-out_infinite]" />
                      <span className="h-6 animate-[wave_1.2s_ease-in-out_infinite]" />
                      <span className="h-8 animate-[wave_0.8s_ease-in-out_infinite]" />
                      <span className="h-5 animate-[wave_1.1s_ease-in-out_infinite]" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">Active Synthesis</span>
                  </div>
                </div>

                {/* Real Book Page Simulation */}
                <div className="w-full md:w-[320px] aspect-[3/4.5] bg-white rounded-lg shadow-2xl overflow-hidden relative border border-white/10 group-hover:scale-[1.05] transition-transform duration-700">
                   <div className="absolute inset-0 p-8 flex flex-col gap-4">
                      <div className="h-6 w-1/3 bg-zinc-100 rounded" />
                      <div className="space-y-3 mt-4">
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          The architecture of silence is not merely the absence of sound. It is a deliberate construction of space where thoughts can breathe.
                        </p>
                        <p className="text-[11px] leading-relaxed text-zinc-900 font-medium bg-primary/20 ring-1 ring-primary/30 rounded-sm px-1 inline">
                          In the stillness of the library, the mind finds its true resonance.
                        </p>
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          Every book is a room. Every page a window. When we move through them with intent, the walls begin to speak.
                        </p>
                      </div>
                      <div className="mt-auto flex justify-between items-center border-t border-zinc-100 pt-4">
                         <span className="text-[9px] font-bold text-zinc-300">Page 124</span>
                         <div className="w-12 h-1 bg-zinc-100 rounded-full" />
                      </div>
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              </div>
            </motion.div>

            {/* Feature 2: Insights */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-4 p-10 rounded-[3rem] glass-card flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-8">
                  <BarChart3 className="text-indigo-400" size={28} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Deep Insights</h3>
                <p className="text-zinc-500 font-medium leading-relaxed">
                  Real-time analysis of your reading patterns. Velocity, comprehension, and neural retention metrics.
                </p>
              </div>
              
              <div className="mt-12 space-y-4">
                 {[60, 40, 80, 50].map((w, i) => (
                    <div key={i} className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${w}%` }}
                        className="h-full bg-indigo-500/40" 
                       />
                    </div>
                 ))}
              </div>
            </motion.div>

            {/* Feature 3: The Library Shelf */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-5 p-12 rounded-[3rem] glass-card relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-8">
                  <Layers className="text-emerald-400" size={28} />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Scholarly Shelf</h3>
                <p className="text-zinc-500 font-medium leading-relaxed">
                  Organize your collection with zero friction. Automatic metadata extraction and cover synthesis.
                </p>
              </div>
              <div className="flex gap-4 mt-12 overflow-hidden mask-fade-right">
                 {[1, 2, 3].map((i) => (
                    <div key={i} className="w-24 shrink-0 aspect-[3/4] rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/10 shadow-xl" />
                 ))}
              </div>
            </motion.div>

            {/* Feature 4: Semantic Graph */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-7 p-12 rounded-[3rem] glass-card bg-gradient-to-br from-primary/10 via-transparent to-transparent group"
            >
              <div className="flex flex-col md:flex-row gap-12 items-center">
                <div className="flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-8">
                    <Zap className="text-amber-400" size={28} />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-4">Semantic Graph</h3>
                  <p className="text-zinc-400 font-medium leading-relaxed">
                    Connect the dots across your entire library. RasoRead maps related concepts between books automatically.
                  </p>
                </div>
                
                <div className="w-48 h-48 relative flex items-center justify-center">
                   <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
                   <svg className="w-full h-full relative z-10" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="4" fill="#818cf8" />
                      <circle cx="20" cy="30" r="3" fill="#818cf8" opacity="0.4" />
                      <circle cx="80" cy="40" r="3" fill="#818cf8" opacity="0.6" />
                      <circle cx="40" cy="80" r="3" fill="#818cf8" opacity="0.3" />
                      <line x1="50" y1="50" x2="20" y2="30" stroke="#818cf8" strokeWidth="0.5" opacity="0.2" />
                      <line x1="50" y1="50" x2="80" y2="40" stroke="#818cf8" strokeWidth="0.5" opacity="0.4" />
                      <line x1="50" y1="50" x2="40" y2="80" stroke="#818cf8" strokeWidth="0.5" opacity="0.1" />
                   </svg>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden z-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-10 tracking-tight">
              Start your journey <br /> into the silence.
            </h2>
            <button 
              onClick={() => router.push("/register")}
              className="btn-primary h-16 px-10 text-lg shadow-2xl"
            >
              Join the Sanctuary
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-white/5 relative z-10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <BookOpen size={14} className="text-primary" />
            </div>
            <span className="font-semibold text-sm text-zinc-400">RasoRead • 2024</span>
          </div>
          <div className="flex gap-8">
            <a href="/privacy" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="/terms" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Terms</a>
            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Discord</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

