/**
 * Maps service tests - distance, geocode, reverse, autocomplete, placeDetails,
 * directions. Verifies parsing of Google Maps responses and error translation
 * to AppError shapes the controllers expect.
 *
 * Run with: node --test tests/maps-service.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

// Hand-rolled axios stub. Each test queues the next response (or error) on
// `nextResponses` - first request shifts the front of the queue, so the test
// can express "first call returns A, second call returns B".
const nextResponses = [];
let lastRequest = null;
const requests = []; // every call this test made, for assertions on parallel calls
stubModule(require.resolve('axios'), {
  get: async (url, opts) => {
    lastRequest = { url, params: opts?.params };
    requests.push(lastRequest);
    if (nextResponses.length === 0) {
      throw new Error('no axios response queued for this test');
    }
    const next = nextResponses.shift();
    if (next instanceof Error) throw next;
    return next;
  },
});

// Find the request whose URL contains `fragment` (e.g. 'autocomplete', 'geocode').
const requestTo = (fragment) => requests.find((r) => r.url.includes(fragment));

stubModule(path.resolve(__dirname, '../src/config/index.js'), {
  config: { GOOGLE_MAPS_API_KEY: 'test-key' },
});
stubModule(path.resolve(__dirname, '../src/utils/logger.js'), {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
});

const mapsService = require('../src/services/maps.service');

const queueResp = (data) => nextResponses.push({ data });

const resetState = () => {
  nextResponses.length = 0;
  lastRequest = null;
  requests.length = 0;
};

// --- getDistance ---

test('getDistance: parses metric distance + duration from Distance Matrix response', async () => {
  resetState();
  queueResp({
    rows: [{
      elements: [{
        status: 'OK',
        distance: { value: 5300, text: '5.3 km' },
        duration: { value: 720, text: '12 mins' },
      }],
    }],
  });

  const out = await mapsService.getDistance(13.0, 7.6, 13.05, 7.65);
  assert.equal(out.distanceMeters, 5300);
  assert.equal(out.distanceKm, 5.3);
  assert.equal(out.durationSeconds, 720);
  assert.equal(lastRequest.params.origins, '13,7.6');
  assert.equal(lastRequest.params.destinations, '13.05,7.65');
  assert.equal(lastRequest.params.units, 'metric');
});

test('getDistance: throws AppError.internal when Google returns non-OK element', async () => {
  resetState();
  queueResp({ rows: [{ elements: [{ status: 'NOT_FOUND' }] }] });
  await assert.rejects(
    () => mapsService.getDistance(13.0, 7.6, 13.05, 7.65),
    (err) => err.statusCode === 500,
  );
});

test('getDistance: throws AppError.internal on axios failure', async () => {
  resetState();
  nextResponses.push(new Error('network down'));
  await assert.rejects(
    () => mapsService.getDistance(13.0, 7.6, 13.05, 7.65),
    (err) => err.statusCode === 500,
  );
});

// --- geocodeAddress ---

test('geocodeAddress: returns lat/lng + placeId for a valid address', async () => {
  resetState();
  queueResp({
    results: [{
      geometry: { location: { lat: 13.0059, lng: 7.6019 } },
      formatted_address: 'Katsina, Nigeria',
      place_id: 'ChIJxxx',
    }],
  });
  const out = await mapsService.geocodeAddress('Katsina');
  assert.equal(out.lat, 13.0059);
  assert.equal(out.lng, 7.6019);
  assert.equal(out.placeId, 'ChIJxxx');
  assert.equal(out.outOfArea, false, 'Katsina city is inside the operating polygon');
  // Geo-restriction (Katsina) scopes geocoding to the state via components.
  assert.equal(
    lastRequest.params.components,
    'country:NG|administrative_area:Katsina',
    'must scope to Katsina State',
  );
});

test('geocodeAddress: AppError.badRequest when no results', async () => {
  resetState();
  queueResp({ results: [] });
  await assert.rejects(
    () => mapsService.geocodeAddress('does not exist'),
    (err) => err.statusCode === 400,
  );
});

// --- reverseGeocode ---

test('reverseGeocode: returns formatted address for valid coords', async () => {
  resetState();
  queueResp({
    results: [{ formatted_address: '1 Test Rd, Katsina', place_id: 'ChIJyyy' }],
  });
  const out = await mapsService.reverseGeocode(13.0, 7.6);
  assert.equal(out.formattedAddress, '1 Test Rd, Katsina');
  assert.equal(out.placeId, 'ChIJyyy');
  assert.equal(out.outOfArea, false, '13.0,7.6 is inside the operating polygon');
  assert.equal(lastRequest.params.latlng, '13,7.6');
});

test('reverseGeocode: flags a point outside the operating polygon', async () => {
  resetState();
  // Lagos - well outside Katsina State.
  queueResp({ results: [{ formatted_address: 'Lagos, Nigeria', place_id: 'ChIJlagos' }] });
  const out = await mapsService.reverseGeocode(6.5244, 3.3792);
  assert.equal(out.outOfArea, true, 'Lagos must be flagged out of area');
});

test('reverseGeocode: skips a bare plus-code result for a real address', async () => {
  resetState();
  // Google returns the plus-code grid ref first when there is no street
  // address, then progressively broader real results.
  queueResp({
    results: [
      { formatted_address: '2H6X+JF Katsina, Nigeria', place_id: 'plus', types: ['plus_code'] },
      { formatted_address: 'Tudun Yan Lihidda, Katsina', place_id: 'hood', types: ['neighborhood'] },
      { formatted_address: 'Katsina, Nigeria', place_id: 'city', types: ['locality'] },
    ],
  });
  const out = await mapsService.reverseGeocode(12.99, 7.6);
  assert.equal(out.formattedAddress, 'Tudun Yan Lihidda, Katsina', 'uses the neighbourhood, not the plus code');
  assert.equal(out.placeId, 'hood');
});

test('reverseGeocode: strips a plus-code prefix left on an otherwise-real address', async () => {
  resetState();
  queueResp({
    results: [
      { formatted_address: '2H6X+JF Tudun Yan Lihidda, Katsina', place_id: 'p', types: ['neighborhood'] },
    ],
  });
  const out = await mapsService.reverseGeocode(12.99, 7.6);
  assert.equal(out.formattedAddress, 'Tudun Yan Lihidda, Katsina', 'leading plus code removed');
});

test('reverseGeocode: falls back to a plus code only when it is all Google returns', async () => {
  resetState();
  queueResp({
    results: [
      { formatted_address: '2H6X+JF Katsina, Nigeria', place_id: 'plus', types: ['plus_code'] },
    ],
  });
  const out = await mapsService.reverseGeocode(12.99, 7.6);
  assert.equal(out.formattedAddress, 'Katsina, Nigeria', 'plus code stripped, remainder kept');
  assert.equal(out.placeId, 'plus');
});

test('reverseGeocode: AppError.badRequest when no results', async () => {
  resetState();
  queueResp({ results: [] });
  await assert.rejects(
    () => mapsService.reverseGeocode(0, 0),
    (err) => err.statusCode === 400,
  );
});

// --- autocomplete ---

test('autocomplete: keeps state-tagged predictions and biases the request', async () => {
  resetState();
  queueResp({
    status: 'OK',
    predictions: [
      {
        place_id: 'p1',
        description: 'Sani Street, Katsina',
        structured_formatting: { main_text: 'Sani Street', secondary_text: 'Katsina' },
        terms: [{ value: 'Sani Street' }, { value: 'Katsina' }],
      },
      {
        place_id: 'p2',
        description: 'Sani Abacha Road, Katsina',
        structured_formatting: { main_text: 'Sani Abacha Road', secondary_text: 'Katsina' },
        terms: [{ value: 'Sani Abacha Road' }, { value: 'Katsina' }],
      },
    ],
  });
  queueResp({ status: 'OK', results: [] }); // the parallel geocoding call (no extra matches)
  // Query chosen to NOT match the local index, so this isolates the Google merge.
  const out = await mapsService.autocomplete('qwerty', 'session-token-1');
  assert.equal(out.length, 2);
  assert.equal(out[0].placeId, 'p1');
  assert.equal(out[0].mainText, 'Sani Street');
  assert.equal(out[1].mainText, 'Sani Abacha Road');

  const ac = requestTo('autocomplete');
  assert.equal(ac.params.components, 'country:ng');
  // Autocomplete is BIASED to the area circle (not strict-bound).
  assert.equal(ac.params.location, '12.4,7.6');
  assert.equal(ac.params.radius, 150000);
  assert.equal(ac.params.strictbounds, undefined, 'must bias, not strict-bound');
  assert.equal(ac.params.types, undefined, 'combined types are invalid for legacy autocomplete');
  // The parallel geocoding call hard-scopes to the state.
  const gc = requestTo('geocode');
  assert.equal(gc.params.components, 'country:NG|administrative_area:Katsina');
});

test('autocomplete: drops other-state namesakes, keeps only the Katsina-tagged one', async () => {
  resetState();
  queueResp({
    status: 'OK',
    predictions: [
      {
        place_id: 'kt',
        description: 'Tudun Wada, Katsina, Nigeria',
        structured_formatting: { main_text: 'Tudun Wada', secondary_text: 'Katsina, Nigeria' },
        terms: [{ value: 'Tudun Wada' }, { value: 'Katsina' }, { value: 'Nigeria' }],
      },
      {
        place_id: 'kn',
        description: 'Tudun Wada, Kano, Nigeria',
        structured_formatting: { main_text: 'Tudun Wada', secondary_text: 'Kano, Nigeria' },
        terms: [{ value: 'Tudun Wada' }, { value: 'Kano' }, { value: 'Nigeria' }],
      },
      {
        // Street literally named "Katsina" but in Kaduna - not a term match, dropped.
        place_id: 'kd',
        description: 'Katsina Road, Kaduna, Nigeria',
        structured_formatting: { main_text: 'Katsina Road', secondary_text: 'Kaduna, Nigeria' },
        terms: [{ value: 'Katsina Road' }, { value: 'Kaduna' }, { value: 'Nigeria' }],
      },
    ],
  });
  queueResp({ status: 'OK', results: [] }); // geocoding adds nothing here
  const out = await mapsService.autocomplete('qwerty', 'tok'); // no local-index match
  assert.equal(out.length, 1, 'only the Katsina result survives');
  assert.equal(out[0].placeId, 'kt');
});

test('autocomplete: surfaces Katsina results from geocoding that autocomplete buried', async () => {
  resetState();
  // Autocomplete returns only out-of-state namesakes (Kano), all dropped.
  queueResp({
    status: 'OK',
    predictions: [
      {
        place_id: 'kn',
        description: 'Tudun Wada, Kano, Nigeria',
        structured_formatting: { main_text: 'Tudun Wada', secondary_text: 'Kano, Nigeria' },
        terms: [{ value: 'Tudun Wada' }, { value: 'Kano' }, { value: 'Nigeria' }],
      },
    ],
  });
  // Geocoding (state-scoped) returns the real Katsina matches + a bare-state row.
  queueResp({
    status: 'OK',
    results: [
      { place_id: 'g1', formatted_address: 'Tudun Wada 831101, Katsina, Nigeria', types: ['locality'] },
      { place_id: 'g2', formatted_address: 'Tudun Wada 832102, Katsina, Nigeria', types: ['locality'] },
      { place_id: 'gstate', formatted_address: 'Katsina, Nigeria', types: ['administrative_area_level_1', 'political'] },
    ],
  });
  const out = await mapsService.autocomplete('qwerty', 'tok2'); // no local-index match
  assert.equal(out.length, 2, 'two geocoding localities, bare-state fallback dropped');
  assert.deepEqual(out.map((o) => o.placeId), ['g1', 'g2']);
  assert.equal(out[0].mainText, 'Tudun Wada 831101');
  assert.equal(out[0].secondaryText, 'Katsina, Nigeria');
});

// --- local index ---

test('autocomplete: local index returns instant Katsina matches, ranked first', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] }); // Google autocomplete buries it
  queueResp({ status: 'OK', results: [] }); // geocoding adds nothing for the short prefix
  const out = await mapsService.autocomplete('tudun', 'tok');
  assert.ok(out.length > 0, 'local index yields suggestions for a short prefix');
  assert.ok(out[0].placeId.startsWith('local:'), 'local results rank first');
  assert.ok(/tudun/i.test(out[0].mainText), 'matches the typed prefix');
});

test('autocomplete: local index matches a name buried under descriptor words', async () => {
  resetState();
  // The dataset ships "Kofar Kaura"; the user types it with "roundabout" tacked
  // on, so the query is longer than the name. Without descriptor-aware matching
  // this returned nothing local.
  const { places } = require('../src/data/katsina-places.json');
  assert.ok(places.some((p) => p.name === 'Kofar Kaura'), 'fixture assumes Kofar Kaura exists');
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  queueResp({ status: 'OK', results: [] });
  const out = await mapsService.autocomplete('kofar kaura roundabout', 'tok');
  assert.ok(
    out.some((o) => o.placeId.startsWith('local:') && /kofar kaura/i.test(o.mainText)),
    'Kofar Kaura still surfaces with "roundabout" appended',
  );
});

test('autocomplete: local index matches reordered / filler-padded queries', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  queueResp({ status: 'OK', results: [] });
  const out = await mapsService.autocomplete('kaura kofar junction', 'tok');
  assert.ok(
    out.some((o) => o.placeId.startsWith('local:') && /kofar kaura/i.test(o.mainText)),
    'word order and a junction suffix still match Kofar Kaura',
  );
});

test('autocomplete: a bare descriptor word does not match every place', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  queueResp({ status: 'OK', results: [] });
  const out = await mapsService.autocomplete('roundabout', 'tok');
  assert.ok(
    !out.some((o) => o.placeId.startsWith('local:')),
    'a generic descriptor alone yields no local matches',
  );
});

test('autocomplete: de-dupes geocoding rows that restate a local result', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  // Geocoding returns postal variants of a name the local index already has.
  queueResp({
    status: 'OK',
    results: [
      { place_id: 'g1', formatted_address: 'Tudun Wada 831101, Katsina, Nigeria', types: ['locality'] },
    ],
  });
  const out = await mapsService.autocomplete('tudun wada', 'tok');
  const ids = out.map((o) => o.placeId);
  assert.ok(ids.some((id) => id.startsWith('local:')), 'local Tudun Wada present');
  assert.ok(!ids.includes('g1'), 'the geocoded postal variant is de-duped away');
});

test('autocomplete: empty array on ZERO_RESULTS (does not throw)', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  queueResp({ status: 'ZERO_RESULTS', results: [] }); // parallel geocoding call
  const out = await mapsService.autocomplete('nonsense', 'tok');
  assert.deepEqual(out, []);
});

test('autocomplete: throws AppError.internal on API error status', async () => {
  resetState();
  queueResp({ status: 'REQUEST_DENIED', error_message: 'bad key' });
  queueResp({ status: 'OK', results: [] }); // parallel geocoding call still fires
  await assert.rejects(
    () => mapsService.autocomplete('x', 'tok'),
    (err) => err.statusCode === 500,
  );
});

// --- placeDetails ---

test('placeDetails: returns geometry and formatted address for a placeId', async () => {
  resetState();
  queueResp({
    status: 'OK',
    result: {
      geometry: { location: { lat: 13.02, lng: 7.65 } },
      formatted_address: 'X Building, Katsina',
      name: 'X Building',
    },
  });
  const out = await mapsService.placeDetails('p1', 'session-token');
  assert.equal(out.lat, 13.02);
  assert.equal(out.lng, 7.65);
  assert.equal(out.formattedAddress, 'X Building, Katsina');
  assert.equal(out.placeId, 'p1', 'placeId must be carried through');
  assert.equal(out.outOfArea, false, '13.02,7.65 is inside the operating polygon');
});

test('placeDetails: flags a place outside the operating polygon', async () => {
  resetState();
  queueResp({
    status: 'OK',
    result: {
      geometry: { location: { lat: 12.0022, lng: 8.5919 } }, // Kano city
      formatted_address: 'Kano, Nigeria',
      name: 'Kano',
    },
  });
  const out = await mapsService.placeDetails('p2', 'tok');
  assert.equal(out.outOfArea, true, 'Kano must be flagged out of area');
});

test('placeDetails: AppError.internal on non-OK Google status', async () => {
  resetState();
  queueResp({ status: 'INVALID_REQUEST' });
  await assert.rejects(
    () => mapsService.placeDetails('p1', 'tok'),
    (err) => err.statusCode === 500,
  );
});

test('placeDetails: local pick with stored coords returns them without any API call', async () => {
  resetState();
  const { places } = require('../src/data/katsina-places.json');
  const withCoords = places.find((p) => p.lat != null && p.lng != null);
  assert.ok(withCoords, 'dataset has at least one entry with coordinates');
  // No queued response: localPlaceDetails must NOT hit axios when coords exist.
  const out = await mapsService.placeDetails(`local:${withCoords.id}`, 'tok');
  assert.equal(out.lat, withCoords.lat);
  assert.equal(out.lng, withCoords.lng);
  assert.equal(out.placeId, `local:${withCoords.id}`);
  assert.equal(out.outOfArea, false, 'a Katsina place is in-area');
});

test('placeDetails: local pick without coords is geocoded live (state-scoped)', async () => {
  resetState();
  const { places } = require('../src/data/katsina-places.json');
  const noCoords = places.find((p) => p.lat == null);
  assert.ok(noCoords, 'dataset has a curated entry without coordinates');
  queueResp({
    status: 'OK',
    results: [{ geometry: { location: { lat: 12.99, lng: 7.6 } }, formatted_address: `${noCoords.name}, Katsina, Nigeria`, types: ['neighborhood'] }],
  });
  const out = await mapsService.placeDetails(`local:${noCoords.id}`, 'tok');
  assert.equal(out.lat, 12.99);
  assert.equal(out.lng, 7.6);
  assert.equal(out.outOfArea, false);
  assert.equal(lastRequest.params.components, 'country:NG|administrative_area:Katsina', 'resolved within the state');
});

// --- getDirections ---

test('getDirections: returns polyline + first-leg distance/duration + step instructions', async () => {
  resetState();
  queueResp({
    routes: [{
      overview_polyline: { points: 'abc123' },
      legs: [{
        distance: { value: 8200, text: '8.2 km' },
        duration: { value: 900, text: '15 mins' },
        steps: [
          { html_instructions: 'Head north', distance: { text: '500 m' }, duration: { text: '1 min' } },
          { html_instructions: 'Turn right', distance: { text: '7.7 km' }, duration: { text: '14 min' } },
        ],
      }],
    }],
  });
  const out = await mapsService.getDirections(13.0, 7.6, 13.05, 7.65);
  assert.equal(out.polyline, 'abc123');
  assert.equal(out.distanceMeters, 8200);
  assert.equal(out.durationSeconds, 900);
  assert.equal(out.steps.length, 2);
  assert.equal(out.steps[0].instruction, 'Head north');
});

test('getDirections: AppError.internal when no route found', async () => {
  resetState();
  queueResp({ routes: [] });
  await assert.rejects(
    () => mapsService.getDirections(13.0, 7.6, 13.05, 7.65),
    (err) => err.statusCode === 500,
  );
});
