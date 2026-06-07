/**
 * Web shim for `react-native-maps`.
 *
 * react-native-maps has no web build — it imports React Native native internals
 * (codegenNativeCommands) that don't exist in a browser. Metro is configured (see
 * metro.config.js) to redirect `react-native-maps` to THIS file ONLY when
 * bundling for web (platform === 'web'); native iOS/Android builds resolve the
 * real package, untouched.
 *
 * It re-implements the subset of the react-native-maps API the apps actually use
 * — MapView (default export) with animateToRegion / animateCamera / fitToCoordinates
 * ref methods, Marker (incl. custom children via OverlayView), Polyline, and the
 * PROVIDER_GOOGLE constant — on top of @react-google-maps/api so call sites in the
 * screens need zero changes.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { View } from "react-native";
import {
  GoogleMap,
  useJsApiLoader,
  Marker as GMarker,
  Polyline as GPolyline,
  OverlayView,
} from "@react-google-maps/api";

// Mirror react-native-maps' provider constants (only the value identity matters).
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = undefined;

// Web Maps-JavaScript-API key. Prefer an explicit web key (referrer-restricted,
// with "Maps JavaScript API" enabled); fall back to the app's existing key.
const API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY ||
  "AIzaSyBG66pGzjm27QdEBPG84XdGHpki1nvYjbI";

const toLatLng = (c) => ({ lat: c.latitude, lng: c.longitude });

// react-native-maps expresses zoom via latitudeDelta; Google Maps via a zoom
// level. Convert with the standard web-mercator relationship.
const deltaToZoom = (delta) => {
  if (!delta || delta <= 0) return 14;
  return Math.max(1, Math.min(20, Math.round(Math.log2(360 / delta))));
};

const MapView = forwardRef(function MapView(props, ref) {
  const {
    style,
    region,
    initialRegion,
    onRegionChangeComplete,
    onPress,
    children,
    // Native-only props (showsUserLocation, provider, customMapStyle, …) are
    // accepted and ignored on web.
    ...rest
  } = props;

  const { isLoaded } = useJsApiLoader({
    id: "iprime-gmaps",
    googleMapsApiKey: API_KEY,
  });
  const mapRef = useRef(null);

  const initial = region || initialRegion;
  const center = useMemo(
    () => (initial ? toLatLng(initial) : { lat: 9.082, lng: 8.6753 }), // Nigeria centroid fallback
    [initial?.latitude, initial?.longitude]
  );
  const zoom = useMemo(() => deltaToZoom(initial?.latitudeDelta), [initial?.latitudeDelta]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r) => {
        const map = mapRef.current;
        if (!map || !r) return;
        map.panTo(toLatLng(r));
        if (r.latitudeDelta) map.setZoom(deltaToZoom(r.latitudeDelta));
      },
      animateCamera: (cam) => {
        const map = mapRef.current;
        if (!map || !cam) return;
        if (cam.center) map.panTo(toLatLng(cam.center));
        if (typeof cam.zoom === "number") map.setZoom(cam.zoom);
      },
      fitToCoordinates: (coords = [], opts = {}) => {
        const map = mapRef.current;
        if (!map || !coords.length || !window.google) return;
        const bounds = new window.google.maps.LatLngBounds();
        coords.forEach((c) => bounds.extend(toLatLng(c)));
        map.fitBounds(bounds, opts.edgePadding?.top || 48);
      },
    }),
    []
  );

  const handleLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Mirror onRegionChangeComplete (used by the location pickers to read the
  // centered pin) by reporting the map center when panning settles.
  const handleIdle = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onRegionChangeComplete) return;
    const c = map.getCenter?.();
    if (!c) return;
    onRegionChangeComplete({
      latitude: c.lat(),
      longitude: c.lng(),
      latitudeDelta: initial?.latitudeDelta || 0.01,
      longitudeDelta: initial?.longitudeDelta || 0.01,
    });
  }, [onRegionChangeComplete, initial?.latitudeDelta, initial?.longitudeDelta]);

  const handleClick = useCallback(
    (e) => {
      if (!onPress) return;
      onPress({
        nativeEvent: {
          coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
        },
      });
    },
    [onPress]
  );

  // Until the JS SDK loads, render an empty sized container so layout is stable.
  if (!isLoaded) return <View style={style} />;

  return (
    <View style={style}>
      <GoogleMap
        center={center}
        zoom={zoom}
        onLoad={handleLoad}
        onIdle={handleIdle}
        onClick={handleClick}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        }}
      >
        {children}
      </GoogleMap>
    </View>
  );
});

export const Marker = ({ coordinate, title, children }) => {
  if (!coordinate) return null;
  const position = toLatLng(coordinate);
  // Markers with custom React children (e.g. the rider avatar pin) render via an
  // overlay; plain markers use the native Google pin.
  if (children) {
    return (
      <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{ transform: "translate(-50%, -50%)" }}>{children}</div>
      </OverlayView>
    );
  }
  return <GMarker position={position} title={title} />;
};

export const Polyline = ({
  coordinates = [],
  strokeColor = "#EA580C",
  strokeWidth = 4,
}) => {
  const path = coordinates.map(toLatLng);
  return (
    <GPolyline
      path={path}
      options={{ strokeColor, strokeWeight: strokeWidth, strokeOpacity: 1 }}
    />
  );
};

// Rarely-used exports kept as safe no-ops so any stray import still resolves.
export const Callout = ({ children }) => <>{children}</>;
export const Circle = () => null;

export default MapView;
