"use client";

import { useRouter, usePathname } from "next/navigation";
import { BookOpen, Search, Brain, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Library", icon: BookOpen, href: "/library" },
  { label: "Search", icon: Search, href: "/library?search=1" },
  { label: "AI Insights", icon: Brain, href: "/insights" },
  { label: "Profile", icon: User, href: "/profile" },
];

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Only show on library and insights pages (not inside reader)
  if (pathname.startsWith("/reader")) return null;

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <div className="rounded-full bg-[#0A0A0A]/90 backdrop-blur-[24px] border border-white/10 shadow-[0_10px_50px_rgba(99,102,241,0.2)] flex items-center gap-8 px-8 py-3">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href.split("?")[0];
          return (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all active:scale-90 duration-150",
                active ? "text-primary scale-110" : "text-zinc-500 hover:text-white"
              )}
            >
              <Icon size={20} />
              <span className="font-label text-[10px] uppercase tracking-[0.2em] font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
