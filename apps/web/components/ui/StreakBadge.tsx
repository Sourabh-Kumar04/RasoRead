"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { analyticsApi } from "@/lib/api";

export function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);
  const [longest, setLongest] = useState(0);

  useEffect(() => {
    analyticsApi.getStreak()
      .then((res) => {
        setStreak(res.data.streak);
        setLongest(res.data.longest);
      })
      .catch(() => {});
  }, []);

  if (streak === null) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] cursor-default"
      title={`Longest streak: ${longest} days`}
    >
      <Flame
        size={14}
        className={streak > 0 ? "text-orange-400" : "text-zinc-600"}
        fill={streak > 0 ? "currentColor" : "none"}
      />
      <span className={`font-label text-xs font-semibold ${streak > 0 ? "text-orange-400" : "text-zinc-600"}`}>
        {streak > 0 ? `${streak}d` : "—"}
      </span>
    </div>
  );
}
