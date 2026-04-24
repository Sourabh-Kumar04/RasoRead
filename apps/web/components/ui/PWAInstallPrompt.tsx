"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (sessionStorage.getItem("pwa-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 30s of use — not immediately (less annoying)
      setTimeout(() => setShow(true), 30_000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-dismissed", "1");
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[60]"
        >
          <div className="bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Download size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-label text-sm font-semibold text-white">Install RasoRead</p>
                <p className="font-label text-xs text-zinc-500 mt-0.5">
                  Listen with screen locked. Works offline.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={install}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-on-primary font-label text-xs font-semibold hover:brightness-110 transition-all"
                  >
                    Install
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-zinc-500 font-label text-xs hover:text-zinc-300 transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
