import { AppShell } from './components/AppShell';
import './privacy.css';

export function DisclaimerPage() {
  return <AppShell><main className="privacy-page">
    <h1>Disclaimer</h1>
    <p className="privacy-date">Updated October 13, 2026</p>

    <h2>Medical emergencies</h2>
    <p><b>PharmReach is not responsible or liable for any medical emergency.</b> If you or someone else may be having a medical emergency, call 911 or go to the nearest emergency room. For a mental health or suicide crisis, call or text 988. Always rely on emergency services, never on this website or its medication helper.</p>

    <h2>Not medical advice</h2>
    <p>PharmReach is not a pharmacy, doctor, or healthcare provider, and it does not sell medicine. Information on this site, including product suggestions, is general information about over-the-counter products and is not medical advice, diagnosis, or treatment. It does not consider your health history, allergies, or other medicines. Read the product label and ask a pharmacist or doctor if you are unsure whether a product is right for you.</p>

    <h2>Medication helper</h2>
    <p>The medication helper uses Google Gemini, an AI model, to match a description of a common symptom to products in our catalog. AI can be wrong or miss important context. Its suggestions come from a fixed list of over-the-counter products and are not a recommendation for you. The helper screens for some emergency and pharmacist-only topics, but it will not catch everything.</p>

    <h2>Proof of concept, local area only</h2>
    <p>PharmReach is mostly a proof of concept built at HackRU 2026. It covers a limited number of CVS and Walgreens locations in Hoboken and nearby Hudson County, New Jersey only, and a limited list of products. It is not a complete or authoritative directory of pharmacies, products, or prices.</p>

    <h2>Where the data comes from</h2>
    <p>Prices, stock, store details, and hours were obtained through automated collection (web scraping) and manual collection from the public websites of local Hoboken-area pharmacies. They are point-in-time snapshots, may be out of date or incorrect, and online prices can differ from in-store prices. Confirm price and availability with the pharmacy before you travel.</p>

    <h2>Travel times and costs</h2>
    <p>Routes, travel times, and fares are estimates from OpenTripPlanner, NJ TRANSIT schedule data, and OpenStreetMap. They can differ from real conditions, service changes, delays, and actual fares. Check current directions before you travel.</p>

    <h2>No affiliation</h2>
    <p>PharmReach is an independent student project. It is not affiliated with, endorsed by, or sponsored by CVS Health, Walgreens, NJ TRANSIT, Google, or any product manufacturer. Store names, product names, and brands are trademarks of their respective owners and are used only to identify them.</p>

    <h2>No warranty</h2>
    <p>PharmReach is provided “as is” and “as available”, without warranties of any kind, express or implied, including accuracy, availability, or fitness for a particular purpose. To the fullest extent permitted by law, the PharmReach team is not liable for any loss, injury, or damage arising from use of, or reliance on, this website or its information. Links to other websites are provided for convenience; we are not responsible for their content.</p>

    <h2>Contact</h2>
    <p>Questions or corrections: <a href="mailto:d9hhhh@gmail.com">d9hhhh@gmail.com</a>. Do not include medical information. See also the <a href="/privacy">privacy notice</a> and <a href="/about">about page</a>.</p>
  </main></AppShell>;
}
