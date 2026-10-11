import { useState } from 'react';
import { AppShell } from './components/AppShell';
import './privacy.css';

export function PrivacyPage() {
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState(false);
  function clearData() {
    try {
      localStorage.removeItem('nearRxTravelPreferences');
      localStorage.removeItem('nearRxDefaultSort');
      for (const key of ['nearRxStartingLocation', 'nearRxStartingCoordinates', 'pharmreach:helper:v1']) sessionStorage.removeItem(key);
      setCleared(true);
      window.dispatchEvent(new Event('pharmreach:clear-chat'));
    } catch { setError(true); }
  }
  return <AppShell><main className="privacy-page">
    <h1>Privacy &amp; browser storage</h1>
    <p className="privacy-date">Updated October 11, 2026</p>
    <p>PharmReach helps you compare over-the-counter products and nearby pharmacies. This notice explains what information the website uses and your choices.</p>
    <h2>Information you choose to share</h2>
    <p>We use your starting address or coordinates, selected products, and travel preferences to show pharmacy results and plan routes. Using your device’s location requires browser permission. Address autocomplete sends what you type to Google Places once you start typing an address. You can enter coordinates instead or decline location permission.</p>
    <h2>Medication helper</h2>
    <p>When you ask the helper a question, our server checks it and may send the message and our public product catalog to Google Gemini to select matching products. Previous turns are not sent as conversation context. Avoid sharing names, contact details, medical records, or other identifying information.</p>
    <p>Google’s handling of prompts depends on the API service terms and the project’s billing status. Under unpaid-service terms, Google may use submitted content to improve its products and human reviewers may review it. See <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API terms</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s privacy policy</a>. This helper is not a private medical consultation.</p>
    <h2>Cookies and browser storage</h2>
    <p>PharmReach’s application does not set its own cookies or include advertising or analytics trackers. It uses local storage to remember travel preferences and your default sort until you clear them. Session storage keeps your starting location and the helper’s last five questions and replies, draft, and open state within this tab. Session data normally ends when the tab closes, though browser session restoration may restore it.</p>
    <p>Google Places loads when you request address suggestions. Google Fonts loads the website’s fonts. These services receive connection information such as your IP address and browser details. Google services may use cookies or similar technologies under <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google’s cookie policy</a>. Cloudflare delivers and protects the website and may set security cookies when its protections require them; see <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" target="_blank" rel="noopener noreferrer">Cloudflare’s cookie information</a>.</p>
    <h2>Server processing and retention</h2>
    <p>Cloudflare processes requests to deliver and secure this website. Our server uses IP addresses temporarily to limit chat abuse and processes location and product choices to generate results. Routing results may be cached on the server. The application does not save chat transcripts to a database.</p>
    <p>New application logs contain operational information such as endpoints, response status, and timing, without chat text, chat product IDs, or URL query strings. Older logs from before this change may contain chat excerpts, IP addresses, and location or product queries. Server logs rotate according to available storage; a fixed retention period has not yet been configured. Google and Cloudflare retain information under their own policies.</p>
    <h2>Your choices</h2>
    <p>You can use product search without using the helper, decline browser location permission, clear the website’s browser data, or adjust your browser’s cookie settings. Clearing below resets saved travel preferences, sorting, the starting location, and this tab’s chat. It does not delete server logs or information already processed by providers.</p>
    <button className="primary" type="button" onClick={clearData} disabled={cleared}>{cleared ? 'Saved browser data cleared' : 'Clear saved browser data'}</button>
    <p role="status">{cleared ? 'Preferences and location have been reset, and this tab’s chat has been cleared.' : error ? 'Your browser blocked access to storage. Clear this site’s data through your browser settings.' : ''}</p>
    <h2>Contact</h2>
    <p>For privacy questions or requests about information we may hold, email <a href="mailto:d9hhhh@gmail.com">d9hhhh@gmail.com</a>. Do not include medical information in your request. We may need enough information to identify the relevant records; deletion by us does not automatically remove information held by service providers.</p>
  </main></AppShell>;
}
