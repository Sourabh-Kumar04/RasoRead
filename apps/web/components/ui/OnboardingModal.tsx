"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Headphones, Zap, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    icon: Upload,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    title: "Upload any book",
    body: "Drop a PDF, EPUB, DOCX, or TXT. We extract every word — including text in boxes, tables, and sidebars.",
  },
  {
    icon: Headphones,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    title: "Listen with human voices",
    body: "20+ Microsoft Neural voices read your book aloud. Words highlight in sync as you listen.",
  },
  {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    title: "AI understands your book",
    body: "Ask questions, get summaries, and save highlights. Your reading streak keeps you coming back.",
  },
];

const STORAGE_KEY = "rasoread-onboarded";

export function OnboardingModal() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the library page renders first
      setTimeout(() => setVisible(true), 600);
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]"
            onClick={finish}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-[71] px-4 pointer-events-none"
          >
            <div className="w-full max-w-sm bg-[#0A0A0A] border border-white/[0.1] rounded-2xl p-7 shadow-[0_40px_80px_rgba(0,0,0,0.8)] pointer-events-auto">
              {/* Close */}
              <button
                onClick={finish}
                className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Step indicator */}
              <div className="flex gap-1.5 mb-7">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                      i <= step ? "bg-primary" : "bg-white/[0.08]"
                    }`}
                  />
                ))}
              </div>

              {/* Icon */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-5 ${current.bg}`}>
                    <Icon size={24} className={current.color} />
                  </div>

                  <h2 className="font-headline text-2xl text-white font-medium mb-2">
                    {current.title}
                  </h2>
                  <p className="font-label text-sm text-zinc-500 leading-relaxed">
                    {current.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={finish}
                  className="font-label text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(128,131,255,0.25)]"
                >
                  {step < STEPS.length - 1 ? (
                    <>Next <ArrowRight size={14} /></>
                  ) : (
                    <>Upload my first book <Upload size={14} /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
