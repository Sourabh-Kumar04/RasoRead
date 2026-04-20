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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                 flex justify-around items-center h-20 pb-safe px-4
                 bg-surface rounded-t-3xl border-t border-outline-variant/10 shadow-2xl"
    >
      {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
        const active = pathname === href.split("?")[0];
        return (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-outline hover:text-secondary"
            )}
          >
            <Icon size={20} />
            <span className="font-label text-[9px] uppercase tracking-widest">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
