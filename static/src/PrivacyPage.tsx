import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { COORDS_KEY, ORIGIN_KEY, PREFERENCES_KEY, SORT_KEY } from './core';
import './privacy.css';

export function PrivacyPage() {
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState(false);
  function clearData() {
    try {
      localStorage.removeItem(PREFERENCES_KEY);
      localStorage.removeItem(SORT_KEY);
      for (const key of [ORIGIN_KEY, COORDS_KEY, 'pharmreach:helper:v1']) sessionStorage.removeItem(key);
      setCleared(true);
      window.dispatchEvent(new Event('pharmreach:clear-chat'));
    } catch { setError(true); }
  }
  return <AppShell><main className="privacy-page">
    <h1>Privacy &amp; browser storage</h1>
    <p className="privacy-date">Updated October 11, 2026</p>
    <p>PharmReach helps you compare over-the-counter products and nearby pharmacies. This notice explains what information the website uses and your choices.</p>
    <h2>Information you choose to share</h2>
    <p>We use your starting address or coordinates, selected products, and travel preferences in your browser to show pharmacy results and estimate trips. Using your device’s location requires browser permission. Address autocomplete sends what you type to Google Places once you start typing an address. You can enter coordinates instead or decline location permission.</p>
    <h2>Medication helper</h2>
    <p>The helper on this version of PharmReach is not AI. It is a keyword-matching algorithm that runs entirely in your browser: your message is compared against a fixed list of symptom words and is never sent to PharmReach, Google, or any other service. It cannot understand context and is not a medical consultation.</p>
    <h2>Cookies and browser storage</h2>
    <p>PharmReach’s application does not set its own cookies or include advertising or analytics trackers. It uses local storage to remember travel preferences and your default sort until you clear them. Session storage keeps your starting location and the helper’s last five questions and replies, draft, and open state within this tab. Session data normally ends when the tab closes, though browser session restoration may restore it.</p>
    <p>Google Places loads when you request address suggestions. Google Fonts loads the website’s fonts, and map tiles load from OpenStreetMap. These services receive connection information such as your IP address and browser details. Google services may use cookies or similar technologies under <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google’s cookie policy</a>.</p>
    <h2>Hosting</h2>
    <p>This site is a set of static files hosted on GitHub Pages. There is no PharmReach server: product search, pharmacy results, and travel estimates are computed in your browser from a published snapshot. GitHub may log visits (including IP addresses) to operate the service; see <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub’s privacy statement</a>.</p>
    <h2>Your choices</h2>
    <p>You can use product search without using the helper, decline browser location permission, clear the website’s browser data, or adjust your browser’s cookie settings. Clearing below resets saved travel preferences, sorting, the starting location, and this tab’s chat. It does not delete information already processed by providers such as Google or GitHub.</p>
    <button className="primary" type="button" onClick={clearData} disabled={cleared}>{cleared ? 'Saved browser data cleared' : 'Clear saved browser data'}</button>
    <p role="status">{cleared ? 'Preferences and location have been reset, and this tab’s chat has been cleared.' : error ? 'Your browser blocked access to storage. Clear this site’s data through your browser settings.' : ''}</p>
    <h2>Contact</h2>
    <p>For privacy questions or requests about information we may hold, email <a href="mailto:d9hhhh@gmail.com">d9hhhh@gmail.com</a>. Do not include medical information in your request. We may need enough information to identify the relevant records; deletion by us does not automatically remove information held by service providers.</p>
  </main></AppShell>;
}
