import React from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, an uncaught render error anywhere in the tree (e.g. a page
// that doesn't guard against a failed/401'd API response) takes down the
// entire SPA to a permanently blank screen — React unmounts everything below
// the nearest boundary and never remounts it on its own, even via browser
// back/forward, since that's still the same page load.
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Unhandled render error, showing recovery screen.', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-surface-0 text-text-primary px-6">
          <div className="text-center max-w-sm">
            <h1 className="font-display text-xl mb-2">Something went wrong</h1>
            <p className="text-sm text-text-tertiary mb-6">
              This page hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors cursor-pointer"
            >
              <RefreshCw size={15} />
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
