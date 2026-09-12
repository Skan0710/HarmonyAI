import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared footer for public (logged-out) pages — login, register, FAQ,
 * privacy policy, thank-you. Gives crawlers/users internal links between
 * these pages instead of each one being an orphaned dead end.
 */
export const PublicFooter: React.FC = () => {
  return (
    <footer className="w-full max-w-md mx-auto mt-10 pb-8 text-center space-y-3">
      <nav aria-label="Footer" className="flex items-center justify-center gap-4 text-xs text-text-tertiary">
        <Link to="/" className="hover:text-accent transition-colors">Home</Link>
        <span aria-hidden="true">·</span>
        <Link to="/faq" className="hover:text-accent transition-colors">FAQ</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy-policy" className="hover:text-accent transition-colors">Privacy Policy</Link>
      </nav>
      <p className="text-2xs text-text-tertiary/80">
        Questions? We reply to every support request within 24 hours.
      </p>
      <p className="text-2xs text-text-tertiary/60">
        &copy; {new Date().getFullYear()} HarmonyAI. All rights reserved.
      </p>
    </footer>
  );
};
