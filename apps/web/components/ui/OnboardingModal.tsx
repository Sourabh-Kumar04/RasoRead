"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ArrowRight, X, Mic2, Brain } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    eyebrow: "Step 1 of 3",
    title: "Upload any book",
    body: "Drop a PDF, EPUB, DOCX, or TXT. We extract every word — including text in tables, sidebars, and footnotes.",
    cta: "Next",
  },
  {
    icon: Mic2,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10 border-indigo-400/20",
    eyebrow: "Step 2 of 3",
    title: "Listen with human voices",
    body: "20+ Microsoft Neural voices read your book aloud. Words highlight in sync as you listen — like karaoke for books.",
    cta: "Next",
  },
  {
    icon: Brain,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    eyebrow: "Step 3 of 3",
    title: "AI understands your book",
    body: "Ask questions, get chapter summaries, save highlights. Your reading streak keeps you coming back every day.",
    cta: "Upload my first book",
  },
];

const STORAGE_KEY = "rasoread-onboarded";

export function OnboardingModal() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      setTimeout(() => setVisible(true), 700);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[70]"
            onClick={finish}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-0 flex items-center justify-center z-[71] px-4 pointer-events-none"
          >
            <div className="w-full max-w-sm bg-[#111111] border border-white/[0.1] rounded-2xl p-7 shadow-[0_40px_80px_rgba(0,0,0,0.9)] pointer-events-auto relative">
              <button
                onClick={finish}
                className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Progress dots */}
              <div className="flex gap-1.5 mb-7">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 flex-1 rounded-full transition-all duration-400 ${
                      i <= step ? "bg-primary" : "bg-white/[0.08]"
                    }`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 ${current.bg}`}>
                    <Icon size={22} className={current.color} />
                  </div>

                  <p className="font-label text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1.5">
                    {current.eyebrow}
                  </p>
                  <h2 className="font-headline text-2xl text-white font-medium mb-2">
                    {current.title}
                  </h2>
                  <p className="font-label text-sm text-zinc-500 leading-relaxed">
                    {current.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={finish}
                  className="font-label text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Skip tour
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(128,131,255,0.25)]"
                >
                  {current.cta}
                  {step < STEPS.length - 1 ? <ArrowRight size={14} /> : <Upload size={14} />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
