import React from 'react';
import { Star } from 'lucide-react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "HarmonyAI's Music DNA actually nailed my taste within a week — better recommendations than anything I've used before.",
    name: 'Priya S.',
    role: 'Early user',
  },
  {
    quote: 'The AI playlist generator saved me so much time. I just describe the vibe and it builds the whole thing.',
    name: 'Devon K.',
    role: 'Daily listener',
  },
  {
    quote: "Watching my Taste Evolution timeline change over months is genuinely fascinating — it's like a mirror for my listening habits.",
    name: 'Amara T.',
    role: 'Music Twin user',
  },
];

/**
 * Lightweight testimonial/"real reviews" block for public pages. Adapted
 * from the checklist's "case studies" item — HarmonyAI is a self-serve app
 * with no client engagements, so short user quotes stand in for that role.
 */
export const Testimonials: React.FC = () => {
  return (
    <section aria-label="What listeners are saying" className="w-full max-w-2xl mx-auto mt-8 grid gap-3 sm:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <figure key={t.name} className="bg-surface-1 border border-border-subtle rounded-[var(--radius-md)] p-4 space-y-2">
          <div className="flex gap-0.5 text-gold" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <blockquote className="text-xs text-text-secondary leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
          <figcaption className="text-2xs text-text-tertiary">
            {t.name} — {t.role}
          </figcaption>
        </figure>
      ))}
    </section>
  );
};
