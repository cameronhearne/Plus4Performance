import React, { createContext, useContext, useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export const DEFAULT_BRANDING = {
  slug:            null,        // null = main Plus 4 Performance site
  creator_id:      null,
  name:            'Plus 4 Performance',
  logo_url:        null,
  primary_color:   '#C0392B',
  secondary_color: '#F5F3EE',
};

const BrandingContext = createContext(DEFAULT_BRANDING);

// Extracts a creator slug from the current hostname.
// "gymreaper.plus4performance.com" → "gymreaper"
// "plus4performance.com" / "www.plus4performance.com" / "localhost" → null
function detectSlug() {
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0];
  return null;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    const slug = detectSlug();
    if (!slug) return; // already using defaults

    fetch(`${API}/api/creator-config?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.creator) setBranding({ ...DEFAULT_BRANDING, ...data.creator });
      })
      .catch(() => { /* network error — keep defaults */ });
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
