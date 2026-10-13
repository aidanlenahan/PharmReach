import { href } from './base';
import { useState, type FormEvent } from 'react';
import { AppShell } from './components/AppShell';
import { defaultPreferences, getDefaultSort, mpgFromInput, validMpg, getPreferences, saveDefaultSort, savePreferences, sortOptions, summary, toast, transitTypes, type SortOption, type TravelPreferences, type TransitType } from './core';

const defaultTravel: TravelPreferences = { ...defaultPreferences, drive: true, bike: true, transit: true };
const defaultSortOptions = sortOptions.slice(0, 6) as SortOption[];

export function SettingsPage() {
  const [preferences, setPreferences] = useState<TravelPreferences>(() => getPreferences() || defaultTravel);
  const [sort, setSort] = useState<SortOption>(getDefaultSort());
  const [error, setError] = useState('');

  function update(patch: Partial<TravelPreferences>) { setPreferences((current) => ({ ...current, ...patch })); }
  function saveTravel(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (preferences.transit && !preferences.transitTypes.length) { setError('Choose at least one transit type.'); return; }
    if (preferences.walkLimit !== 'none' && (!Number.isFinite(preferences.walkValue) || preferences.walkValue < 0)) { setError('Enter a walking limit of 0 or more.'); return; }
    if (preferences.drive && !validMpg(preferences.mpg)) { setError('Enter gas mileage between 1 and 200 MPG, or leave it blank.'); return; }
    try { savePreferences(preferences); toast('Travel preferences saved.'); }
    catch { setError('Your browser could not save preferences. Allow site storage and try again.'); }
  }
  function saveSort() { saveDefaultSort(sort); toast('Default sort saved for your next search.'); }
  const explanation = ({
    'Best match': 'Balance medication cost and getting there',
    'Soonest arrival': 'Arrive as soon as possible, including departure wait',
    'Travel time': 'Compare trip duration, excluding departure wait',
    'Medication cost': 'Lowest medication price first',
    'Travel cost': 'Compare fare or driving cost',
    'Total cost': 'Medication plus travel cost',
  } as Record<string, string>)[sort] || (sort === 'Pharmacy' ? 'Alphabetical by pharmacy name' : sort === 'Availability' ? 'In-stock options first' : '');

  return <AppShell active="settings"><main id="settingsScreen" className="screen active"><section className="settings">
    <div className="settings-card">
      <div className="eyebrow">Personalize your results</div><h1>Settings</h1><p className="settings-intro">Choose how you travel and how new searches are sorted.</p>
      <div className="setting-section"><h2>Travel preferences</h2><p>{summary(preferences)}</p>
        <form className="travel-form" onSubmit={saveTravel}>
          <div className="travel-toggles">
            <label><input type="checkbox" checked={!!preferences.drive} onChange={(event) => update({ drive: event.target.checked })} /> Driving</label>
            <label><input type="checkbox" checked={!!preferences.bike} onChange={(event) => update({ bike: event.target.checked })} /> Cycling</label>
            <label><input type="checkbox" checked={!!preferences.transit} onChange={(event) => update({ transit: event.target.checked })} /> Public transit</label>
          </div>
          {preferences.drive && <div className="walking-setting"><label htmlFor="editMpg">Gas mileage</label><label>Your car gets <input id="editMpg" type="number" min="1" max="200" step="any" inputMode="decimal" placeholder="Optional" value={preferences.mpg == null || Number.isNaN(preferences.mpg) ? '' : preferences.mpg} onChange={(event) => update({ mpg: mpgFromInput(event.target.value) })} /> MPG</label></div>}
          <fieldset className="transit-types" hidden={!preferences.transit}><legend>Allowed transit types</legend>
            {(Object.entries(transitTypes) as [TransitType, string][]).map(([value, label]) => <label key={value}><input type="checkbox" checked={preferences.transitTypes.includes(value)} onChange={(event) => update({ transitTypes: event.target.checked ? [...preferences.transitTypes, value] : preferences.transitTypes.filter((type) => type !== value) })} /> {label}</label>)}
          </fieldset>
          <div className="walking-setting"><label htmlFor="editWalkLimit">Walking limit</label>
            <select id="editWalkLimit" value={preferences.walkLimit} onChange={(event) => update({ walkLimit: event.target.value as TravelPreferences['walkLimit'] })}>
              <option value="none">No limit</option><option value="time">Time in minutes</option><option value="distance">Distance in miles</option>
            </select>
            {preferences.walkLimit !== 'none' && <label id="editWalkAmount">Maximum <input id="editWalkValue" type="number" min="0" max="10000" step="any" inputMode="decimal" value={Number.isNaN(preferences.walkValue) ? '' : preferences.walkValue} onChange={(event) => update({ walkValue: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /> {preferences.walkLimit === 'time' ? 'minutes' : 'miles'}</label>}
          </div>
          <p className="settings-hint">The walking limit includes getting to and from transit stops. Enter 0 if you cannot walk.</p>
          {error && <p className="status-message" role="alert">{error}</p>}
          <div className="travel-actions">
            <button type="submit" className="primary">Save travel preferences</button>
            <a className="travel-reset" href={href('/onboarding?next=%2Fsettings')}>Reset travel setup</a>
          </div>
        </form>
      </div>
      <div className="setting-section"><h2>Default sort</h2><p>This is the starting sort each time you run a new search. Changing sort on the results page only applies to that search.</p>
        <div className="sort-card"><div><b>Sort new searches by</b><small>{explanation}</small></div><select aria-label="Default sort" value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>{defaultSortOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
      </div>
      <div className="settings-actions"><a className="text-btn" href={href('/find-medicine')}>Back to search</a><button className="primary" onClick={saveSort}>Save default</button></div>
    </div>
  </section></main></AppShell>;
}
