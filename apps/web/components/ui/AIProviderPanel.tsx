"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Zap, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api";

interface Provider {
  id: string;
  name: string;
  model: string;
  configured: boolean;
  features: string[];
  note?: string;
}

interface ProvidersResponse {
  active: string;
  active_name: string;
  available: boolean;
  providers: Provider[];
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  gemini: <Sparkles size={12} />,
  groq:   <Zap size={12} />,
  openai: <Brain size={12} />,
};

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  groq:   "bg-orange-500/15 text-orange-300 border-orange-500/30",
  openai: "bg-green-500/15 text-green-300 border-green-500/30",
  none:   "bg-outline/10 text-outline border-outline/20",
};

/** Small badge showing active AI provider — renders in SmartPanel header */
export function AIProviderBadge() {
  const [data, setData] = useState<ProvidersResponse | null>(null);

  useEffect(() => {
    aiApi.providers()
      .then((res) => setData(res.data))
      .catch(() => {});
  }, []);

  if (!data) return null;

  const colorClass = PROVIDER_COLORS[data.active] || PROVIDER_COLORS.none;
  const icon = PROVIDER_ICONS[data.active] || <Brain size={12} />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-label uppercase tracking-wider",
        colorClass
      )}
      title={data.active_name}
    >
      {icon}
      {data.active === "none" ? "No AI" : data.active}
    </motion.div>
  );
}

/** Full provider selector panel — shown in SmartPanel AI tab */
export function AIProviderPanel() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.providers()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Active provider summary */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        data.available
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      )}>
        {data.available
          ? <Sparkles size={16} className="text-green-400 shrink-0" />
          : <AlertCircle size={16} className="text-red-400 shrink-0" />}
        <div>
          <p className="font-label text-xs font-semibold text-[#dae2fd]">
            {data.available ? data.active_name : "No AI provider configured"}
          </p>
          <p className="font-label text-[10px] text-outline mt-0.5">
            {data.available
              ? "Active — all AI features enabled"
              : "Add an API key in your .env file to enable AI features"}
          </p>
        </div>
      </div>

      {/* Provider list */}
      <div className="space-y-2">
        {data.providers.map((p) => {
          const isActive = p.id === data.active;
          const colorClass = PROVIDER_COLORS[p.id] || PROVIDER_COLORS.none;
          const icon = PROVIDER_ICONS[p.id] || <Brain size={14} />;

          return (
            <div
              key={p.id}
              className={cn(
                "p-3 rounded-xl border transition-colors",
                isActive
                  ? "border-primary/30 bg-primary/5"
                  : "border-outline-variant/10 bg-surface-high"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "p-1 rounded-lg border",
                    colorClass
                  )}>
                    {icon}
                  </span>
                  <div>
                    <p className="font-label text-xs font-semibold text-[#dae2fd]">
                      {p.name}
                    </p>
                    <p className="font-label text-[10px] text-outline">{p.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive && (
                    <span className="font-label text-[9px] uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    p.configured ? "bg-green-400" : "bg-outline/40"
                  )} />
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-1 mt-2">
                {p.features.map((f) => (
                  <span
                    key={f}
                    className="font-label text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-highest text-outline"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {p.note && (
                <p className="font-label text-[10px] text-outline mt-1.5 italic">
                  {p.note}
                </p>
              )}

              {!p.configured && (
                <p className="font-label text-[10px] text-outline/60 mt-1.5">
                  Set {p.id.toUpperCase()}_API_KEY in .env to activate
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Setup hint */}
      {!data.available && (
        <div className="p-3 rounded-xl bg-surface-high border border-outline-variant/10">
          <p className="font-label text-[10px] text-outline leading-relaxed">
            To enable AI features, add at least one of these to your .env file:
          </p>
          <code className="block mt-2 font-mono text-[10px] text-primary/80 leading-relaxed">
            GEMINI_API_KEY=your-key<br />
            GROQ_API_KEY=your-key<br />
            OPENAI_API_KEY=your-key
          </code>
        </div>
      )}
    </div>
  );
}
