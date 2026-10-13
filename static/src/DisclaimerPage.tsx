import { href } from './base';
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
    <p><b>The medication helper on this site is not AI.</b> It is a simple algorithm that looks for keywords, like “headache” or “heartburn”, in what you type and points to matching products from a fixed list of over-the-counter products. It does not understand context, negation, or your health history, and it can miss or misread what you type. Its suggestions are not a recommendation for you. The helper screens for some emergency and pharmacist-only words, but it will not catch everything.</p>

    <h2>Proof of concept, local area only</h2>
    <p>PharmReach is mostly a proof of concept built at HackRU 2026. This is a static copy of the site that runs entirely in your browser. It covers a limited number of CVS and Walgreens locations in Hoboken and nearby Hudson County, New Jersey only, and a limited list of products. It is not a complete or authoritative directory of pharmacies, products, or prices.</p>

    <h2>Where the data comes from</h2>
    <p>Prices, stock, store details, and hours were obtained through automated collection (web scraping) and manual collection from the public websites of local Hoboken-area pharmacies. They are point-in-time snapshots, may be out of date or incorrect, and online prices can differ from in-store prices. Confirm price and availability with the pharmacy before you travel.</p>

    <h2>Data is not real-time</h2>
    <p><b>Pharmacy and transit data was last updated October 8, 2026.</b> PharmReach does not pull real-time data, so prices, stock, store hours, and transit schedules may be out of date. Check with the pharmacy and the transit agency before you go.</p>

    <h2>Travel times and costs</h2>
    <p>On this version of the site, walking, cycling, and driving times are rough estimates calculated from straight-line distance, not live routes, and transit trips are not planned. Real travel times and costs will differ. Use the Google Maps link for current directions before you travel.</p>

    <h2>No affiliation</h2>
    <p>PharmReach is an independent student project. It is not affiliated with, endorsed by, or sponsored by CVS Health, Walgreens, NJ TRANSIT, Google, or any product manufacturer. Store names, product names, and brands are trademarks of their respective owners and are used only to identify them.</p>

    <h2>No warranty</h2>
    <p>PharmReach is provided “as is” and “as available”, without warranties of any kind, express or implied, including accuracy, availability, or fitness for a particular purpose. To the fullest extent permitted by law, the PharmReach team is not liable for any loss, injury, or damage arising from use of, or reliance on, this website or its information. Links to other websites are provided for convenience; we are not responsible for their content.</p>

    <h2>Contact</h2>
    <p>Questions or corrections: <a href="mailto:d9hhhh@gmail.com">d9hhhh@gmail.com</a>. Do not include medical information. See also the <a href={href('/privacy')}>privacy notice</a> and <a href={href('/about')}>about page</a>.</p>
  </main></AppShell>;
}
