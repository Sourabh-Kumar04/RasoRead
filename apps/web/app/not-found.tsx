import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-2xl bg-surface-high flex items-center justify-center">
        <BookOpen size={28} className="text-outline" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="font-headline text-2xl text-[#dae2fd]">Page not found</h1>
        <p className="font-label text-sm text-outline">
          The page you're looking for doesn't exist.
        </p>
      </div>
      <Link href="/library" className="btn-primary text-sm">
        Back to library
      </Link>
    </div>
  );
}
