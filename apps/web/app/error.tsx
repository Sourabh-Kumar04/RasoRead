"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h1 className="font-headline text-2xl text-white">Something went wrong</h1>
        <p className="font-label text-sm text-zinc-500">
          {error.message || "An unexpected error occurred. Your reading progress is saved."}
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-outline/50">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Try again
        </button>
        <button
          onClick={() => router.push("/library")}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <Home size={14} />
          Library
        </button>
      </div>
    </div>
  );
}
