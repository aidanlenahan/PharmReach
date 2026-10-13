import { useEffect } from 'react';
import { HomePage } from './HomePage';
import { FindMedicinePage } from './FindMedicinePage';
import { ResultsPage } from './ResultsPage';
import { SettingsPage } from './SettingsPage';
import { OnboardingPage } from './OnboardingPage';
import { ProductsPage } from './ProductsPage';
import { StylesPage } from './StylesPage';
import { PrivacyPage } from './PrivacyPage';
import { DisclaimerPage } from './DisclaimerPage';
import { AboutPage } from './AboutPage';
import { getPalette } from './palettes';
import { getPreferences } from './core';
import { AppShell } from './components/AppShell';
import { Skeleton } from './components/LoadingSkeleton';

export function App() {
  // The server redirects *.html to clean paths; this also covers dev servers that don't.
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const styles = path === '/styles' || path === '/styles/' || path === '/styles/index.html';
  const palette = styles ? getPalette(new URLSearchParams(location.search).get('palette')) : undefined;
  const onboarding = path === '/onboarding';
  const needsPreferences = path === '/find-medicine' || path === '/results' || path === '/settings';
  useEffect(() => {
    document.title = path === '/find-medicine' ? 'Find medicine · PharmReach' : path === '/privacy' ? 'Privacy · PharmReach' : path === '/disclaimer' ? 'Disclaimer · PharmReach' : path === '/about' ? 'About · PharmReach' : styles && !palette ? 'Styles · PharmReach' : onboarding ? 'Travel setup · PharmReach' : path === '/results' ? 'Results · PharmReach' : path === '/products' ? 'Products · PharmReach' : path === '/settings' ? 'Settings · PharmReach' : 'PharmReach · Find your medicine nearby';
    if (needsPreferences && !getPreferences()) {
      location.replace(`/onboarding?next=${encodeURIComponent(path + location.search)}`);
    }
  }, [onboarding, path, needsPreferences]);
  if (styles) return palette ? <HomePage /> : <StylesPage />;
  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/disclaimer') return <DisclaimerPage />;
  if (path === '/about') return <AboutPage />;
  if (onboarding) return <OnboardingPage />;
  if (needsPreferences && !getPreferences()) return <AppShell onboarding><main className="onboarding" aria-busy="true"><span className="visually-hidden" role="status">Opening travel setup…</span><Skeleton className="skeleton-name" /><Skeleton className="skeleton-text" /></main></AppShell>;
  if (path === '/find-medicine') return <FindMedicinePage />;
  if (path === '/results') return <ResultsPage />;
  if (path === '/products') return <ProductsPage />;
  if (path === '/settings') return <SettingsPage />;
  return <HomePage />;
}
