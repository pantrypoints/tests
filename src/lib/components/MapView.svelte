<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map as LeafletMap, LayerGroup } from 'leaflet';

  let mapContainer: HTMLDivElement;
  let map: LeafletMap | null = null;

  // Layer groups
  let jeepneyLayer: LayerGroup | null = null;
  let busLayer: LayerGroup | null = null;
  let uvLayer: LayerGroup | null = null;
  let tricycleLayer: LayerGroup | null = null;
  let sidewalkLayer: LayerGroup | null = null;

  // Toggle states
  let showJeepney = $state(true);
  let showBus = $state(true);
  let showUV = $state(true);
  let showTricycle = $state(true);
  let showSidewalks = $state(false);
  let showLegend = $state(true);

  // Zoom state
  let currentZoom = $state(12);
  let routesVisible = $state(false);
  const ROUTE_ZOOM_THRESHOLD = 14;

  const METRO_MANILA_CENTER: [number, number] = [14.5547, 121.0244];

  const TRANSPORT_COLORS = {
    jeepney: '#F59E0B',
    bus: '#EF4444',
    uv: '#8B5CF6',
    tricycle: '#10B981'
  };

  const SIDEWALK_COLOR_MAP = [
    { min: 5, color: '#22C55E', label: '≥ 5m' },
    { min: 3, color: '#EAB308', label: '3m – 5m' },
    { min: 1.2, color: '#F97316', label: '1.2m – 3m' },
    { min: 0.01, color: '#EF4444', label: '< 1.2m' },
    { min: 0, color: '#171717', label: 'Impassable / None' }
  ];

  function getSidewalkColor(width: number): string {
    if (width >= 5) return '#22C55E';
    if (width >= 3) return '#EAB308';
    if (width >= 1.2) return '#F97316';
    if (width > 0) return '#EF4444';
    return '#171717';
  }

  async function loadRoutes(L: any, mapInstance: LeafletMap) {
    const [jeepneyData, busData, uvData, tricycleData, sidewalkData] = await Promise.all([
      fetch('/data/jeepney_routes.json').then(r => r.json()),
      fetch('/data/bus_routes.json').then(r => r.json()),
      fetch('/data/uv_routes.json').then(r => r.json()),
      fetch('/data/tricycle_routes.json').then(r => r.json()),
      fetch('/data/sidewalks.json').then(r => r.json())
    ]);

    // Jeepney layer
    jeepneyLayer = L.layerGroup();
    for (const route of jeepneyData.routes) {
      const line = L.polyline(route.path, {
        color: TRANSPORT_COLORS.jeepney,
        weight: 4,
        opacity: 0.85,
        className: 'route-line'
      });
      line.bindTooltip(`<b>🚌 Jeepney</b><br>${route.name}`, { sticky: true, className: 'route-tooltip' });
      jeepneyLayer.addLayer(line);
    }

    // Bus layer
    busLayer = L.layerGroup();
    for (const route of busData.routes) {
      const line = L.polyline(route.path, {
        color: TRANSPORT_COLORS.bus,
        weight: 5,
        opacity: 0.85,
        dashArray: '10,5',
        className: 'route-line'
      });
      line.bindTooltip(`<b>🚌 Bus</b><br>${route.name}`, { sticky: true, className: 'route-tooltip' });
      busLayer.addLayer(line);
    }

    // UV Express layer
    uvLayer = L.layerGroup();
    for (const route of uvData.routes) {
      const line = L.polyline(route.path, {
        color: TRANSPORT_COLORS.uv,
        weight: 4,
        opacity: 0.85,
        dashArray: '6,4',
        className: 'route-line'
      });
      line.bindTooltip(`<b>🚐 UV Express</b><br>${route.name}`, { sticky: true, className: 'route-tooltip' });
      uvLayer.addLayer(line);
    }

    // Tricycle layer
    tricycleLayer = L.layerGroup();
    for (const route of tricycleData.routes) {
      const line = L.polyline(route.path, {
        color: TRANSPORT_COLORS.tricycle,
        weight: 3,
        opacity: 0.85,
        className: 'route-line'
      });
      line.bindTooltip(`<b>🛺 Tricycle</b><br>${route.name}`, { sticky: true, className: 'route-tooltip' });
      tricycleLayer.addLayer(line);
    }

    // Sidewalk layer
    sidewalkLayer = L.layerGroup();
    for (const sw of sidewalkData.sidewalks) {
      const color = getSidewalkColor(sw.width_m);
      const line = L.polyline(sw.path, {
        color,
        weight: 5,
        opacity: 0.9,
        className: 'sidewalk-line'
      });
      const widthLabel = sw.width_m > 0 ? `${sw.width_m}m wide` : 'Impassable / No sidewalk';
      line.bindTooltip(`<b>🚶 Sidewalk</b><br>${sw.name}<br>${widthLabel}`, { sticky: true, className: 'route-tooltip' });
      sidewalkLayer.addLayer(line);
    }

    // Apply initial visibility
    updateLayerVisibility();
  }

  function updateLayerVisibility() {
    if (!map) return;

    const zoom = map.getZoom();
    const shouldShow = zoom >= ROUTE_ZOOM_THRESHOLD;

    const toggleLayer = (layer: LayerGroup | null, show: boolean) => {
      if (!layer || !map) return;
      if (show && shouldShow) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    };

    toggleLayer(jeepneyLayer, showJeepney);
    toggleLayer(busLayer, showBus);
    toggleLayer(uvLayer, showUV);
    toggleLayer(tricycleLayer, showTricycle);
    toggleLayer(sidewalkLayer, showSidewalks);
  }

  $effect(() => {
    updateLayerVisibility();
  });




 onMount(() => {
  console.log("Component mounted, checking for Leaflet...");
  
  // Check if Leaflet is already loaded
  if (typeof window !== 'undefined' && (window as any).L) {
    console.log("Leaflet already loaded");
    initMap((window as any).L);
    return;
  }
  
  // Wait for Leaflet to load
  const scriptCheck = setInterval(() => {
    const L = (window as any).L;
    if (L && typeof L.map === 'function') {
      clearInterval(scriptCheck);
      console.log("Leaflet loaded!");
      initMap(L);
    }
  }, 100);
  
  // Also listen for script load event
  const existingScript = document.querySelector('script[src*="leaflet"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => {
      console.log("Leaflet script loaded event");
      const L = (window as any).L;
      if (L) initMap(L);
    });
  }
  
  function initMap(L: any) {
    if (!mapContainer) {
      console.error("No map container");
      return;
    }
    
    console.log("Initializing map...");
    
    // Fix icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
    });
    
    // Create map
    map = L.map(mapContainer).setView(METRO_MANILA_CENTER, 12);
    
    // Add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    // Handle zoom
    map.on('zoomend', () => {
      if (!map) return;
      currentZoom = map.getZoom();
      routesVisible = currentZoom >= ROUTE_ZOOM_THRESHOLD;
      updateLayerVisibility();
    });
    
    currentZoom = map.getZoom();
    routesVisible = currentZoom >= ROUTE_ZOOM_THRESHOLD;
    
    // Load data
    loadRoutes(L, map).catch(console.error);
  }
  
  return () => {
    if (map) map.remove();
  };
});
</script>





<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
</svelte:head>

<div class="map-wrapper">
  <!-- Map container -->
  <div bind:this={mapContainer} class="map-container"></div>

  <!-- Header bar -->
  <header class="app-header">
    <div class="header-brand">
      <!-- Navigation icon SVG -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 11 19 11 22 14 3 14 3 11"></polygon>
        <path d="M11 19L3 11 11 3"></path>
      </svg>
      <span class="brand-name">Manilakbay</span>
      <span class="brand-tagline">Metro Manila Commute Guide</span>
    </div>
  </header>

  <!-- Controls Panel -->
  <div class="controls-panel">
    <button class="panel-toggle" onclick={() => showLegend = !showLegend}>
      <!-- Layers icon SVG -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
      <span>Layers</span>
      {#if showLegend}
        <!-- ChevronUp icon SVG -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      {:else}
        <!-- ChevronDown icon SVG -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      {/if}
    </button>

    {#if showLegend}
      <div class="panel-body">
        <!-- Transport routes -->
        <div class="section-label">TRANSPORT ROUTES</div>

        <label class="toggle-row" class:active={showJeepney}>
          <input type="checkbox" bind:checked={showJeepney} />
          <span class="color-dot" style="background: {TRANSPORT_COLORS.jeepney}"></span>
          <span class="toggle-label">Jeepney</span>
          {#if showJeepney}
            <!-- Eye icon SVG -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          {:else}
            <!-- EyeOff icon SVG -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          {/if}
        </label>

        <label class="toggle-row" class:active={showBus}>
          <input type="checkbox" bind:checked={showBus} />
          <span class="color-dot" style="background: {TRANSPORT_COLORS.bus}"></span>
          <span class="toggle-label">Bus</span>
          {#if showBus}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          {/if}
        </label>

        <label class="toggle-row" class:active={showUV}>
          <input type="checkbox" bind:checked={showUV} />
          <span class="color-dot" style="background: {TRANSPORT_COLORS.uv}"></span>
          <span class="toggle-label">UV Express</span>
          {#if showUV}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          {/if}
        </label>

        <label class="toggle-row" class:active={showTricycle}>
          <input type="checkbox" bind:checked={showTricycle} />
          <span class="color-dot" style="background: {TRANSPORT_COLORS.tricycle}"></span>
          <span class="toggle-label">Tricycle</span>
          {#if showTricycle}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          {/if}
        </label>

        <!-- Sidewalks -->
        <div class="section-label" style="margin-top: 8px">PEDESTRIAN</div>

        <label class="toggle-row" class:active={showSidewalks}>
          <input type="checkbox" bind:checked={showSidewalks} />
          <span class="sidewalk-gradient"></span>
          <span class="toggle-label">Sidewalks</span>
          {#if showSidewalks}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          {/if}
        </label>

        {#if showSidewalks}
          <div class="sidewalk-legend">
            {#each SIDEWALK_COLOR_MAP as entry}
              <div class="sidewalk-legend-row">
                <span class="sidewalk-swatch" style="background: {entry.color}"></span>
                <span class="sidewalk-legend-label">{entry.label}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Zoom notice -->
        {#if !routesVisible}
          <div class="zoom-notice">
            <!-- MapPin icon SVG -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Zoom in to see routes (zoom ≥ {ROUTE_ZOOM_THRESHOLD})
          </div>
        {:else}
          <div class="zoom-active">
            <!-- MapPin icon SVG -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Routes visible — zoom {currentZoom}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Zoom level badge -->
  <div class="zoom-badge" class:unlocked={routesVisible}>
    {#if routesVisible}
      <span>🗺️ Routes ON · z{currentZoom}</span>
    {:else}
      <span>🔍 Zoom in for routes · z{currentZoom}/{ROUTE_ZOOM_THRESHOLD}</span>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: 'Inter', 'Segoe UI', sans-serif;
  }

  .map-wrapper {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: #0f1117;
  }

  .map-container {
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  /* Header */
  .app-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: linear-gradient(to bottom, rgba(10,12,18,0.96) 0%, rgba(10,12,18,0) 100%);
    padding: 14px 20px;
    pointer-events: none;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
  }

  .header-brand :global(svg) {
    color: #F59E0B;
  }

  .brand-name {
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    text-shadow: 0 0 20px rgba(245,158,11,0.5);
  }

  .brand-tagline {
    font-size: 0.72rem;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Controls Panel */
  .controls-panel {
    position: absolute;
    top: 60px;
    left: 16px;
    z-index: 1000;
    background: rgba(12,14,22,0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    min-width: 200px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    overflow: hidden;
  }

  .panel-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 14px;
    background: none;
    border: none;
    color: #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .panel-toggle:hover {
    background: rgba(255,255,255,0.06);
  }

  .panel-toggle :global(svg) {
    color: #F59E0B;
  }

  .panel-toggle span {
    flex: 1;
  }

  .panel-body {
    padding: 4px 12px 12px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .section-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.35);
    margin: 10px 0 6px;
    text-transform: uppercase;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;
    margin-bottom: 2px;
  }

  .toggle-row:hover {
    background: rgba(255,255,255,0.06);
  }

  .toggle-row.active {
    background: rgba(255,255,255,0.04);
  }

  .toggle-row input[type="checkbox"] {
    display: none;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
  }

  .sidewalk-gradient {
    width: 20px;
    height: 8px;
    border-radius: 3px;
    flex-shrink: 0;
    background: linear-gradient(to right, #22C55E, #EAB308, #F97316, #EF4444, #171717);
  }

  .toggle-label {
    flex: 1;
    font-size: 0.8rem;
    color: #cbd5e1;
  }

  .toggle-row :global(svg) {
    color: rgba(255,255,255,0.4);
  }

  .toggle-row.active :global(svg) {
    color: rgba(255,255,255,0.7);
  }

  /* Sidewalk legend */
  .sidewalk-legend {
    margin: 6px 0 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .sidewalk-legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sidewalk-swatch {
    width: 20px;
    height: 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .sidewalk-legend-label {
    font-size: 0.72rem;
    color: rgba(255,255,255,0.55);
  }

  /* Zoom notice */
  .zoom-notice {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.25);
    font-size: 0.72rem;
    color: #F59E0B;
  }

  .zoom-active {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(34,197,94,0.12);
    border: 1px solid rgba(34,197,94,0.25);
    font-size: 0.72rem;
    color: #22C55E;
  }

  /* Zoom badge */
  .zoom-badge {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    background: rgba(12,14,22,0.88);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.55);
    backdrop-filter: blur(8px);
    pointer-events: none;
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .zoom-badge.unlocked {
    border-color: rgba(34,197,94,0.4);
    color: #22C55E;
    background: rgba(12,22,16,0.9);
    box-shadow: 0 0 16px rgba(34,197,94,0.2);
  }

  /* Leaflet overrides */
  :global(.route-tooltip) {
    background: rgba(10,12,18,0.92) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #e2e8f0 !important;
    font-size: 0.78rem !important;
    border-radius: 8px !important;
    padding: 6px 10px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
  }

  :global(.route-tooltip::before) {
    display: none !important;
  }

  :global(.leaflet-control-attribution) {
    background: rgba(10,12,18,0.7) !important;
    color: rgba(255,255,255,0.35) !important;
    font-size: 0.65rem !important;
  }

  :global(.leaflet-control-attribution a) {
    color: rgba(255,255,255,0.5) !important;
  }

  :global(.leaflet-control-zoom) {
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
    overflow: hidden;
  }

  :global(.leaflet-control-zoom a) {
    background: rgba(12,14,22,0.9) !important;
    color: #e2e8f0 !important;
    border-bottom-color: rgba(255,255,255,0.1) !important;
  }

  :global(.leaflet-control-zoom a:hover) {
    background: rgba(30,35,55,0.95) !important;
  }
</style>

