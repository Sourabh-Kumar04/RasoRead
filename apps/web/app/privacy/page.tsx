"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-3 px-6 bg-[#0A0A0A]/90 backdrop-blur-[20px] border-b border-white/[0.06]">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-300"><ArrowLeft size={16} /></button>
        <span className="font-headline italic text-lg text-white">Privacy Policy</span>
      </header>
      <main className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
        <div className="space-y-8 font-label text-zinc-400 leading-relaxed">
          <div>
            <h2 className="font-headline text-xl text-white mb-3">What we collect</h2>
            <p>We collect your email address, name, and the books you upload. We also store your reading progress, highlights, and notes so you can resume reading across sessions.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">What we don't collect</h2>
            <p>We do not sell your data. We do not run ads. We do not track you across other websites. We do not share your data with third parties except as required to operate the service (e.g. AI providers for summaries).</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">AI processing</h2>
            <p>When you use AI features (summaries, Q&A), excerpts of your book text are sent to the configured AI provider (Google Gemini, OpenAI, or Groq). This is necessary to generate responses. We do not store these requests beyond what the AI provider's own policies allow.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">Text-to-Speech</h2>
            <p>When using Edge TTS (the default), text is sent to Microsoft's Azure servers for synthesis. No account or API key is required. When using other TTS providers, text is sent to the respective provider.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">Data deletion</h2>
            <p>You can delete your account and all associated data at any time from your Profile page. Deletion is permanent and immediate.</p>
          </div>
          <div>
            <h2 className="font-headline text-xl text-white mb-3">Contact</h2>
            <p>For privacy questions, contact us through the app.</p>
          </div>
          <p className="text-zinc-600 text-sm pt-4 border-t border-white/[0.06]">Last updated: April 2026</p>
        </div>
      </main>
    </div>
  );
}
