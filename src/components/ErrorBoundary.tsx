import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while syncing with the store database.';
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string; path?: string };
        if (parsed.error) {
          friendly = parsed.error.includes('Missing or insufficient permissions')
            ? `Permission denied while accessing ${parsed.path || 'database'}. Please sign in with the authorized account and try again.`
            : parsed.error;
        }
      } catch {
        friendly = this.state.errorMessage || friendly;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0D0F12] px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 space-y-4 text-center shadow-lg">
            <h1 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Su&amp;KoKo Store Sync Notice
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
