"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-label font-semibold text-[#dae2fd]">Something went wrong</p>
            <p className="font-label text-sm text-outline">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 btn-ghost text-sm px-4 py-2"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
