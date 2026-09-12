import React from 'react';
import { Helmet } from 'react-helmet-async';
import { AudioLines } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { StickyMobileCta } from '../components/StickyMobileCta';

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How does HarmonyAI build my recommendations?',
    answer:
      "HarmonyAI analyzes what you play, skip, and like to build a Music DNA profile — a living model of your taste that improves the more you listen, and powers your personalized feed, radio, and AI-generated playlists.",
  },
  {
    question: 'Is HarmonyAI free to use?',
    answer: 'Yes. Creating an account and using core discovery features — recommendations, playlists, and Music DNA — is free.',
  },
  {
    question: 'Can I generate a playlist with AI?',
    answer:
      'Yes — the AI Playlist Generator lets you describe a mood, activity, or vibe and HarmonyAI assembles a playlist from your taste profile and catalog matches in seconds.',
  },
  {
    question: 'How is my listening data used?',
    answer:
      'Your listening history is used only to personalize your own recommendations. We never sell personal data to third parties — see our Privacy Policy for full details.',
  },
  {
    question: 'How quickly does support respond?',
    answer: 'We reply to every support request within 24 hours, every day of the week.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export const FaqPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center p-4 pt-10 pb-20 sm:pb-4">
      <Seo
        title="Frequently Asked Questions"
        description="Answers to common questions about HarmonyAI's recommendations, Music DNA, AI playlists, pricing, and data privacy."
        path="/faq"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="w-full max-w-2xl">
        <Breadcrumbs items={[{ label: 'FAQ' }]} />

        <div className="text-center mb-7 mt-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-wash text-accent mb-4">
            <AudioLines size={22} strokeWidth={1.75} />
          </div>
          <h1 className="font-display italic text-3xl text-text-primary tracking-tight">
            Frequently Asked <span className="text-accent not-italic">Questions</span>
          </h1>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <h2 className="text-sm font-semibold text-text-primary mb-1.5">{faq.question}</h2>
              <p className="text-sm text-text-tertiary leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-6 text-xs text-text-tertiary">
          Ready to try it?{' '}
          <AnimatedLink to="/register" showArrow={false} className="text-accent hover:text-accent-strong font-medium">
            Create a free account
          </AnimatedLink>
        </div>
      </div>

      <PublicFooter />
      <StickyMobileCta />
    </div>
  );
};
