"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Headphones, Zap, BarChart3, CheckCircle, ChevronRight } from "lucide-react";

const FEATURES = [
  {
    icon: Headphones,
    title: "Studio AI Narration",
    desc: "Edge TTS and GPT-4o voices read your books word-by-word with real-time text sync.",
  },
  {
    icon: Zap,
    title: "Instant Highlights",
    desc: "Select text to highlight in four colours. Voice-command highlights with 'raso highlight … to …'.",
  },
  {
    icon: BookOpen,
    title: "Real Page View",
    desc: "PDF pages render as crisp scanned images — read exactly what the author intended.",
  },
  {
    icon: BarChart3,
    title: "Reading Insights",
    desc: "Track velocity, streaks, and comprehension. Every session logged automatically.",
  },
];

const SOCIAL_PROOF = [
  "PDF · EPUB · DOCX · TXT",
  "Offline PWA",
  "30+ AI Voices",
  "AI Q&A on any paragraph",
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (token) { router.replace("/library"); return; }
    setIsLoggedIn(false);
  }, [router]);

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-indigo-500/30">
      {/* ── Ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 h-16 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <BookOpen size={14} className="text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-base text-white tracking-tight">RasoRead</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <button onClick={() => router.push("/login")} className="hover:text-white transition-colors">
            Sign in
          </button>
        </div>

        <button
          onClick={() => router.push("/register")}
          className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
        >
          Get started <ChevronRight size={14} />
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center pt-24 pb-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Now in early access
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.06] mb-6">
            Read smarter.<br />
            <span className="text-zinc-400">Listen deeper.</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            RasoRead turns any PDF, EPUB or DOCX into an immersive AI audio experience — with word-by-word highlighting, voice commands, and deep reading analytics.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <button
              onClick={() => router.push("/register")}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-7 py-3.5 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.35)] transition-all active:scale-95 group text-base"
            >
              Start for free
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white px-5 py-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] transition-all"
            >
              Sign in to library
            </button>
          </div>

          {/* Social proof pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SOCIAL_PROOF.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-zinc-500 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <CheckCircle size={11} className="text-emerald-500" />
                {s}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Hero product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 max-w-5xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_32px_80px_rgba(0,0,0,0.8)]">
            {/* Browser chrome */}
            <div className="bg-zinc-900 border-b border-white/10 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
              </div>
              <div className="flex-1 mx-4 bg-zinc-800 rounded-md h-6 flex items-center px-3">
                <span className="text-xs text-zinc-500 font-mono">localhost:3000/reader/book</span>
              </div>
            </div>

            {/* Simulated reader UI */}
            <div className="bg-[#0f0f0f] p-8 min-h-[340px] flex gap-6">
              {/* Page image mockup */}
              <div className="hidden md:block w-[260px] shrink-0">
                <div className="bg-white rounded-sm shadow-2xl p-6 text-zinc-800 text-xs leading-relaxed space-y-3 font-serif">
                  <div className="font-bold text-sm mb-4">Chapter 3: The Neural Pathway</div>
                  <p className="bg-indigo-100 border-b-2 border-indigo-400 rounded-sm px-0.5">The architecture of silence is not merely the absence of sound.</p>
                  <p>It is a deliberate construction of space where thoughts can breathe and the mind finds its natural resonance with the material before it.</p>
                  <p className="bg-amber-50 border-b-2 border-amber-300 rounded-sm px-0.5">Every book is a room. Every page a window.</p>
                  <div className="pt-3 border-t border-zinc-200 flex justify-between text-[9px] text-zinc-400">
                    <span>Page 47</span><span>RasoRead</span>
                  </div>
                </div>
              </div>

              {/* Right panel — TTS controls mockup */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-zinc-500 font-mono">neural synthesis active</span>
                </div>

                <div className="space-y-2">
                  {["The architecture of silence is not merely", "the absence of sound. It is a deliberate", "construction of space where thoughts breathe."].map((line, i) => (
                    <div key={i} className={`text-sm leading-relaxed rounded-lg px-3 py-1.5 transition-all ${i === 0 ? "bg-indigo-500/15 text-white ring-1 ring-indigo-500/30" : "text-zinc-500"}`}>
                      {line}
                    </div>
                  ))}
                </div>

                {/* Mini player */}
                <div className="mt-6 flex items-center gap-4 bg-zinc-900/80 border border-white/10 rounded-2xl p-4">
                  <div className="flex gap-1">
                    {[12, 18, 10, 16, 8, 14].map((h, i) => (
                      <div key={i} className="w-0.5 bg-indigo-400 rounded-full animate-pulse" style={{ height: h, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">Fastapi Modern Python</div>
                    <div className="text-[10px] text-zinc-500">Aria Neural · 1.25×</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-white ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Everything you need to read better
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Built for focused readers who want more from their books.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                  <Icon size={20} className="text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="pricing" className="relative z-10 py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Free while in early access
            </h2>
            <p className="text-zinc-500 mb-8 text-base leading-relaxed">
              Upload unlimited books. No credit card. No time limit. Just better reading.
            </p>
            <button
              onClick={() => router.push("/register")}
              className="inline-flex items-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-zinc-100 active:scale-95 transition-all text-base"
            >
              Create your library <ArrowRight size={16} />
            </button>
            <p className="text-xs text-zinc-600 mt-4">Sign up in 30 seconds · No CC required</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
              <BookOpen size={10} className="text-white" fill="currentColor" />
            </div>
            <span className="text-sm font-semibold text-zinc-400">RasoRead</span>
            <span className="text-zinc-700 text-sm">· 2025</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms</a>
            <span>Built with Next.js · FastAPI · PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
