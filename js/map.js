/* ================================================================
   RoadBuddy — Phase 3: Maps & Geolocation Engine
   File: js/map.js
   ----------------------------------------------------------------
   Requires: Leaflet 1.9.4 (loaded via CDN in HTML head)

   Motorist dashboard:
     - navigator.geolocation with manual-pin fallback
     - 8 seeded nearby providers as interactive markers
     - Popup cards with name, type, rating, distance, request CTA
     - Active provider (Juan Santos) animates toward motorist
     - Service-type filter bar
     - Nearby list panel below the map
     - Dark-mode tile layer swap

   Provider dashboard:
     - Provider shop location marker
     - Active job pins (motorists needing help)
     - Dashed route lines to each job
     - Optional real GPS overlay
   ================================================================ */

const RBMap = (() => {

  /* ── CDO default center (fallback when GPS denied) ── */
  const CDO_CENTER   = [8.4542, 124.6319];
  const MOTORIST_POS = [8.4821, 124.6573]; // Limketkai Drive, CDO
  const PROVIDER_POS = [8.4900, 124.6520]; // AutoFix shop

  /* ── Seeded nearby providers ── */
  const PROVIDERS = [
    { id: 'p1', name: 'AutoFix Repair Shop',  type: 'mechanic', icon: 'fa-wrench',              rating: 4.8, lat: 8.4900, lng: 124.6520, color: '#f97316' },
    { id: 'p2', name: 'QuickTow Express',      type: 'towing',   icon: 'fa-truck-pickup',        rating: 4.6, lat: 8.4680, lng: 124.6480, color: '#6366f1' },
    { id: 'p3', name: 'PowerStart Battery',   type: 'battery',  icon: 'fa-battery-full',        rating: 4.9, lat: 8.4760, lng: 124.6620, color: '#10b981' },
    { id: 'p4', name: 'TireMaster CDO',       type: 'tire',     icon: 'fa-circle-dot',          rating: 4.5, lat: 8.4950, lng: 124.6650, color: '#f59e0b' },
    { id: 'p5', name: 'FuelFriend Delivery',  type: 'fuel',     icon: 'fa-gas-pump',            rating: 4.3, lat: 8.4620, lng: 124.6700, color: '#ec4899' },
    { id: 'p6', name: 'MechPro Services',     type: 'mechanic', icon: 'fa-screwdriver-wrench',  rating: 4.7, lat: 8.4850, lng: 124.6350, color: '#f97316' },
    { id: 'p7', name: 'RoadAssist Central',   type: 'multi',    icon: 'fa-toolbox',             rating: 4.4, lat: 8.4450, lng: 124.6430, color: '#8b5cf6' },
    { id: 'p8', name: 'SpeedFix Garage',      type: 'mechanic', icon: 'fa-car-burst',           rating: 4.6, lat: 8.4780, lng: 124.6490, color: '#f97316' },
  ];

  /* ── Active jobs shown on provider dashboard ── */
  const ACTIVE_JOBS = [
    { id: 'req-001', motorist: 'Maria Reyes',    label: 'Flat Tire',    lat: 8.4821, lng: 124.6573, color: '#ef4444' },
    { id: 'req-002', motorist: 'Roberto Garcia', label: 'Battery Jump', lat: 8.4690, lng: 124.6710, color: '#f97316' },
  ];

  /* ── Tile URLs (light / dark) ── */
  const TILES = {
    light: {
      url:  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    dark: {
      url:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
    }
  };

  /* ── State ── */
  let motoristMap    = null;
  let providerMap    = null;
  let mTileLayer     = null;
  let pTileLayer     = null;
  let motoristMarker = null;
  let providerMarkers = [];
  let enRouteMarker  = null;
  let enRoutePos     = [...MOTORIST_POS]; // start at shop, move toward motorist
  let enRouteTarget  = MOTORIST_POS;
  let enRouteInterval = null;
  let routeLine      = null;
  let activeFilter   = 'all';
  let gpsGranted     = false;
  let isFullscreen   = false;

  /* ── Helpers ── */
  function theme()    { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function el(id)     { return document.getElementById(id); }
  function setText(id, v) { const e = el(id); if (e) e.textContent = v; }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371, d2r = Math.PI / 180;
    const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function serviceLabel(type) {
    return { mechanic: '🔧 Mechanic', towing: '🚛 Towing', battery: '🔋 Battery',
             tire: '⚙️ Tire Service', fuel: '⛽ Fuel Delivery',
             multi: '🛠️ Multi-Service', parts: '📦 Auto Parts' }[type] || type;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MOTORIST MAP
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function initMotoristMap() {
    if (!window.L) { console.error('Leaflet not loaded'); return; }
    const container = el('motoristMap');
    if (!container || motoristMap) return;

    motoristMap = L.map('motoristMap', { center: CDO_CENTER, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(motoristMap);

    const t = TILES[theme()];
    mTileLayer = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(motoristMap);

    // Seed provider markers (before GPS so map looks populated immediately)
    enRoutePos = [PROVIDER_POS[0], PROVIDER_POS[1]];
    renderProviderMarkers(MOTORIST_POS[0], MOTORIST_POS[1]);
    updateNearbyList(MOTORIST_POS[0], MOTORIST_POS[1]);

    // Request GPS
    requestGPS();

    // Dark-mode tile swap
    watchTheme(motoristMap, () => mTileLayer, l => { mTileLayer = l; });
  }

  function requestGPS() {
    const indicator = el('gpsIndicator');
    const banner    = el('gpsBanner');

    if (!navigator.geolocation) {
      setGPSIndicator(indicator, 'denied');
      useFallback(MOTORIST_POS[0], MOTORIST_POS[1]);
      return;
    }

    if (indicator) indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Acquiring GPS…';

    navigator.geolocation.getCurrentPosition(
      pos => {
        gpsGranted = true;
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        placeMotoristMarker(lat, lng, acc);
        motoristMap.setView([lat, lng], 15);
        recalcAll(lat, lng);
        startEnRoute(lat, lng);
        setGPSIndicator(indicator, 'active', `±${Math.round(acc)}m`);
        if (banner) banner.style.display = 'none';
      },
      err => {
        const msg = err.code === 1
          ? 'Location permission denied — click the map to pin your position.'
          : 'Could not get GPS — using demo position.';
        if (banner) { banner.style.display = 'flex'; el('gpsBannerMsg').textContent = msg; }
        setGPSIndicator(indicator, 'demo');
        useFallback(MOTORIST_POS[0], MOTORIST_POS[1]);

        // Allow manual pin on click
        motoristMap.on('click', e => {
          if (gpsGranted) return;
          placeMotoristMarker(e.latlng.lat, e.latlng.lng, 20);
          motoristMap.setView([e.latlng.lat, e.latlng.lng], 15);
          recalcAll(e.latlng.lat, e.latlng.lng);
          startEnRoute(e.latlng.lat, e.latlng.lng);
          setGPSIndicator(indicator, 'manual');
          if (banner) banner.style.display = 'none';
        });
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  }

  function useFallback(lat, lng) {
    placeMotoristMarker(lat, lng, 80);
    motoristMap.setView([lat, lng], 15);
    recalcAll(lat, lng);
    startEnRoute(lat, lng);
  }

  function placeMotoristMarker(lat, lng, accuracy) {
    if (motoristMarker) motoristMarker.remove();
    // Accuracy ring
    if (accuracy && accuracy < 300) {
      L.circle([lat, lng], {
        radius: accuracy, color: '#4338ca', fillColor: '#4338ca',
        fillOpacity: 0.07, weight: 1, dashArray: '4 3'
      }).addTo(motoristMap);
    }
    const icon = L.divIcon({
      className: '',
      html: `<div class="rb-marker rb-marker--motorist"><i class="fas fa-user"></i><div class="rb-marker__pulse"></div></div>`,
      iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -24]
    });
    motoristMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
      .addTo(motoristMap)
      .bindPopup('<div class="rb-popup"><strong>You are here</strong><br><small>Your current location</small></div>');
  }

  /* ── Provider markers ── */
  function renderProviderMarkers(motoristLat, motoristLng) {
    providerMarkers.forEach(({ marker }) => marker.remove());
    providerMarkers = [];

    const list = activeFilter === 'all' ? PROVIDERS : PROVIDERS.filter(p => p.type === activeFilter);
    list.forEach(p => {
      const dist = haversine(motoristLat || MOTORIST_POS[0], motoristLng || MOTORIST_POS[1], p.lat, p.lng);
      const icon = L.divIcon({
        className: '',
        html: `<div class="rb-marker rb-marker--provider" style="--pcolor:${p.color}"><i class="fas ${p.icon}"></i></div>`,
        iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20]
      });
      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(motoristMap)
        .bindPopup(buildProviderPopup(p, dist), { maxWidth: 240, className: 'rb-leaflet-popup' });
      providerMarkers.push({ marker, provider: p });
    });

    setText('mapProviderCount', `${list.length} providers nearby`);
  }

  function buildProviderPopup(p, dist) {
    return `<div class="rb-popup">
      <div class="rb-popup__header">
        <div class="rb-popup__icon" style="background:${p.color}22;color:${p.color}"><i class="fas ${p.icon}"></i></div>
        <div><div class="rb-popup__name">${p.name}</div><div class="rb-popup__type">${serviceLabel(p.type)}</div></div>
      </div>
      <div class="rb-popup__meta"><span>⭐ ${p.rating}</span><span>📍 ${dist.toFixed(1)} km</span></div>
      <button class="rb-popup__btn" onclick="showComingSoon('Request submission')"><i class="fas fa-bolt"></i> Request Assistance</button>
    </div>`;
  }

  function recalcAll(lat, lng) {
    // Update popup content on all provider markers
    providerMarkers.forEach(({ marker, provider: p }) => {
      const dist = haversine(lat, lng, p.lat, p.lng);
      marker.setPopupContent(buildProviderPopup(p, dist));
    });
    updateNearbyList(lat, lng);
  }

  /* ── En-route animation (AutoFix marker moves toward motorist) ── */
  function startEnRoute(motoristLat, motoristLng) {
    if (enRouteInterval) clearInterval(enRouteInterval);
    if (enRouteMarker)   enRouteMarker.remove();
    if (routeLine)       routeLine.remove();

    enRouteTarget = [motoristLat, motoristLng];
    enRoutePos    = [PROVIDER_POS[0], PROVIDER_POS[1]]; // start from shop

    const icon = L.divIcon({
      className: '',
      html: `<div class="rb-marker rb-marker--enroute"><i class="fas fa-truck-fast"></i><div class="rb-marker__enroute-label">En Route</div></div>`,
      iconSize: [44, 56], iconAnchor: [22, 56], popupAnchor: [0, -58]
    });

    enRouteMarker = L.marker(enRoutePos, { icon, zIndexOffset: 900 })
      .addTo(motoristMap)
      .bindPopup('<div class="rb-popup"><strong>Juan Santos · AutoFix</strong><br><small>En route to you — Flat Tire Replacement</small></div>');

    routeLine = L.polyline([enRoutePos, enRouteTarget], {
      color: '#f97316', weight: 2.5, dashArray: '8 5', opacity: 0.55
    }).addTo(motoristMap);

    // Move ~10% of remaining gap every 4 seconds
    enRouteInterval = setInterval(() => {
      const [lat, lng] = enRoutePos;
      const dLat = (enRouteTarget[0] - lat) * 0.10;
      const dLng = (enRouteTarget[1] - lng) * 0.10;

      if (Math.abs(dLat) < 0.000035 && Math.abs(dLng) < 0.000035) {
        clearInterval(enRouteInterval);
        enRouteMarker.setPopupContent(
          '<div class="rb-popup"><strong>Juan Santos · AutoFix</strong><br><small>✅ Arrived at your location</small></div>'
        );
        routeLine.remove();
        return;
      }
      enRoutePos = [lat + dLat, lng + dLng];
      enRouteMarker.setLatLng(enRoutePos);
      routeLine.setLatLngs([enRoutePos, enRouteTarget]);
    }, 4000);
  }

  /* ── Nearby list panel (below the map) ── */
  function updateNearbyList(lat, lng) {
    const list = el('nearbyProviderList');
    if (!list) return;

    const sorted = PROVIDERS
      .map(p => ({ ...p, dist: haversine(lat, lng, p.lat, p.lng) }))
      .filter(p => activeFilter === 'all' || p.type === activeFilter)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);

    list.innerHTML = sorted.map(p => `
      <div class="nearby-item" onclick="focusProvider('${p.id}')">
        <div class="nearby-item__icon" style="background:${p.color}22;color:${p.color}">
          <i class="fas ${p.icon}"></i>
        </div>
        <div class="nearby-item__info">
          <div class="nearby-item__name">${p.name}</div>
          <div class="nearby-item__meta">⭐ ${p.rating} &nbsp;·&nbsp; ${p.dist.toFixed(1)} km away</div>
        </div>
        <button class="btn btn--ghost btn--sm"
          style="font-size:0.75rem;padding:0.25rem 0.625rem;flex-shrink:0;"
          onclick="event.stopPropagation();showComingSoon('Request submission')">
          Request
        </button>
      </div>
    `).join('');
  }

  /* ── GPS indicator states ── */
  function setGPSIndicator(el, state, extra) {
    if (!el) return;
    const cfg = {
      active:  { icon: 'location-dot',        cls: 'map-gps-indicator--active', label: `GPS active ${extra ? '· ' + extra : ''}` },
      demo:    { icon: 'location-crosshairs',  cls: 'map-gps-indicator--demo',   label: 'Demo position · click map to repin'      },
      manual:  { icon: 'location-pin',         cls: 'map-gps-indicator--manual', label: 'Location pinned manually'                 },
      denied:  { icon: 'location-xmark',       cls: 'map-gps-indicator--demo',   label: 'GPS not supported'                        },
    }[state] || {};
    el.innerHTML = `<i class="fas fa-${cfg.icon}"></i> ${cfg.label}`;
    el.className = `map-gps-indicator ${cfg.cls}`;
  }

  /* ── Filter ── */
  function setFilter(type) {
    activeFilter = type;
    document.querySelectorAll('.map-filter-btn').forEach(b => {
      b.classList.toggle('map-filter-btn--active', b.dataset.filter === type);
    });
    const mpos = motoristMarker ? motoristMarker.getLatLng() : { lat: MOTORIST_POS[0], lng: MOTORIST_POS[1] };
    renderProviderMarkers(mpos.lat, mpos.lng);
    updateNearbyList(mpos.lat, mpos.lng);
  }

  /* ── Focus a provider (from nearby list) ── */
  function focusProvider(id) {
    const found = providerMarkers.find(m => m.provider.id === id);
    if (!found) return;
    motoristMap.setView([found.provider.lat, found.provider.lng], 16);
    found.marker.openPopup();
  }

  /* ── Fullscreen toggle ── */
  function toggleFullscreen(mapId) {
    const wrapper = el(mapId === 'motoristMap' ? 'motoristMapWrapper' : 'providerMapWrapper');
    if (!wrapper) return;
    isFullscreen = !isFullscreen;
    wrapper.classList.toggle('map-fullscreen', isFullscreen);
    const btn = el(mapId === 'motoristMap' ? 'mapExpandBtn' : 'provMapExpandBtn');
    if (btn) btn.innerHTML = isFullscreen
      ? '<i class="fas fa-compress"></i> Exit Fullscreen'
      : '<i class="fas fa-expand"></i> Expand';
    setTimeout(() => {
      if (mapId === 'motoristMap' && motoristMap) motoristMap.invalidateSize();
      if (mapId === 'providerMap' && providerMap) providerMap.invalidateSize();
    }, 310);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PROVIDER MAP
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function initProviderMap() {
    if (!window.L) { console.error('Leaflet not loaded'); return; }
    const container = el('providerMap');
    if (!container || providerMap) return;

    providerMap = L.map('providerMap', { center: PROVIDER_POS, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(providerMap);

    const t = TILES[theme()];
    pTileLayer = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(providerMap);

    // Provider's shop marker (self)
    const selfIcon = L.divIcon({
      className: '',
      html: `<div class="rb-marker rb-marker--self"><i class="fas fa-store"></i><div class="rb-marker__pulse"></div></div>`,
      iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -24]
    });
    L.marker(PROVIDER_POS, { icon: selfIcon, zIndexOffset: 1000 })
      .addTo(providerMap)
      .bindPopup('<div class="rb-popup"><strong>AutoFix Repair Shop</strong><br><small>Your location</small></div>');

    // Active job markers + route lines
    ACTIVE_JOBS.forEach(job => {
      const dist = haversine(PROVIDER_POS[0], PROVIDER_POS[1], job.lat, job.lng);
      const jobIcon = L.divIcon({
        className: '',
        html: `<div class="rb-marker rb-marker--job" style="--jcolor:${job.color}">
                 <i class="fas fa-person-circle-exclamation"></i>
                 <div class="rb-marker__job-label">${job.motorist.split(' ')[0]}</div>
               </div>`,
        iconSize: [44, 58], iconAnchor: [22, 58], popupAnchor: [0, -60]
      });
      L.marker([job.lat, job.lng], { icon: jobIcon })
        .addTo(providerMap)
        .bindPopup(`<div class="rb-popup">
          <strong>${job.motorist}</strong><br>
          <small>${job.label} · ${dist.toFixed(1)} km away</small>
          </div>`);
      L.polyline([PROVIDER_POS, [job.lat, job.lng]], {
        color: job.color, weight: 2.5, dashArray: '8 5', opacity: 0.5
      }).addTo(providerMap);
    });

    // Fit bounds to show everything
    const allPoints = [PROVIDER_POS, ...ACTIVE_JOBS.map(j => [j.lat, j.lng])];
    providerMap.fitBounds(L.latLngBounds(allPoints).pad(0.18));

    // Try real GPS (overlaid, labelled differently)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const realIcon = L.divIcon({
          className: '',
          html: `<div class="rb-marker rb-marker--gps-real"><i class="fas fa-crosshairs"></i></div>`,
          iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18]
        });
        L.marker([lat, lng], { icon: realIcon, zIndexOffset: 1100 })
          .addTo(providerMap)
          .bindPopup('<div class="rb-popup"><strong>Your real GPS position</strong></div>');
        setGPSIndicator(el('provGPSIndicator'), 'active');
      });
    }

    watchTheme(providerMap, () => pTileLayer, l => { pTileLayer = l; });
  }

  /* ── Dark-mode tile swap (watches data-theme attribute) ── */
  function watchTheme(map, getLayer, setLayer) {
    new MutationObserver(() => {
      const t = TILES[theme()];
      const old = getLayer();
      if (old) map.removeLayer(old);
      setLayer(L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  return { initMotoristMap, initProviderMap, setFilter, toggleFullscreen, focusProvider };
})();

/* ── Global wrappers (called from onclick attributes in HTML) ── */
function initMotoristMap()        { RBMap.initMotoristMap(); }
function initProviderMap()        { RBMap.initProviderMap(); }
function setMapFilter(type)       { RBMap.setFilter(type); }
function toggleMapFullscreen(id)  { RBMap.toggleFullscreen(id); }
function focusProvider(id)        { RBMap.focusProvider(id); }

/* ── Auto-init when the page is ready ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('motoristMap')) initMotoristMap();
  if (document.getElementById('providerMap')) initProviderMap();
});
