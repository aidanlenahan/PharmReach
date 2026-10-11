import { useEffect } from 'react';
import { HomePage } from './HomePage';
import { FindMedicinePage } from './FindMedicinePage';
import { ResultsPage } from './ResultsPage';
import { SettingsPage } from './SettingsPage';
import { OnboardingPage } from './OnboardingPage';
import { ProductsPage } from './ProductsPage';
import { StylesPage } from './StylesPage';
import { PrivacyPage } from './PrivacyPage';
import { getPalette } from './palettes';
import { getPreferences } from './core';
import { AppShell } from './components/AppShell';
import { Skeleton } from './components/LoadingSkeleton';

export function App() {
  const path = location.pathname;
  const styles = path === '/styles' || path === '/styles/' || path === '/styles/index.html';
  const palette = styles ? getPalette(new URLSearchParams(location.search).get('palette')) : undefined;
  const onboarding = path === '/onboarding.html';
  const needsPreferences = path === '/find-medicine.html' || path === '/results.html' || path === '/settings.html';
  useEffect(() => {
    document.title = path === '/find-medicine.html' ? 'Find medicine · PharmReach' : path === '/privacy.html' ? 'Privacy · PharmReach' : styles && !palette ? 'Styles · PharmReach' : onboarding ? 'Travel setup · PharmReach' : path === '/results.html' ? 'Results · PharmReach' : path === '/products.html' ? 'Products · PharmReach' : path === '/settings.html' ? 'Settings · PharmReach' : 'PharmReach · Find your medicine nearby';
    if (needsPreferences && !getPreferences()) {
      location.replace(`/onboarding.html?next=${encodeURIComponent(path + location.search)}`);
    }
  }, [onboarding, path, needsPreferences]);
  if (styles) return palette ? <HomePage /> : <StylesPage />;
  if (path === '/privacy.html') return <PrivacyPage />;
  if (onboarding) return <OnboardingPage />;
  if (needsPreferences && !getPreferences()) return <AppShell onboarding><main className="onboarding" aria-busy="true"><span className="visually-hidden" role="status">Opening travel setup…</span><Skeleton className="skeleton-name" /><Skeleton className="skeleton-text" /></main></AppShell>;
  if (path === '/find-medicine.html') return <FindMedicinePage />;
  if (path === '/results.html') return <ResultsPage />;
  if (path === '/products.html') return <ProductsPage />;
  if (path === '/settings.html') return <SettingsPage />;
  return <HomePage />;
}
