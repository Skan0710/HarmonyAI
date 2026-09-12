import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}

const SITE_NAME = 'HarmonyAI';
const SITE_URL = 'https://harmonyai.app';
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;

/**
 * Per-page <title>/meta manager. Every route should render this once with a
 * unique title + description so crawlers and social previews don't all see
 * the same generic "frontend" tag that shipped from the Vite scaffold.
 */
export const Seo: React.FC<SeoProps> = ({ title, description, path = '', noIndex = false }) => {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={DEFAULT_IMAGE} />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  );
};
