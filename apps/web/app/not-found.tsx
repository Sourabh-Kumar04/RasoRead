import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <BookOpen size={28} className="text-zinc-600" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="font-headline text-2xl text-white">Page not found</h1>
        <p className="font-label text-sm text-zinc-500">
          The page you're looking for doesn't exist.
        </p>
      </div>
      <Link href="/library" className="btn-primary text-sm">
        Back to library
      </Link>
    </div>
  );
}
