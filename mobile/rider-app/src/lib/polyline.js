/**
 * Minimal Google "encoded polyline algorithm format" decoder.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Decodes a string like "_p~iF~ps|U_ulLnnqC" into an array of
 * { latitude, longitude } points that react-native-maps's <Polyline> consumes.
 *
 * Avoids the ~30KB @mapbox/polyline dep — we only need the decoder.
 */
export const decodePolyline = (encoded) => {
  if (typeof encoded !== 'string' || encoded.length === 0) return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};
