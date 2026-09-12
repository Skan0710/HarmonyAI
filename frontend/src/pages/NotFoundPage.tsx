import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '../components/Seo';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Seo
        title="Page Not Found"
        description="The page you're looking for doesn't exist, has been moved, or is temporarily unavailable."
        path="/404"
        noIndex
      />
      <div className="max-w-md w-full text-center space-y-6 bg-surface-1 border border-border-subtle p-8 sm:p-10 rounded-[var(--radius-lg)]">
        {/* 404 Badge & Graphic */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-accent-wash text-accent flex items-center justify-center border border-accent/20 shadow-inner">
            <span className="font-display text-4xl text-accent tracking-tighter">404</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-2 text-text-tertiary flex items-center justify-center border border-border-default">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl text-text-primary tracking-tight">Page Not Found</h1>
          <p className="text-sm text-text-tertiary leading-relaxed">
            The page or route you are looking for doesn't exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>

          <button
            onClick={() => navigate('/library')}
            className="w-full sm:w-auto px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary font-medium text-sm rounded-[var(--radius-pill)] border border-border-default transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Explore Library
          </button>
        </div>
      </div>
    </div>
  );
};
