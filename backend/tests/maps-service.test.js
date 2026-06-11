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
stubModule(require.resolve('axios'), {
  get: async (url, opts) => {
    lastRequest = { url, params: opts?.params };
    if (nextResponses.length === 0) {
      throw new Error('no axios response queued for this test');
    }
    const next = nextResponses.shift();
    if (next instanceof Error) throw next;
    return next;
  },
});

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

test('reverseGeocode: AppError.badRequest when no results', async () => {
  resetState();
  queueResp({ results: [] });
  await assert.rejects(
    () => mapsService.reverseGeocode(0, 0),
    (err) => err.statusCode === 400,
  );
});

// --- autocomplete ---

test('autocomplete: returns flattened predictions', async () => {
  resetState();
  queueResp({
    status: 'OK',
    predictions: [
      {
        place_id: 'p1',
        description: 'Sani Street, Katsina',
        structured_formatting: { main_text: 'Sani Street', secondary_text: 'Katsina' },
      },
      {
        place_id: 'p2',
        description: 'Sani Abacha Road, Katsina',
        structured_formatting: { main_text: 'Sani Abacha Road', secondary_text: 'Katsina' },
      },
    ],
  });
  const out = await mapsService.autocomplete('Sani', 'session-token-1');
  assert.equal(out.length, 2);
  assert.equal(out[0].placeId, 'p1');
  assert.equal(out[0].mainText, 'Sani Street');
  assert.equal(out[1].mainText, 'Sani Abacha Road');
  assert.equal(lastRequest.params.components, 'country:ng');
  // Geo-restriction (Katsina) BIASES autocomplete to the area circle (not a
  // strict bound - the real gate is point-in-polygon at placeDetails time).
  assert.equal(lastRequest.params.location, '12.4,7.6');
  assert.equal(lastRequest.params.radius, 150000);
  assert.equal(lastRequest.params.strictbounds, undefined, 'must bias, not strict-bound');
  assert.equal(lastRequest.params.types, undefined, 'combined types are invalid for legacy autocomplete');
});

test('autocomplete: filters out same-named places in other states', async () => {
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
        // Street literally named "Katsina" but in Kaduna - must NOT slip through.
        place_id: 'kd',
        description: 'Katsina Road, Kaduna, Nigeria',
        structured_formatting: { main_text: 'Katsina Road', secondary_text: 'Kaduna, Nigeria' },
        terms: [{ value: 'Katsina Road' }, { value: 'Kaduna' }, { value: 'Nigeria' }],
      },
    ],
  });
  const out = await mapsService.autocomplete('Tudun Wada', 'tok');
  assert.equal(out.length, 1, 'only the Katsina result survives');
  assert.equal(out[0].placeId, 'kt');
});

test('autocomplete: empty array on ZERO_RESULTS (does not throw)', async () => {
  resetState();
  queueResp({ status: 'ZERO_RESULTS', predictions: [] });
  const out = await mapsService.autocomplete('nonsense', 'tok');
  assert.deepEqual(out, []);
});

test('autocomplete: throws AppError.internal on API error status', async () => {
  resetState();
  queueResp({ status: 'REQUEST_DENIED', error_message: 'bad key' });
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
