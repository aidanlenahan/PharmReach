import { ArrowUpRight, GitFork } from 'lucide-react';
import { AppShell } from './components/AppShell';
import './privacy.css';

const REPO_URL = 'https://github.com/aidanlenahan/PharmReach';

export function AboutPage() {
  return <AppShell><main className="privacy-page about-page">
    <h1>About PharmReach</h1>
    <p className="privacy-date">Built in 24 hours at HackRU 2026, Rutgers University · <a href="https://devpost.com/software/pharmreach" target="_blank" rel="noopener noreferrer">Devpost ↗</a></p>

    <p>PharmReach lets you search for an over-the-counter medicine and see nearby pharmacies that carry it, with the price, the store’s location, and how long it takes to get there by walking, cycling, driving, or public transit. It adds up the cost of the trip and the medicine so you can pick the stop that works best for you.</p>

    <h2>Inspiration</h2>
    <p>Aidan moved to Hoboken as a student at Stevens Institute of Technology and picks up a prescription every month. In an unfamiliar area and without a car, coordinating a monthly pharmacy trip, plus the other products that come with it, was harder than it should be. A tool like PharmReach makes that much easier.</p>

    <h2>How we built it</h2>
    <p>We started by researching pharmacy deserts: areas with too few pharmacies for the people who live there, which makes it hard for people without cars or with low incomes to get medication. Parts of New Jersey qualify because of the mismatch between population and pharmacy locations.</p>
    <p>CVS and Walgreens don’t offer public APIs for stock and prices, so we built our own dataset from their public websites for local Hoboken-area stores, then combined it with maps and transit data.</p>
    <p><b>Built with:</b> Google Gemini, OpenStreetMap, OpenTripPlanner, Python, and React.</p>

    <h2>What’s next</h2>
    <p>Right now PharmReach covers a small number of pharmacies and products around Hoboken and Hudson County, NJ. Expanding the dataset to more stores and products is the next step. See the <a href="/disclaimer">disclaimer</a> for the current limits.</p>

    <h2>Team</h2>
    <p>Aidan Lenahan, Brandon, and Nate Bracken. See the project on <a href="https://devpost.com/software/pharmreach" target="_blank" rel="noopener noreferrer">Devpost</a>.</p>

    <h2>Open source</h2>
    <p>PharmReach is open source under the MIT License. You’re welcome to read the code, fork it, and build on it.</p>
    <div className="about-actions">
      <a className="primary" href={REPO_URL} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={16} aria-hidden="true" /></a>
      <a className="about-fork" href={`${REPO_URL}/fork`} target="_blank" rel="noopener noreferrer"><GitFork size={16} aria-hidden="true" /> Fork on GitHub</a>
    </div>
  </main></AppShell>;
}
