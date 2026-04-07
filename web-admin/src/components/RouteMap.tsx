import { useCallback, useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { animate } from 'animejs';
import type { Stop } from '@/types/stop';
import './route-map.css';

// ── Singleton Maps loader ─────────────────────────────────────────────────────

let _promise: Promise<void> | null = null;
let _configuredKey = '';

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (_promise && _configuredKey === apiKey) return _promise;
  _configuredKey = apiKey;
  setOptions({ key: apiKey });
  _promise = Promise.all([
    importLibrary('maps'),
    importLibrary('marker'),
    importLibrary('places'),
    importLibrary('routes'),
  ]).then(() => undefined);
  return _promise;
}

// ── Brand map styles ("Jade Pebble Morning" — neutral, desaturated) ───────────

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'water',          elementType: 'geometry',           stylers: [{ color: '#e9e9e9' }, { lightness: 17 }] },
  { featureType: 'landscape',      elementType: 'geometry',           stylers: [{ color: '#f5f5f5' }, { lightness: 20 }] },
  { featureType: 'road.highway',   elementType: 'geometry.fill',      stylers: [{ color: '#ffffff' }, { lightness: 17 }] },
  { featureType: 'road.highway',   elementType: 'geometry.stroke',    stylers: [{ color: '#ffffff' }, { lightness: 29 }, { weight: 0.2 }] },
  { featureType: 'road.arterial',  elementType: 'geometry',           stylers: [{ color: '#ffffff' }, { lightness: 18 }] },
  { featureType: 'road.local',     elementType: 'geometry',           stylers: [{ color: '#ffffff' }, { lightness: 16 }] },
  { featureType: 'poi',            elementType: 'geometry',           stylers: [{ color: '#f5f5f5' }, { lightness: 21 }] },
  { featureType: 'poi.park',       elementType: 'geometry',           stylers: [{ color: '#dedede' }, { lightness: 21 }] },
  {                                elementType: 'labels.text.stroke', stylers: [{ visibility: 'on' }, { color: '#ffffff' }, { lightness: 16 }] },
  {                                elementType: 'labels.text.fill',   stylers: [{ saturation: 36 }, { color: '#333333' }, { lightness: 40 }] },
  {                                elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',        elementType: 'geometry',           stylers: [{ color: '#f2f2f2' }, { lightness: 19 }] },
  { featureType: 'administrative', elementType: 'geometry.fill',      stylers: [{ color: '#fefefe' }, { lightness: 20 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke',    stylers: [{ color: '#fefefe' }, { lightness: 17 }, { weight: 1.2 }] },
];

// ── Marker icon helpers ───────────────────────────────────────────────────────

function makeStopIcon(seq: number): google.maps.Icon {
  const size = 28;
  const half = size / 2;
  const fs   = seq > 9 ? 9 : 12;
  const svg  = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<circle cx="${half}" cy="${half}" r="${half - 1}" fill="#7B9669" stroke="white" stroke-width="2"/>`,
    `<text x="${half}" y="${half + 4}" text-anchor="middle" fill="white"`,
    ` font-family="DM Sans,Arial,sans-serif" font-size="${fs}" font-weight="500">${seq}</text>`,
    `</svg>`,
  ].join('');
  return {
    url:        `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor:     new google.maps.Point(half, half),
  };
}

function makeDraftIcon(): google.maps.Icon {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">`,
    `<path d="M16 0C7.16 0 0 7.16 0 16c0 11.84 16 24 16 24s16-12.16 16-24C32 7.16 24.84 0 16 0z" fill="#C2A878"/>`,
    `<circle cx="16" cy="16" r="7" fill="white"/>`,
    `<circle cx="16" cy="16" r="4" fill="#C2A878"/>`,
    `</svg>`,
  ].join('');
  return {
    url:        `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 40),
    anchor:     new google.maps.Point(16, 40),
  };
}

// ── Reverse-geocode → short location name ────────────────────────────────────

function extractShortName(result: google.maps.GeocoderResult): string {
  const comps = result.address_components;
  const get   = (type: string): string =>
    comps.find((c) => c.types.includes(type))?.short_name ?? '';
  const route  = get('route');
  const subloc = get('sublocality_level_1') || get('sublocality') || get('neighborhood');
  const city   = get('locality') || get('administrative_area_level_2');
  if (route) { const area = subloc || city; return area ? `${route}, ${area}` : route; }
  if (subloc) return subloc;
  const parts = result.formatted_address.split(',');
  return (parts[0] ?? result.formatted_address).trim();
}

// ── SVG icons (Lucide-style: 2 px stroke, no fill) ───────────────────────────

function IconMaximize() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  );
}
function IconMinimize() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
      <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
    </svg>
  );
}
function IconCrosshair() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/>
      <line x1="12" y1="6"  x2="12" y2="2"/> <line x1="12" y1="22" x2="12" y2="18"/>
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RouteMapProps {
  apiKey:            string;
  stops:             Stop[];
  draftLat?:         number | null;
  draftLon?:         number | null;
  onPinDrop?:        (lat: number, lon: number) => void;
  onNameSuggestion?: (name: string) => void;
  interactive?:      boolean;
  /** Called whenever the map enters or exits fullscreen */
  onExpandChange?:   (expanded: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RouteMap({
  apiKey, stops, draftLat, draftLon, onPinDrop, onNameSuggestion, interactive = false,
  onExpandChange,
}: RouteMapProps) {
  const containerRef          = useRef<HTMLDivElement>(null);
  const searchInputRef        = useRef<HTMLInputElement>(null);
  const controlsRef           = useRef<HTMLDivElement>(null);
  const expandBtnRef          = useRef<HTMLButtonElement>(null);
  const locBtnRef             = useRef<HTMLButtonElement>(null);

  const mapRef                = useRef<google.maps.Map | null>(null);
  const markersRef            = useRef<google.maps.Marker[]>([]);
  const polylineRef           = useRef<google.maps.Polyline | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const draftMarkerRef        = useRef<google.maps.Marker | null>(null);
  const clickListenerRef      = useRef<google.maps.MapsEventListener | null>(null);
  const geocoderRef           = useRef<google.maps.Geocoder | null>(null);

  const onPinDropRef         = useRef(onPinDrop);
  const onNameSuggestionRef  = useRef(onNameSuggestion);
  const onExpandChangeRef    = useRef(onExpandChange);
  useEffect(() => { onPinDropRef.current        = onPinDrop;        }, [onPinDrop]);
  useEffect(() => { onNameSuggestionRef.current = onNameSuggestion; }, [onNameSuggestion]);
  useEffect(() => { onExpandChangeRef.current   = onExpandChange;   }, [onExpandChange]);

  type MapStatus = 'loading' | 'ready' | 'error';
  const [mapStatus,  setMapStatus]  = useState<MapStatus>('loading');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // ── Entrance animation handled purely via CSS (@keyframes map-ctrl-btn-in)
  // JS animation was removed: anime.js sets inline transform as the starting
  // keyframe synchronously, then runs asynchronously — any frame delay left
  // the button stuck at scale(0.6) looking invisible. CSS @keyframes fires
  // in the same paint as the render, so buttons are always immediately visible.

  // ── Trigger map resize after expand/collapse ─────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (mapRef.current) google.maps.event.trigger(mapRef.current, 'resize');
    }, 50);
    return () => clearTimeout(t);
  }, [isExpanded]);

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapseMap(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable pin-drop handler ──────────────────────────────────────────────
  const handlePinDrop = useCallback((lat: number, lng: number) => {
    onPinDropRef.current?.(lat, lng);
    if (!geocoderRef.current || !onNameSuggestionRef.current) return;
    geocoderRef.current
      .geocode({ location: { lat, lng } })
      .then(({ results }) => {
        const first = results[0];
        if (first) onNameSuggestionRef.current?.(extractShortName(first));
      })
      .catch(() => undefined);
  }, []);

  // ── Current location ─────────────────────────────────────────────────────
  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current || isLocating) return;
    setIsLocating(true);
    // Spin is driven by CSS class — no anime.js loop so the SVG is never
    // left in a broken transform state.
    locBtnRef.current?.classList.add('is-locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapRef.current?.setZoom(16);
        setIsLocating(false);
        locBtnRef.current?.classList.remove('is-locating');
      },
      () => {
        setIsLocating(false);
        locBtnRef.current?.classList.remove('is-locating');
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, [isLocating]);

  // ── Expand to fullscreen ─────────────────────────────────────────────────
  const expandMap = useCallback(() => {
    setIsExpanded(true);
    document.body.style.overflow = 'hidden';
    onExpandChangeRef.current?.(true);
    const svgEl = expandBtnRef.current?.querySelector('svg');
    if (svgEl) {
      animate(svgEl, { scale: [1, 0.65, 1.2, 1], duration: 400, ease: 'outBack(2)' });
    }
  }, []);

  // ── Collapse from fullscreen ─────────────────────────────────────────────
  const collapseMap = useCallback(() => {
    setIsExpanded(false);
    document.body.style.overflow = '';
    onExpandChangeRef.current?.(false);
  }, []);

  // ── Initialize map (once per apiKey) ─────────────────────────────────────
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const firstStop = stops[0];
        const center: google.maps.LatLngLiteral = firstStop
          ? { lat: firstStop.lat, lng: firstStop.lon }
          : { lat: 12.9716, lng: 77.5946 };
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom:               firstStop ? 14 : 12,
          mapTypeControl:     false,
          streetViewControl:  false,
          fullscreenControl:  false,
          rotateControl:      false,   // hides the "Map camera controls" compass/tilt button
          clickableIcons:     false,
          styles:             MAP_STYLES,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        });
        mapRef.current      = map;
        geocoderRef.current = new google.maps.Geocoder();
        if (searchInputRef.current) {
          const searchBox = new google.maps.places.SearchBox(searchInputRef.current);
          map.addListener('bounds_changed', () => { const b = map.getBounds(); if (b) searchBox.setBounds(b); });
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places?.length) return;
            const first = places[0];
            if (!first) return;
            const loc = first.geometry?.location;
            if (!loc) return;
            map.panTo(loc); map.setZoom(16);
            if (interactive) handlePinDrop(loc.lat(), loc.lng());
          });
        }
        if (!cancelled) setMapStatus('ready');
      })
      .catch(() => { if (!cancelled) setMapStatus('error'); });
    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync stop markers + road-following path ──────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;
    const currentMap = mapRef.current;
    markersRef.current.forEach((m) => m.setMap(null)); markersRef.current = [];
    polylineRef.current?.setMap(null);                 polylineRef.current = null;
    directionsRendererRef.current?.setMap(null);       directionsRendererRef.current = null;
    if (stops.length === 0) return;
    for (const stop of stops) {
      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lon }, map: currentMap,
        icon: makeStopIcon(stop.sequence), title: stop.name, zIndex: 10,
      });
      const iw = new google.maps.InfoWindow({
        content: `<div style="font-family:DM Sans,Arial,sans-serif;font-size:13px;color:#2A2A2A;padding:2px 4px">`
               + `<strong>#${stop.sequence}</strong>&ensp;${stop.name}</div>`,
      });
      // Stop propagation so the map-level click listener (pin-drop) doesn't
      // also fire when the user taps an existing stop marker.
      marker.addListener('click', (e: google.maps.MapMouseEvent) => {
        e.stop();
        iw.open({ map: currentMap, anchor: marker });
      });
      markersRef.current.push(marker);
    }
    if (stops.length > 1) {
      const first = stops[0]!;
      const last  = stops[stops.length - 1]!;
      const renderer = new google.maps.DirectionsRenderer({
        map: currentMap, suppressMarkers: true,
        polylineOptions: { strokeColor: '#7B9669', strokeWeight: 2.5, strokeOpacity: 0.85 },
      });
      directionsRendererRef.current = renderer;
      void new google.maps.DirectionsService()
        .route({
          origin: { lat: first.lat, lng: first.lon }, destination: { lat: last.lat, lng: last.lon },
          waypoints: stops.slice(1, -1).map((s) => ({ location: { lat: s.lat, lng: s.lon }, stopover: true })),
          travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false,
        })
        .then((result) => { if (directionsRendererRef.current === renderer) renderer.setDirections(result); })
        .catch(() => {
          renderer.setMap(null);
          if (directionsRendererRef.current === renderer) directionsRendererRef.current = null;
          polylineRef.current = new google.maps.Polyline({
            path: stops.map((s) => ({ lat: s.lat, lng: s.lon })), map: currentMap,
            strokeColor: '#7B9669', strokeWeight: 2, strokeOpacity: 0.6,
          });
        });
    }
    const bounds = new google.maps.LatLngBounds();
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lon }));
    currentMap.fitBounds(bounds, 48);
  }, [stops, mapStatus]);

  // ── Toggle click-to-place listener ──────────────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;
    if (clickListenerRef.current) { google.maps.event.removeListener(clickListenerRef.current); clickListenerRef.current = null; }
    if (interactive) {
      clickListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) handlePinDrop(e.latLng.lat(), e.latLng.lng());
      });
    }
    return () => { if (clickListenerRef.current) { google.maps.event.removeListener(clickListenerRef.current); clickListenerRef.current = null; } };
  }, [interactive, mapStatus, handlePinDrop]);

  // ── Sync draft pin marker ────────────────────────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;
    if (draftLat != null && draftLon != null) {
      const pos = { lat: draftLat, lng: draftLon };
      if (!draftMarkerRef.current) {
        draftMarkerRef.current = new google.maps.Marker({
          position: pos, map: mapRef.current, icon: makeDraftIcon(),
          draggable: true, title: 'Drag to fine-tune location', zIndex: 20, animation: google.maps.Animation.DROP,
        });
        draftMarkerRef.current.addListener('dragend', () => {
          const p = draftMarkerRef.current?.getPosition();
          if (p) handlePinDrop(p.lat(), p.lng());
        });
      } else { draftMarkerRef.current.setPosition(pos); }
      const b = mapRef.current.getBounds();
      if (b && !b.contains(pos)) mapRef.current.panTo(pos);
    } else { draftMarkerRef.current?.setMap(null); draftMarkerRef.current = null; }
  }, [draftLat, draftLon, mapStatus, handlePinDrop]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!apiKey) {
    return (
      <div className="route-map-wrapper">
        <div className="route-map-no-key">
          <span>Map unavailable</span>
          <small>Set VITE_GOOGLE_MAPS_API_KEY in your .env to enable the map</small>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dim backdrop — rendered outside the map wrapper so it covers the page */}
      {isExpanded && <div className="map-expand-backdrop" onClick={collapseMap} aria-hidden="true" />}

      <div className={[
        'route-map-wrapper',
        isExpanded  ? 'route-map-wrapper--expanded'    : '',
        interactive ? 'route-map-wrapper--interactive' : '',
      ].filter(Boolean).join(' ')}>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="route-map-toolbar">
          <input
            ref={searchInputRef}
            type="text"
            className="route-map-search"
            placeholder="Search location…"
            aria-label="Search map location"
          />
          {interactive && (
            <span className="route-map-hint">Click map to place stop · drag pin to adjust</span>
          )}
        </div>

        {/* ── Map stage ──────────────────────────────────────────────────── */}
        <div className="route-map-stage">
          <div ref={containerRef} className="route-map-canvas" aria-label="Route map" />

          {mapStatus === 'loading' && (
            <div className="route-map-overlay"><div className="spinner" aria-label="Loading map" /></div>
          )}
          {mapStatus === 'error' && (
            <div className="route-map-overlay">Could not load map — check your API key.</div>
          )}

          {/* ── Floating controls (bottom-right) — animated in by anime.js ── */}
          {mapStatus === 'ready' && (
            <div ref={controlsRef} className="map-controls">
              {/* Current location — icon only */}
              <button
                ref={locBtnRef}
                className="map-ctrl-btn"
                title="Centre on my location"
                aria-label="Centre map on current location"
                onClick={handleCurrentLocation}
                disabled={isLocating}
              >
                <IconCrosshair />
              </button>

              {/* Expand / collapse — icon only, sage colour distinguishes it */}
              <button
                ref={expandBtnRef}
                className="map-ctrl-btn map-ctrl-btn--primary"
                title={isExpanded ? 'Exit fullscreen (Esc)' : 'Expand map'}
                aria-label={isExpanded ? 'Exit fullscreen (Esc)' : 'Expand map to fullscreen'}
                onClick={isExpanded ? collapseMap : expandMap}
              >
                {isExpanded ? <IconMinimize /> : <IconMaximize />}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
