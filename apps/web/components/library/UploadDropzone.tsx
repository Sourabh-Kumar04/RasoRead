"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { booksApi } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

interface BookOut {
  id: string;
  title: string;
  author?: string;
  file_type: string;
  cover_url?: string;
  total_pages: number;
  total_words: number;
  toc: unknown[];
  status: string;
  created_at: string;
}

interface UploadDropzoneProps {
  onUploadSuccess: (book: BookOut) => void;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/epub+zip": [".epub"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

type UploadState = "idle" | "uploading" | "success" | "error";

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);

  const upload = useCallback(
    async (file: File) => {
      setState("uploading");
      setProgress(0);

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 7, 85));
      }, 180);

      try {
        const res = await booksApi.upload(file);
        clearInterval(progressInterval);
        setProgress(100);
        setState("success");
        toast.success(`"${res.data.title}" uploaded — processing in background`);
        setTimeout(() => {
          onUploadSuccess(res.data);
          setState("idle");
          setProgress(0);
        }, 1400);
      } catch (err: any) {
        clearInterval(progressInterval);
        const msg =
          err?.response?.data?.detail ||
          "Upload failed. Check file type and size (max 100 MB).";
        toast.error(msg);
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    onDropAccepted: ([file]) => upload(file),
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || "File rejected";
      toast.error(msg);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer",
        "transition-all duration-200 select-none",
        isDragActive && !isDragReject && "border-primary/60 bg-primary/5",
        isDragReject && "border-red-500/60 bg-red-500/5",
        state === "error"   && "border-red-500/40",
        state === "success" && "border-green-500/40",
        state === "idle" && !isDragActive && "border-white/10 hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <input {...getInputProps()} />

      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Upload size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-label font-semibold text-on-surface">
                {isDragActive ? "Drop your book here" : "Upload a book"}
              </p>
              <p className="font-label text-sm text-zinc-500 mt-1">PDF · EPUB · DOCX · TXT &nbsp;·&nbsp; Max 100 MB</p>
            </div>
            <button type="button" className="btn-primary text-sm pointer-events-none">Browse files</button>
          </motion.div>
        )}

        {state === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <Loader2 size={36} className="text-primary mx-auto animate-spin" />
            <p className="font-label text-sm text-on-surface">Uploading &amp; processing…</p>
            <div className="w-full max-w-xs mx-auto h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <CheckCircle size={36} className="text-green-400 mx-auto" />
            <p className="font-label text-sm text-on-surface">Uploaded! Processing in background…</p>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <AlertCircle size={36} className="text-red-400 mx-auto" />
            <p className="font-label text-sm text-red-300">Upload failed — see notification</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
