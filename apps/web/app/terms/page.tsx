"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-3 px-6 bg-[#0A0A0A]/90 backdrop-blur-[20px] border-b border-white/[0.06]">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-300"><ArrowLeft size={16} /></button>
        <span className="font-headline italic text-lg text-white">Terms of Service</span>
      </header>
      <main className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
        <div className="space-y-8 font-label text-zinc-400 leading-relaxed">
          <div>
            <h2 className="font-headline text-xl text-white mb-3">1. Acceptance of Terms</h2>
            <p>By using RasoRead, you agree to these terms. If you do not agree, do not use the service.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">2. Use of Service</h2>
            <p>RasoRead is provided for personal, non-commercial use. You may upload books and documents you own or have the right to use. You may not upload copyrighted material you do not have rights to.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">3. Your Content</h2>
            <p>You retain ownership of all books and documents you upload. We do not claim any rights to your content. Your files are stored securely and are only accessible to you.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">4. Account Deletion</h2>
            <p>You may delete your account at any time from your Profile page. All your data, including books, highlights, and notes, will be permanently deleted.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">5. Limitation of Liability</h2>
            <p>RasoRead is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">6. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the service constitutes acceptance of the updated terms.</p>
          </div>
          <p className="text-zinc-600 text-sm pt-4 border-t border-white/[0.06]">Last updated: April 2026</p>
        </div>
      </main>
    </div>
  );
}
