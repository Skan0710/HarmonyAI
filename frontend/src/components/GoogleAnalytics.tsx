import React from 'react';
import { Helmet } from 'react-helmet-async';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/**
 * Loads gtag.js only when VITE_GA_MEASUREMENT_ID is set, so the app never
 * ships a broken/empty analytics tag out of the box — add the real
 * measurement ID (from the GA4 property admin) to frontend/.env to enable it.
 */
export const GoogleAnalytics: React.FC = () => {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <Helmet>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      <script>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </script>
    </Helmet>
  );
};
