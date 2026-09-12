import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Bottom-anchored CTA shown only on small screens, for public pages where a
 * visitor might scroll past the above-the-fold sign-up button. Mirrors the
 * sticky-bottom-bar pattern already used by MiniPlayer inside the app.
 */
export const StickyMobileCta: React.FC = () => {
  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-surface-0/95 backdrop-blur border-t border-border-subtle">
      <Link
        to="/register"
        className="w-full flex items-center justify-center px-5 py-3 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors"
      >
        Get started free
      </Link>
    </div>
  );
};
