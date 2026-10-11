import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bike, BusFront, CarFront, Check, ChevronDown, Footprints, MapPin, Pill, Loader2, Search, SlidersHorizontal, Sparkles, Stethoscope, Wind } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { LocationsMap } from './components/LocationsMap';
import { PreviewSkeleton } from './components/LoadingSkeleton';
import { api, searchEntry } from './core';
import './landing.css';

const previewProducts = [
  { id: 'cvs-ibuprofen-200-100', label: 'Ibuprofen' },
  { id: 'cvs-pepto-original-12oz', label: 'Pepto-Bismol' },
  { id: 'cvs-low-dose-aspirin-81-300', label: 'Aspirin' },
];
type PreviewData = {
  medication: { id: string; name: string; strength: string; quantity_label?: string };
  pharmacies: { id: string; name: string; merchant: string; address: string; price: number; stock: string }[];
};
const waysThere = [{ label: 'Walk', Icon: Footprints }, { label: 'Cycle', Icon: Bike }, { label: 'Drive', Icon: CarFront }, { label: 'Take transit', Icon: BusFront }];
const categories = [
  { name: 'Pain relief', example: 'Ibuprofen, aspirin & more', Icon: Pill },
  { name: 'Allergy relief', example: 'Cetirizine, loratadine & more', Icon: Wind },
  { name: 'Stomach relief', example: 'Pepto-Bismol, TUMS & more', Icon: Stethoscope },
  { name: 'Cold & cough', example: 'Cough relief, nasal sprays & more', Icon: Sparkles },
];

function PharmacyPreview() {
  const [selected, setSelected] = useState(previewProducts[0].id);
  const [data, setData] = useState<PreviewData | null>(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    setStatus('loading');
    api<PreviewData>(`/api/pharmacies?medication=${encodeURIComponent(selected)}&mode=walk&sort=Medication+cost`)
      .then((response) => { if (active) { setData(response); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [selected]);
  const displayedProduct = data?.medication.id || selected;
  const stocked = data?.pharmacies.filter((item) => item.stock === 'In stock') || [];
  const offers: PreviewData['pharmacies'] = [];
  for (const merchant of ['CVS', 'Walgreens']) {
    const offer = stocked.find((item) => item.merchant === merchant);
    if (offer) offers.push(offer);
  }
  for (const offer of stocked) {
    if (offers.length >= 3) break;
    if (!offers.some((item) => item.id === offer.id)) offers.push(offer);
  }
  return <div className="landing-preview-card">
      <div className="landing-preview-top"><span className="landing-preview-symbol"><Pill size={23} /></span><div><span>YOUR MEDICINE, NEARBY</span><h2>See your options.</h2></div><ArrowUpRight size={21} aria-hidden="true" /></div>
      <div className="landing-preview-tabs" role="group" aria-label="Choose a product preview">{previewProducts.map((product) => <button key={product.id} className={selected === product.id ? 'selected' : ''} aria-pressed={selected === product.id} onClick={() => setSelected(product.id)}>{product.label}</button>)}</div>
      <div className="landing-preview-body" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' && !data ? <PreviewSkeleton /> : status !== 'error' && data ? <>
          <div className="landing-preview-product"><h3>{data.medication.name}{status === 'loading' && <Loader2 size={14} className="preview-loading-icon" role="status" aria-label="Updating product options" />}</h3><p>{[data.medication.strength, data.medication.quantity_label].filter(Boolean).join(' · ')}</p></div>
          <div className="landing-preview-offers">{offers.map((offer) => <a href={`/results?medication=${encodeURIComponent(displayedProduct)}`} key={offer.id} className="landing-preview-offer"><span className="landing-store-pin"><MapPin size={18} /></span><div><strong>{offer.merchant}</strong><span>{offer.address.split(' · ')[0]}</span><small><Check size={11} aria-hidden="true" />In stock</small></div><b>${offer.price.toFixed(2)}<small>online</small></b></a>)}</div>
          {!offers.length && <p className="landing-preview-empty">Explore this product’s nearby store options.</p>}
        </> : <div className="landing-preview-empty"><Pill size={28} /><p>Explore nearby pharmacies and products.</p></div>}
      </div>
      <a className="landing-preview-link" href={`/results?medication=${encodeURIComponent(displayedProduct)}`}>Compare this product <ArrowRight size={17} /></a>
  </div>;
}

export function HomePage() {
  const entry = searchEntry();
  return <AppShell landing><main id="homeScreen" className="screen active landing-page">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <span className="landing-kicker">Over-the-counter. Around the corner.</span>
        <h1 id="landing-title">Find your medicine.<br /><em>Make fewer stops.</em></h1>
        <p className="landing-lead">Know where to go before you go. Compare nearby pharmacy prices, availability, and the best way to get there.</p>
        <div className="landing-actions"><a className="primary landing-primary-cta" href={entry.href}>{entry.label} <ArrowRight size={19} /></a><a className="landing-secondary-cta" href="#how-it-works">See how it works</a></div>
        <p className="landing-start-note">{entry.label === 'Try it out' ? 'Set your travel preferences, then find your medicine.' : 'Your travel preferences are saved. Start your next search.'}</p>
      </div>
      <PharmacyPreview />
    </section>
    <section id="how-it-works" className="landing-how" aria-labelledby="landing-how-title"><div className="landing-section-heading"><span className="landing-kicker">From your search to your next stop</span><h2 id="landing-how-title">A little less running around.</h2><p>The information you need, before heading out the door.</p></div><div className="landing-steps">
      <article><span className="landing-step-number">01 <Search size={22} /></span><h3>Search a name you know.</h3><p>Type a medicine, ingredient, or familiar brand. Ibuprofen or Advil. Pepto-Bismol or TUMS.</p></article>
      <article><span className="landing-step-number">02 <Pill size={22} /></span><h3>Compare nearby options.</h3><p>See which stores carry your product, what it costs online, and where each pharmacy is.</p></article>
      <article><span className="landing-step-number">03 <MapPin size={22} /></span><h3>Choose your next stop.</h3><p>Find a trip that fits your day. Open the directions in Maps and get on your way.</p></article>
    </div></section>
    <section className="landing-travel" aria-labelledby="landing-travel-title"><div className="landing-travel-copy"><span className="landing-kicker">Your medicine. Your way there.</span><h2 id="landing-travel-title">Different ways there.<br />One place to compare.</h2><p>Going on foot? Taking the bus? Set your walking limit and choose the ways you travel. Then compare trip time, arrival time, and total cost together.</p><a href="/settings">Choose your travel preferences <ArrowUpRight size={18} /></a></div><div className="landing-travel-panel"><span className="landing-travel-panel-label"><SlidersHorizontal size={16} />Make the trip work for you</span><div>{waysThere.map(({ label, Icon }) => <span className="landing-travel-method" key={label}><Icon size={27} /><b>{label}</b></span>)}</div><p>Walking limits include the walk to and from transit stops.</p></div></section>
    <section className="landing-browse" aria-labelledby="landing-browse-title"><div className="landing-browse-heading"><div><span className="landing-kicker">Everyday essentials, nearby</span><h2 id="landing-browse-title">Start with what you need.</h2></div><a href="/products">Browse all products <ArrowUpRight size={17} /></a></div><div className="landing-category-grid">{categories.map(({ name, example, Icon }) => <a key={name} href={`/products?category=${encodeURIComponent(name)}`}><span className="landing-category-icon"><Icon size={24} /></span><h3>{name}</h3><p>{example}</p><ArrowUpRight size={19} aria-hidden="true" /></a>)}</div></section>
    <section className="landing-faq" aria-labelledby="landing-faq-title"><div><span className="landing-kicker">A few things to know</span><h2 id="landing-faq-title">Before your next stop.</h2></div><div className="landing-faq-items"><details><summary>What can I find on PharmReach?<ChevronDown size={18} /></summary><p>Over-the-counter medicines and everyday pharmacy products, searchable by common name, ingredient, or brand. Browse the product list to see what’s available.</p></details><details><summary>Where does PharmReach work?<ChevronDown size={18} /></summary><p>We’re starting with CVS and Walgreens locations around Hoboken, Jersey City, and Union City in New Jersey. Store coverage depends on the product you choose.</p></details><details><summary>Can I compare more than the price?<ChevronDown size={18} /></summary><p>Yes. Compare walking, cycling, driving, and transit by travel time, arrival time, and total cost. Your saved preferences determine which travel options you see.</p></details></div></section>
    <section className="landing-final-cta"><div><span className="landing-kicker">A better next stop</span><h2>Your medicine is out there.<br />Let’s find your way to it.</h2></div><a href={entry.href}>{entry.label} <ArrowRight size={20} /></a></section>
    <LocationsMap />
  </main></AppShell>;
}
