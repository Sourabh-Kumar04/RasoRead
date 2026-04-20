import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-4 h-4 border",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-2",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full border-primary/20 border-t-primary animate-spin",
        sizes[size],
        className
      )}
    />
  );
}

export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="lg" />
      <p className="font-label text-sm text-outline">{message}</p>
    </div>
  );
}
