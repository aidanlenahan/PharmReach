// Google Places (New) address suggestions for the starting-location field.
// Routing only understands "lat, long", so a chosen place is resolved to its coordinates.

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Bias toward the covered area (Hoboken / Jersey City / Union City).
const coverageBias = { center: { lat: 40.7440, lng: -74.0324 }, radius: 15000 };

type LatLng = { lat(): number; lng(): number };
type Place = { formattedAddress?: string; location?: LatLng; fetchFields(options: { fields: string[] }): Promise<unknown> };
type FormattableText = { text: string };
type PlacePrediction = { placeId: string; text: FormattableText; mainText?: FormattableText; secondaryText?: FormattableText; toPlace(): Place };
type SessionToken = object;
type PlacesLibrary = {
  AutocompleteSessionToken: new () => SessionToken;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: Record<string, unknown>): Promise<{ suggestions: { placePrediction: PlacePrediction | null }[] }>;
  };
};
type MapsGlobal = { maps: { importLibrary(name: 'places'): Promise<PlacesLibrary> } };

export type AddressSuggestion = { id: string; main: string; secondary: string; prediction: PlacePrediction };
export type ResolvedAddress = { address: string; latitude: number; longitude: number };

let libraryPromise: Promise<PlacesLibrary> | null = null;
let sessionToken: SessionToken | null = null;

export const placesEnabled = Boolean(apiKey);

function loadPlaces(): Promise<PlacesLibrary> {
  if (!apiKey) return Promise.reject(new Error('Google Maps API key is not configured.'));
  libraryPromise ??= new Promise<PlacesLibrary>((resolve, reject) => {
    const callback = '__pharmreachMapsReady';
    (window as unknown as Record<string, unknown>)[callback] = () => {
      const google = (window as unknown as { google: MapsGlobal }).google;
      google.maps.importLibrary('places').then(resolve, reject);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callback}`;
    script.async = true;
    script.onerror = () => { libraryPromise = null; reject(new Error('Could not load Google Maps.')); };
    document.head.appendChild(script);
  });
  return libraryPromise;
}

export async function suggestAddresses(input: string): Promise<AddressSuggestion[]> {
  const places = await loadPlaces();
  // One token spans the keystrokes and the final details lookup so Google bills them as one session.
  sessionToken ??= new places.AutocompleteSessionToken();
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    locationBias: coverageBias,
    includedRegionCodes: ['us'],
  });
  return suggestions.flatMap(({ placePrediction: prediction }) => prediction ? [{
    id: prediction.placeId,
    main: prediction.mainText?.text ?? prediction.text.text,
    secondary: prediction.secondaryText?.text ?? '',
    prediction,
  }] : []);
}

export async function resolveAddress(suggestion: AddressSuggestion): Promise<ResolvedAddress> {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ['formattedAddress', 'location'] });
  sessionToken = null;
  if (!place.location) throw new Error('Google returned no coordinates for this place.');
  return {
    address: (place.formattedAddress ?? suggestion.prediction.text.text).replace(/, USA$/, ''),
    latitude: Number(place.location.lat().toFixed(6)),
    longitude: Number(place.location.lng().toFixed(6)),
  };
}
