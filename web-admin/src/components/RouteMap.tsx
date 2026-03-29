import { useCallback, useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
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
  { featureType: 'water',         elementType: 'geometry',         stylers: [{ color: '#e9e9e9' }, { lightness: 17 }] },
  { featureType: 'landscape',     elementType: 'geometry',         stylers: [{ color: '#f5f5f5' }, { lightness: 20 }] },
  { featureType: 'road.highway',  elementType: 'geometry.fill',    stylers: [{ color: '#ffffff' }, { lightness: 17 }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke',  stylers: [{ color: '#ffffff' }, { lightness: 29 }, { weight: 0.2 }] },
  { featureType: 'road.arterial', elementType: 'geometry',         stylers: [{ color: '#ffffff' }, { lightness: 18 }] },
  { featureType: 'road.local',    elementType: 'geometry',         stylers: [{ color: '#ffffff' }, { lightness: 16 }] },
  { featureType: 'poi',           elementType: 'geometry',         stylers: [{ color: '#f5f5f5' }, { lightness: 21 }] },
  { featureType: 'poi.park',      elementType: 'geometry',         stylers: [{ color: '#dedede' }, { lightness: 21 }] },
  {                               elementType: 'labels.text.stroke', stylers: [{ visibility: 'on' }, { color: '#ffffff' }, { lightness: 16 }] },
  {                               elementType: 'labels.text.fill',   stylers: [{ saturation: 36 }, { color: '#333333' }, { lightness: 40 }] },
  {                               elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',       elementType: 'geometry',         stylers: [{ color: '#f2f2f2' }, { lightness: 19 }] },
  { featureType: 'administrative', elementType: 'geometry.fill',   stylers: [{ color: '#fefefe' }, { lightness: 20 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#fefefe' }, { lightness: 17 }, { weight: 1.2 }] },
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

// ── Reverse-geocode → short location name ─────────────────────────────────────

function extractShortName(result: google.maps.GeocoderResult): string {
  const comps = result.address_components;
  const get   = (type: string): string =>
    comps.find((c) => c.types.includes(type))?.short_name ?? '';

  const route  = get('route');
  const subloc = get('sublocality_level_1') || get('sublocality') || get('neighborhood');
  const city   = get('locality') || get('administrative_area_level_2');

  if (route) {
    const area = subloc || city;
    return area ? `${route}, ${area}` : route;
  }
  if (subloc) return subloc;
  const parts = result.formatted_address.split(',');
  return (parts[0] ?? result.formatted_address).trim();
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RouteMapProps {
  apiKey:              string;
  stops:               Stop[];
  draftLat?:           number | null;
  draftLon?:           number | null;
  onPinDrop?:          (lat: number, lon: number) => void;
  onNameSuggestion?:   (name: string) => void;  // fired after reverse geocode
  interactive?:        boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RouteMap({
  apiKey,
  stops,
  draftLat,
  draftLon,
  onPinDrop,
  onNameSuggestion,
  interactive = false,
}: RouteMapProps) {
  const containerRef           = useRef<HTMLDivElement>(null);
  const searchInputRef         = useRef<HTMLInputElement>(null);

  // Imperative Google Maps handles
  const mapRef                 = useRef<google.maps.Map | null>(null);
  const markersRef             = useRef<google.maps.Marker[]>([]);
  const polylineRef            = useRef<google.maps.Polyline | null>(null);
  const directionsRendererRef  = useRef<google.maps.DirectionsRenderer | null>(null);
  const draftMarkerRef         = useRef<google.maps.Marker | null>(null);
  const clickListenerRef       = useRef<google.maps.MapsEventListener | null>(null);
  const geocoderRef            = useRef<google.maps.Geocoder | null>(null);

  // Callback refs — always fresh, never stale in event listeners
  const onPinDropRef          = useRef(onPinDrop);
  const onNameSuggestionRef   = useRef(onNameSuggestion);
  useEffect(() => { onPinDropRef.current        = onPinDrop;         }, [onPinDrop]);
  useEffect(() => { onNameSuggestionRef.current = onNameSuggestion;  }, [onNameSuggestion]);

  type MapStatus = 'loading' | 'ready' | 'error';
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');

  // Stable pin-drop handler: fires onPinDrop then reverse-geocodes for name suggestion
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
  }, []); // stable — only refs accessed inside

  // ── Initialize map (once per apiKey) ──────────────────────────────────────
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const firstStop = stops[0];
        const center: google.maps.LatLngLiteral = firstStop
          ? { lat: firstStop.lat, lng: firstStop.lon }
          : { lat: 12.9716, lng: 77.5946 }; // Bangalore default

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom:              firstStop ? 14 : 12,
          mapTypeControl:    false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons:    false,
          styles:            MAP_STYLES,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        });
        mapRef.current     = map;
        geocoderRef.current = new google.maps.Geocoder();

        // Places SearchBox
        if (searchInputRef.current) {
          const searchBox = new google.maps.places.SearchBox(searchInputRef.current);
          map.addListener('bounds_changed', () => {
            const b = map.getBounds();
            if (b) searchBox.setBounds(b);
          });
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places || places.length === 0) return;
            const first = places[0];
            if (!first) return;
            const loc = first.geometry?.location;
            if (!loc) return;
            map.panTo(loc);
            map.setZoom(16);
            if (interactive) handlePinDrop(loc.lat(), loc.lng());
          });
        }

        if (!cancelled) setMapStatus('ready');
      })
      .catch(() => { if (!cancelled) setMapStatus('error'); });

    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync stop markers + road-following path ───────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;
    const currentMap = mapRef.current;

    // Clear previous overlays
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
    directionsRendererRef.current?.setMap(null);
    directionsRendererRef.current = null;

    if (stops.length === 0) return;

    // Draw numbered markers for every stop
    for (const stop of stops) {
      const pos    = { lat: stop.lat, lng: stop.lon };
      const marker = new google.maps.Marker({
        position: pos,
        map:      currentMap,
        icon:     makeStopIcon(stop.sequence),
        title:    stop.name,
        zIndex:   10,
      });
      const iw = new google.maps.InfoWindow({
        content: `<div style="font-family:DM Sans,Arial,sans-serif;font-size:13px;color:#2A2A2A;padding:2px 4px">`
               + `<strong>#${stop.sequence}</strong>&ensp;${stop.name}</div>`,
      });
      marker.addListener('click', () => iw.open({ map: currentMap, anchor: marker }));
      markersRef.current.push(marker);
    }

    // Road-following path — only when there are 2+ stops
    if (stops.length > 1) {
      const firstStop = stops[0];
      const lastStop  = stops[stops.length - 1];

      if (firstStop && lastStop) {
        const renderer = new google.maps.DirectionsRenderer({
          map:             currentMap,
          suppressMarkers: true,        // keep our custom numbered markers
          polylineOptions: {
            strokeColor:   '#7B9669',   // sage
            strokeWeight:  2.5,
            strokeOpacity: 0.85,
          },
        });
        directionsRendererRef.current = renderer;

        void new google.maps.DirectionsService()
          .route({
            origin:             { lat: firstStop.lat, lng: firstStop.lon },
            destination:        { lat: lastStop.lat,  lng: lastStop.lon  },
            waypoints:          stops.slice(1, -1).map((s) => ({
              location: { lat: s.lat, lng: s.lon },
              stopover: true,
            })),
            travelMode:         google.maps.TravelMode.DRIVING,
            optimizeWaypoints:  false,
          })
          .then((result) => {
            // Guard: only apply if this renderer is still current
            if (directionsRendererRef.current === renderer) {
              renderer.setDirections(result);
            }
          })
          .catch(() => {
            // Directions API unavailable (billing / quota) — fall back to straight polyline
            renderer.setMap(null);
            if (directionsRendererRef.current === renderer) {
              directionsRendererRef.current = null;
            }
            polylineRef.current = new google.maps.Polyline({
              path:          stops.map((s) => ({ lat: s.lat, lng: s.lon })),
              map:           currentMap,
              strokeColor:   '#7B9669',
              strokeWeight:  2,
              strokeOpacity: 0.6,
            });
          });
      }
    }

    // Fit bounds to all stops
    const bounds = new google.maps.LatLngBounds();
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lon }));
    currentMap.fitBounds(bounds, 48);
  }, [stops, mapStatus]);

  // ── Toggle click-to-place listener ────────────────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;

    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (interactive) {
      clickListenerRef.current = mapRef.current.addListener(
        'click',
        (e: google.maps.MapMouseEvent) => {
          if (e.latLng) handlePinDrop(e.latLng.lat(), e.latLng.lng());
        },
      );
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [interactive, mapStatus, handlePinDrop]);

  // ── Sync draft pin marker ─────────────────────────────────────────────────
  useEffect(() => {
    if (mapStatus !== 'ready' || !mapRef.current) return;

    if (draftLat != null && draftLon != null) {
      const pos = { lat: draftLat, lng: draftLon };

      if (!draftMarkerRef.current) {
        draftMarkerRef.current = new google.maps.Marker({
          position:  pos,
          map:       mapRef.current,
          icon:      makeDraftIcon(),
          draggable: true,
          title:     'Drag to fine-tune location',
          zIndex:    20,
          animation: google.maps.Animation.DROP,
        });
        draftMarkerRef.current.addListener('dragend', () => {
          const p = draftMarkerRef.current?.getPosition();
          if (p) handlePinDrop(p.lat(), p.lng());
        });
      } else {
        draftMarkerRef.current.setPosition(pos);
      }

      const b = mapRef.current.getBounds();
      if (b && !b.contains(pos)) mapRef.current.panTo(pos);

    } else {
      draftMarkerRef.current?.setMap(null);
      draftMarkerRef.current = null;
    }
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
    <div className={`route-map-wrapper${interactive ? ' route-map-wrapper--interactive' : ''}`}>

      <div className="route-map-toolbar">
        <input
          ref={searchInputRef}
          type="text"
          className="route-map-search"
          placeholder="Search location…"
          aria-label="Search map location"
        />
        {interactive && (
          <span className="route-map-hint">
            Click to place stop · drag pin to adjust
          </span>
        )}
      </div>

      <div className="route-map-stage">
        <div ref={containerRef} className="route-map-canvas" aria-label="Route map" />

        {mapStatus === 'loading' && (
          <div className="route-map-overlay">
            <div className="spinner" aria-label="Loading map" />
          </div>
        )}
        {mapStatus === 'error' && (
          <div className="route-map-overlay">
            Could not load map — check your API key.
          </div>
        )}
      </div>

    </div>
  );
}
