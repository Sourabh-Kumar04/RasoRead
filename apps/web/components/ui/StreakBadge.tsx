"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { analyticsApi } from "@/lib/api";

export function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);
  const [longest, setLongest] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    analyticsApi.getStreak()
      .then((res) => {
        setStreak(res.data.streak);
        setLongest(res.data.longest);
      })
      .catch(() => {});
  }, []);

  if (streak === null) return null;

  const isActive = streak > 0;

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 16, stiffness: 300 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-default select-none"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="status"
        aria-label={`${streak} day streak. Longest: ${longest} days`}
      >
        <Flame
          size={13}
          className={isActive ? "text-orange-400" : "text-zinc-600"}
          fill={isActive ? "currentColor" : "none"}
        />
        <span className={`font-label text-xs font-semibold ${isActive ? "text-orange-400" : "text-zinc-600"}`}>
          {isActive ? `${streak}d` : "—"}
        </span>
      </motion.div>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-2 right-0 z-50 whitespace-nowrap bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-2 shadow-xl pointer-events-none"
          >
            <p className="font-label text-xs text-zinc-300">
              {isActive ? `${streak}-day streak 🔥` : "No active streak"}
            </p>
            {longest > 0 && (
              <p className="font-label text-[10px] text-zinc-600 mt-0.5">
                Best: {longest} days
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
