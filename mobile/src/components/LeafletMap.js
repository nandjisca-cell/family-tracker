import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_CENTER = { latitude: 23.0225, longitude: 72.5714 };

const safeJson = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

const LeafletMap = ({
  center = DEFAULT_CENTER,
  zoom = 14,
  markers = [],
  circles = [],
  polylines = [],
  style,
  onMapPress,
}) => {
  const html = useMemo(() => {
    const mapCenter = center || DEFAULT_CENTER;

    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #111827; }
    .marker-wrap { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); }
    .marker-dot { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,.35); }
    .marker-label { margin-top: 3px; padding: 2px 7px; border-radius: 8px; background: #1d4ed8; color: #fff; font: 700 11px Arial, sans-serif; white-space: nowrap; }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = ${safeJson(mapCenter)};
    const markers = ${safeJson(markers)};
    const circles = ${safeJson(circles)};
    const polylines = ${safeJson(polylines)};

    const map = L.map('map', { zoomControl: true }).setView([center.latitude, center.longitude], ${Number(zoom) || 14});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    markers.forEach((marker) => {
      const color = marker.color || '#2563eb';
      const label = marker.title || '';
      const icon = L.divIcon({
        html: '<div class="marker-wrap"><div class="marker-dot" style="background:' + color + '"></div>' +
          (label ? '<div class="marker-label">' + label + '</div>' : '') + '</div>',
        className: '',
        iconSize: [1, 1],
        iconAnchor: [0, 0]
      });
      L.marker([marker.latitude, marker.longitude], { icon }).addTo(map).bindPopup(label || 'Location');
    });

    polylines.forEach((line) => {
      const points = (line.coordinates || []).map((point) => [point.latitude, point.longitude]);
      if (points.length > 1) {
        L.polyline(points, { color: line.color || '#3b82f6', weight: line.width || 3 }).addTo(map);
      }
    });

    circles.forEach((circle) => {
      L.circle([circle.latitude, circle.longitude], {
        radius: circle.radius || 20,
        color: circle.strokeColor || '#3b82f6',
        weight: circle.strokeWidth || 2,
        fillColor: circle.fillColor || '#3b82f6',
        fillOpacity: circle.fillOpacity ?? 0.16
      }).addTo(map);
    });

    map.on('click', (event) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'map_press',
        latitude: event.latlng.lat,
        longitude: event.latlng.lng
      }));
    });

    setTimeout(() => map.invalidateSize(), 250);
  </script>
</body>
</html>`;
  }, [center, zoom, markers, circles, polylines]);

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={[styles.webview, style]}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onMessage={(event) => {
        if (!onMapPress) return;
        try {
          const payload = JSON.parse(event.nativeEvent.data);
          if (payload.type === 'map_press') {
            onMapPress({ latitude: payload.latitude, longitude: payload.longitude });
          }
        } catch (err) {
          // Ignore malformed map messages.
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#111827' },
});

export default LeafletMap;
