import React from 'react';

interface PageHeroProps {
  /** Small uppercase label above the title, e.g. "Discover" */
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tailwind max-width class for the centered content column. Default: max-w-2xl */
  maxWidth?: string;
  /** Extra classes appended to the <h1>, e.g. "italic" for Music Twin's persona name. */
  titleClassName?: string;
  /** Extra content rendered below the title/description, inside the same centered column. */
  children?: React.ReactNode;
}

/**
 * Shared hero/header block for content pages: eyebrow label + large serif title,
 * centered in a readable column so pages don't end up with all their content
 * jammed against the left edge and a huge dead gap on wide viewports.
 *
 * Not for pages that need a full-width split header (title left, action button
 * right) — those already use the available width correctly and should keep
 * their own markup.
 */
export const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title, description, maxWidth = 'max-w-2xl', titleClassName = '', children }) => (
  <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8">
    <div className={`mx-auto ${maxWidth}`}>
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">{eyebrow}</p>
      <h1 className={`font-display text-2xl sm:text-3xl lg:text-4xl text-text-primary leading-snug mt-3 ${titleClassName}`}>{title}</h1>
      {description && <p className="text-text-tertiary text-sm mt-2">{description}</p>}
      {children}
    </div>
  </section>
);
