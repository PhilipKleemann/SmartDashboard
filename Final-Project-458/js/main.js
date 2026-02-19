mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbGlwa2xlZW1hbm4yIiwiYSI6ImNtaWp5c2p2MDE2a3IzZXBtYnBjeDliNGoifQ.o5jwuQrTIuQ983mQAx4BwQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: [-122.33, 47.60],
  zoom: 11
});

// Add navigation controls
map.addControl(new mapboxgl.NavigationControl());

map.on('load', async () => {

  // -------------------------
  // Add Sources
  // -------------------------
  map.addSource('dumping', { type: 'geojson', data: 'assets/dumping.geojson' });
  map.addSource('underdrains', { type: 'geojson', data: 'assets/underdrains.geojson' });

  // Load neighborhoods
  let neighborhoods = await fetch('assets/neighborhoods.geojson').then(res => res.json());
  const dumpingData = await fetch('assets/dumping.geojson').then(res => res.json());

  // -------------------------
  // Count dumpings per neighborhood
  // -------------------------
  neighborhoods.features.forEach(n => {
    const count = dumpingData.features.filter(d => turf.booleanPointInPolygon(d, n)).length;
    n.properties.dumping_count = count;
  });

  // Find max count for color scaling
  const counts = neighborhoods.features.map(f => f.properties.dumping_count);
  const maxCount = Math.max(...counts);

  map.addSource('neighborhoods', { type: 'geojson', data: neighborhoods });

  // -------------------------
  // Add Layers
  // -------------------------
  // Neighborhood Choropleth by dumping_count
  map.addLayer({
    id: 'neighborhoods-layer',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'dumping_count'],
        0, '#ffffcc',
        Math.ceil(maxCount * 0.25), '#a1dab4',
        Math.ceil(maxCount * 0.5), '#41b6c4',
        Math.ceil(maxCount * 0.75), '#2c7fb8',
        maxCount, '#253494'
      ],
      'fill-opacity': 0.6
    }
  });

  // Neighborhood borders
  map.addLayer({
    id: 'neighborhoods-borders',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': 'rgba(138, 137, 137, 1)',
      'line-width': 1
    }
  });

  // Underdrains
  map.addLayer({
    id: 'underdrains-layer',
    type: 'circle',
    source: 'underdrains',
    paint: {
      'circle-radius': 7,
      'circle-color': '#3498DB'
    }
  });

  // Illegal Dumping
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

  // -------------------------
  // Chart / Stats
  // -------------------------
  function updateChart() {
    const features = map.queryRenderedFeatures({ layers: ['dumping-layer'] });
    document.getElementById('chart').innerHTML =
      `<h3>Statistics</h3>
       <p>Visible Dumping Reports: ${features.length}</p>`;
  }

  map.on('idle', updateChart);

  // -------------------------
  // Popups
  // -------------------------
  map.on('click', 'dumping-layer', (e) => {
    const props = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<p>${props.description || "No description"}</p>`)
      .addTo(map);
  });

  // Optional: Neighborhood hover popup showing dumping count
  map.on('mousemove', 'neighborhoods-layer', (e) => {
    const name = e.features[0].properties.name;
    const count = e.features[0].properties.dumping_count;
    map.getCanvas().style.cursor = 'pointer';
    // Update legend visually (optional)
    document.querySelector('#legend .legend-title').textContent = `Neighborhood Dumpings: ${name} (${count})`;
  });

  map.on('mouseleave', 'neighborhoods-layer', () => {
    map.getCanvas().style.cursor = '';
    // Reset legend title
    document.querySelector('#legend .legend-title').textContent = 'Neighborhood Dumpings';
  });

  // -------------------------
  // Reset Button
  // -------------------------
  document.getElementById('reset').addEventListener('click', () => {
    map.flyTo({ center: [-122.33, 47.60], zoom: 11 });
  });

});