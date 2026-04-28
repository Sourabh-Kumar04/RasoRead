"use client";

import { useRouter, usePathname } from "next/navigation";
import { BookOpen, Search, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Library",  icon: BookOpen,  href: "/library"  },
  { label: "Search",   icon: Search,    href: "/search"   },
  { label: "Insights", icon: BarChart2, href: "/insights" },
  { label: "Profile",  icon: User,      href: "/profile"  },
];

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide inside reader, auth pages, search (has its own header), share pages
  if (
    pathname.startsWith("/reader") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/share")
  ) return null;

  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden"
      aria-label="Main navigation"
    >
      <div className="rounded-2xl bg-[#0A0A0A]/95 backdrop-blur-[24px] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center gap-1 px-2 py-2">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={cn(
                "flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all active:scale-90 duration-150",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              <span className="font-label text-[9px] uppercase tracking-[0.15em] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
