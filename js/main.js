mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbGlwa2xlZW1hbm4yIiwiYSI6ImNtaWp5c2p2MDE2a3IzZXBtYnBjeDliNGoifQ.o5jwuQrTIuQ983mQAx4BwQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: [-122.33, 47.61],
  zoom: 10.7,
  pitch: 0,
  bearing: 0,
  antialias: true
});

// Navigation controls
map.addControl(new mapboxgl.NavigationControl());


// Load data
map.on('load', async () => {
  const neighborhoods = await fetch('assets/neighborhoods.geojson').then(res => res.json());
  const dumpingData = await fetch('assets/dumping.geojson').then(res => res.json());
  const equityIndex = await fetch('assets/equity_index.geojson').then(res => res.json());
  const wasteFacilityData = await fetch('assets/waste_facility.geojson').then(res => res.json());

  // Count dumpings per neighborhood
  neighborhoods.features.forEach(n => {
    const count = dumpingData.features.filter(d => turf.booleanPointInPolygon(d, n)).length;
    n.properties.dumping_count = count;
  });

  // Count dumpings per equity tract (for correlation with vulnerability)
  equityIndex.features.forEach(tract => {
    const count = dumpingData.features.filter(d => turf.booleanPointInPolygon(d, tract)).length;
    tract.properties.dumping_count = count;
  });

  // Assign IDs for hover highlighting
  neighborhoods.features.forEach((f, i) => f.id = i);
  equityIndex.features.forEach((f, i) => f.id = 'eq-' + i);

  // Add Mapbox sources/layers
  map.addSource('neighborhoods', { type: 'geojson', data: neighborhoods });
  map.addSource('equity', { type: 'geojson', data: equityIndex });
  map.addSource('dumping', { type: 'geojson', data: 'assets/dumping.geojson' });
  map.addSource('waste-facility', { type: 'geojson', data: wasteFacilityData });


  // Equity Index choropleth only (composite quintile — most disadvantage = darkest)
  map.addLayer({
    id: 'equity-layer',
    type: 'fill',
    source: 'equity',
    paint: {
      'fill-color': [
        'match',
        ['get', 'COMPOSITE_QUINTILE'],
        'Highest Equity Priority', '#253494',
        'Second Highest', '#2c7fb8',
        'Middle', '#41b6c4',
        'Second Lowest', '#a1dab4',
        'Lowest', '#ffffcc',
        '#b0b0b0'
      ],
      'fill-opacity': 0.6
    }
  });

  // 3D BUILDINGS
  
  const layers = map.getStyle().layers;

  // Find first label layer to insert beneath it
  const labelLayerId = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout['text-field']
  ).id;

  map.addLayer(
    {
      id: 'add-3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 9,
      paint: {
        'fill-extrusion-color': '#aaa',

        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9, ['*', ['get', 'height'], 6],   
        ],

        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9, ['*', ['get', 'min_height'], 6]
    ],

        'fill-extrusion-opacity': 0.6
      }
    },
    labelLayerId
  );

  // Equity tract borders
  map.addLayer({
    id: 'equity-borders',
    type: 'line',
    source: 'equity',
    paint: { 'line-color': 'rgba(255, 255, 255, 0.35)', 'line-width': 1 }
  });

  // Points
  map.addLayer({
    id: 'dumping-layer',
    type: 'circle',
    source: 'dumping',
    paint: {
      'circle-radius': 6,
      'circle-color': '#E74C3C',
      'circle-opacity': 0.8,
      'circle-stroke-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'hsla(0, 0%, 100%, 1.00)'
    }
  });

  map.addLayer({
    id: 'waste-facility-layer',
    type: 'circle',
    source: 'waste-facility',
    paint: {
      'circle-radius': 10,
      'circle-color': '#16ad34',
      'circle-opacity': 1,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  // Dumping Frequency by Equity Quintile Chart(1–5)
  const QUINTILE_ORDER = ['Lowest', 'Second Lowest', 'Middle', 'Second Highest', 'Highest Equity Priority'];
  const quintileToNum = {};
  QUINTILE_ORDER.forEach((q, i) => { quintileToNum[q] = i + 1; });

  const quintileCounts = [0, 0, 0, 0, 0];
  equityIndex.features.forEach(f => {
    const q = f.properties.COMPOSITE_QUINTILE;
    const idx = quintileToNum[q];
    if (idx != null) quintileCounts[idx - 1] += f.properties.dumping_count || 0;
  });

  const ctxQuintile = document.getElementById('quintileChart').getContext('2d');
  new Chart(ctxQuintile, {
    type: 'bar',
    data: {
      labels: ['1', '2', '3', '4', '5'],
      datasets: [{
        label: 'Illegal Dumping Reports',
        data: quintileCounts,
        backgroundColor: '#E74C3C'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Count of Illegal Dumping Reports' } },
        x: { title: { display: true, text: 'Level of Equity Priority' } }
      }
    }
  });

  // Equity tract hover (vulnerability + dumping count for correlation)
  map.on('mousemove', 'equity-layer', e => {
    const p = e.features[0].properties;
    const name = p.NAMELSAD || p.NAME || 'Tract';
    const quintile = p.COMPOSITE_QUINTILE || '—';
    const score = p.COMPOSITE_SCORE != null ? (p.COMPOSITE_SCORE * 100).toFixed(1) + '%' : '—';
    const dumpings = p.dumping_count ?? 0;
    map.getCanvas().style.cursor = 'pointer';
    document.querySelector('#legend .legend-equity-title').textContent =
      `Equity: ${name} — ${quintile} (${score}) · Dumpings: ${dumpings}`;
  });

  map.on('mouseleave', 'equity-layer', () => {
    map.getCanvas().style.cursor = '';
    document.querySelector('#legend .legend-equity-title').textContent = 'Equity (hover tract):';
  });

  // Reset button
  document.getElementById('reset').addEventListener('click', () => {
    map.flyTo({ center: [-122.33, 47.61], zoom: 10.7, pitch: 0, bearing: 0 });
  });

});
