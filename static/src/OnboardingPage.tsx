import { useEffect, useRef, useState, type FormEvent } from 'react';
import { href } from './base';
import { AppShell } from './components/AppShell';
import { defaultPreferences, getPreferences, mpgFromInput, savePreferences, validMpg, transitTypes, toast, type TravelPreferences, type TransitType } from './core';

const yesNo = [['true', 'Yes', 'Include this way of getting to a pharmacy.'], ['false', 'No', 'Prioritize other ways to get there.']];
const limitChoices = [['none', 'No limit', 'Show all walking distances.'], ['time', 'Set a time limit', 'Maximum total walking time per trip.'], ['distance', 'Set a distance limit', 'Maximum total walking distance per trip.']];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<TravelPreferences>(() => ({ ...defaultPreferences, ...(getPreferences() || {}), transitTypes: [...(getPreferences()?.transitTypes || defaultPreferences.transitTypes)] }));
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = 'setupStepHeading';

  function selectBoolean(key: 'drive' | 'bike' | 'transit', value: string) { setPreferences((current) => ({ ...current, [key]: value === 'true' })); }
  function chooseWalkLimit(value: TravelPreferences['walkLimit']) { setPreferences((current) => ({ ...current, walkLimit: value })); }
  function capture(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (step === 0 && preferences.drive === null || step === 2 && preferences.bike === null || step === 3 && preferences.transit === null) { setError('Please select an option to continue.'); return; }
    if (step === 0 && preferences.drive && !validMpg(preferences.mpg)) { setError('Enter gas mileage between 1 and 200 MPG, or leave it blank.'); return; }
    if (step === 1 && preferences.walkLimit !== 'none' && (!Number.isFinite(preferences.walkValue) || preferences.walkValue < 0)) { setError('Enter a walking limit of 0 or more.'); return; }
    if (step === 3 && preferences.transit && !preferences.transitTypes.length) { setError('Choose at least one transit type.'); return; }
    if (step < 4) { setStep(step + 1); return; }
    try { savePreferences(preferences); }
    catch { setError('Your browser could not save preferences. Allow site storage and try again.'); return; }
    toast('Travel preferences saved.');
    // `next` is a site-relative path ("/results?medication=..."); only known pages are followed.
    const next = new URLSearchParams(location.search).get('next') || '/find-medicine';
    let target: URL | null = null;
    try { target = new URL(next, 'https://pharmreach.invalid'); } catch { /* fall back below */ }
    const allowed = target && target.origin === 'https://pharmreach.invalid' && ['/', '/find-medicine', '/results', '/settings'].includes(target.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, ''));
    location.href = href(allowed && target ? target.pathname + target.search : '/find-medicine');
  }
  function back() { setError(''); setStep(Math.max(0, step - 1)); }
  const typeNames = (preferences.transitTypes as TransitType[]).map((type) => transitTypes[type]).join(', ');
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  return <AppShell onboarding><main className="onboarding"><div className="settings-card">
    <div className="eyebrow">Your way there</div><div className="setup-progress" aria-label={`Setup progress, step ${step + 1} of 5`}><div style={{ width: `${(step + 1) * 20}%` }} /></div><p className="setup-count">Step {step + 1} of 5</p>
    <form onSubmit={capture}>
      <section aria-live="polite" aria-labelledby={headingId}>
        {step === 0 && <><h1 ref={headingRef} id={headingId} tabIndex={-1}>Are you able to drive?</h1><p className="settings-intro">Let’s find options that fit your day. This takes about a minute.</p><div className="setup-choices">{yesNo.map(([value, title, detail]) => <label className="setup-choice" key={value}><input type="radio" name="drive" value={value} checked={preferences.drive === (value === 'true')} onChange={() => selectBoolean('drive', value)} /><span><b>{title}</b><small>{detail}</small></span></label>)}</div>{preferences.drive && <div className="walk-amount"><label htmlFor="mpgValue">Gas mileage (MPG)</label><input id="mpgValue" type="number" min="1" max="200" step="any" inputMode="decimal" placeholder="Optional" value={preferences.mpg == null || Number.isNaN(preferences.mpg) ? '' : preferences.mpg} onChange={(event) => setPreferences((current) => ({ ...current, mpg: mpgFromInput(event.target.value) }))} /><small>Used to estimate gas cost per trip. Leave blank for a typical car.</small></div>}</>}
        {step === 1 && <><h1 ref={headingRef} id={headingId} tabIndex={-1}>How far can you walk?</h1><p className="settings-intro">This also applies to walking to and from public transit.</p><div className="setup-choices">{limitChoices.map(([value, title, detail]) => <label className="setup-choice" key={value}><input type="radio" name="walkLimit" value={value} checked={preferences.walkLimit === value} onChange={() => chooseWalkLimit(value as TravelPreferences['walkLimit'])} /><span><b>{title}</b><small>{detail}</small></span></label>)}</div>{preferences.walkLimit !== 'none' && <div className="walk-amount"><label htmlFor="walkValue">Maximum {preferences.walkLimit === 'time' ? 'minutes' : 'miles'}</label><input id="walkValue" type="number" min="0" max="10000" step="any" inputMode="decimal" value={Number.isNaN(preferences.walkValue) ? '' : preferences.walkValue} onChange={(event) => setPreferences((current) => ({ ...current, walkValue: event.target.value === '' ? Number.NaN : Number(event.target.value) }))} /><small>Enter 0 if you cannot walk.</small></div>}</>}
        {step === 2 && <><h1 ref={headingRef} id={headingId} tabIndex={-1}>Are you able to bike?</h1><p className="settings-intro">Include cycling routes when you have a bike available.</p><div className="setup-choices">{yesNo.map(([value, title, detail]) => <label className="setup-choice" key={value}><input type="radio" name="bike" value={value} checked={preferences.bike === (value === 'true')} onChange={() => selectBoolean('bike', value)} /><span><b>{title}</b><small>{detail}</small></span></label>)}</div></>}
        {step === 3 && <><h1 ref={headingRef} id={headingId} tabIndex={-1}>Is public transit okay?</h1><p className="settings-intro">Choose the types of transit you’re willing to use.</p><div className="setup-choices">{yesNo.map(([value, title, detail]) => <label className="setup-choice" key={value}><input type="radio" name="transit" value={value} checked={preferences.transit === (value === 'true')} onChange={() => selectBoolean('transit', value)} /><span><b>{title}</b><small>{detail}</small></span></label>)}</div>{preferences.transit && <fieldset className="transit-types"><legend>Transit types</legend>{(Object.entries(transitTypes) as [TransitType, string][]).map(([value, title]) => <label key={value}><input type="checkbox" checked={preferences.transitTypes.includes(value)} onChange={(event) => setPreferences((current) => ({ ...current, transitTypes: event.target.checked ? [...current.transitTypes, value] : current.transitTypes.filter((type) => type !== value) }))} /> {title}</label>)}</fieldset>}</>}
        {step === 4 && <><h1 ref={headingRef} id={headingId} tabIndex={-1}>You’re ready to go.</h1><p className="settings-intro">Here’s how we’ll personalize your comparisons.</p><div className="setup-review"><div><span>Driving</span><b>{preferences.drive ? preferences.mpg ? `Allowed · ${preferences.mpg} MPG` : 'Allowed' : 'Off'}</b></div><div><span>Walking</span><b>{preferences.walkLimit === 'none' ? 'No limit' : `${preferences.walkValue} ${preferences.walkLimit === 'time' ? 'minutes' : 'miles'} maximum`}</b></div><div><span>Cycling</span><b>{preferences.bike ? 'Allowed' : 'Off'}</b></div><div><span>Public transit</span><b>{preferences.transit ? typeNames || 'No types selected' : 'Off'}</b></div></div><p className="settings-intro">Your results will show the travel methods allowed by these preferences.</p></>}
      </section>
      {error && <p role="alert" className="status-message">{error}</p>}
      <div className="settings-actions"><button className="text-btn" type="button" onClick={back} hidden={step === 0}>← Back</button><button className="primary" type="submit">{step === 4 ? 'Find my medication →' : 'Continue →'}</button></div>
    </form>
  </div><p className="setup-footnote">You can revisit these choices in Settings any time.</p></main></AppShell>;
}
