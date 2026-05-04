"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy, Headphones } from "lucide-react";
import { analyticsApi } from "@/lib/api";

export function StreakTracker() {
  const [data, setData] = useState({
    streak: 0,
    longest: 0,
    totalListeningMinutes: 0,
    isActive: false,
  });

  useEffect(() => {
    analyticsApi.getStreak()
      .then((res) => {
        setData({
          streak: res.data.streak,
          longest: res.data.longest,
          totalListeningMinutes: res.data.total_listening_minutes || 0,
          isActive: res.data.streak > 0,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold tracking-tight text-lg">Your Journey</h3>
        <Flame size={20} className={data.isActive ? "text-orange-400" : "text-zinc-600"} />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-2">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center group transition-colors hover:bg-white/10">
          <Flame size={20} className="text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-2xl font-black text-white">{data.streak}</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Day Streak</span>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center group transition-colors hover:bg-white/10">
          <Trophy size={20} className="text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-2xl font-black text-white">{data.longest}</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Best Streak</span>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center group transition-colors hover:bg-white/10">
          <Headphones size={20} className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-2xl font-black text-white">{Math.floor(data.totalListeningMinutes / 60)}h</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Total Listen</span>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-white/5">
        <p className="text-xs text-zinc-500 font-medium">
          {data.isActive 
            ? "You're on a streak! Keep reading to maintain it." 
            : "Start reading today to build your streak!"}
        </p>
      </div>
    </motion.div>
  );
}
