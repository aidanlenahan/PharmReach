import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { LocationPanel } from './components/LocationPanel';
import { HomeSearch } from './HomeSearch';
import { getOriginLabel } from './core';
import './find-medicine.css';

export function FindMedicinePage() {
  const [origin, setOrigin] = useState(getOriginLabel());
  return <AppShell active="home"><main className="find-medicine-page">
    <section className="find-medicine-intro">
      <span className="eyebrow"><Search size={16} /> Find medicine</span>
      <h1>What are you looking for?</h1>
      <p>Search a medicine, ingredient, or brand to compare nearby prices, availability, and the trip.</p>
      <HomeSearch inputId="find-medication" />
      <p className="find-helper-note">Unsure of the product name? Open the Medication helper to describe a common symptom.</p>
    </section>
    <section className="find-location" aria-labelledby="find-location-title">
      <h2 id="find-location-title"><MapPin size={19} /> Your starting point</h2>
      <p>{origin ? `Starting from ${origin}` : 'Choose where you’re starting to compare travel times and routes.'}</p>
      <LocationPanel embedded onChange={() => setOrigin(getOriginLabel())} />
    </section>
    <p className="find-snapshot-note">Prices and availability are snapshots. Confirm with the pharmacy before traveling.</p>
  </main></AppShell>;
}
