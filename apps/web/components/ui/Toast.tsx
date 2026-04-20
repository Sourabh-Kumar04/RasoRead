"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Simple global toast store (no external lib needed)
let listeners: ((toasts: Toast[]) => void)[] = [];
let toastList: Toast[] = [];

function notify(message: string, type: ToastType = "info") {
  const id = Math.random().toString(36).slice(2);
  toastList = [...toastList, { id, message, type }];
  listeners.forEach((l) => l(toastList));
  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id);
    listeners.forEach((l) => l(toastList));
  }, 4000);
}

export const toast = {
  success: (msg: string) => notify(msg, "success"),
  error: (msg: string) => notify(msg, "error"),
  info: (msg: string) => notify(msg, "info"),
};

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const COLORS = {
  success: "text-green-400",
  error: "text-red-400",
  info: "text-primary",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast[]) => setToasts([...t]);
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  const dismiss = (id: string) => {
    toastList = toastList.filter((t) => t.id !== id);
    listeners.forEach((l) => l(toastList));
  };

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl
                         bg-surface-bright border border-outline-variant/20
                         shadow-xl pointer-events-auto max-w-sm"
            >
              <Icon size={16} className={cn(COLORS[t.type], "shrink-0")} />
              <p className="font-label text-sm text-[#dae2fd] flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={12} className="text-outline" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
