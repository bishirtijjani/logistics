import { decodePolyline } from "../../src/lib/polyline";

describe("decodePolyline", () => {
  it("returns an empty array for empty / non-string input", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline(undefined)).toEqual([]);
    expect(decodePolyline(123)).toEqual([]);
  });

  it("decodes the canonical Google example", () => {
    // Example from
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const points = decodePolyline(encoded);
    expect(points).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it("decodes a single-point polyline correctly", () => {
    // (38.5, -120.2) encoded by itself.
    const encoded = "_p~iF~ps|U";
    const points = decodePolyline(encoded);
    expect(points).toHaveLength(1);
    expect(points[0].latitude).toBeCloseTo(38.5, 5);
    expect(points[0].longitude).toBeCloseTo(-120.2, 5);
  });
});
