mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbGlwa2xlZW1hbm4yIiwiYSI6ImNtaWp5c2p2MDE2a3IzZXBtYnBjeDliNGoifQ.o5jwuQrTIuQ983mQAx4BwQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: [-122.33, 47.60],
  zoom: 11
});

// Navigation controls
map.addControl(new mapboxgl.NavigationControl());


// Load data
map.on('load', async () => {
  const neighborhoods = await fetch('assets/neighborhoods.geojson').then(res => res.json());
  const dumpingData = await fetch('assets/dumping.geojson').then(res => res.json());

  // Count dumpings per neighborhood
  neighborhoods.features.forEach(n => {
    const count = dumpingData.features.filter(d => turf.booleanPointInPolygon(d, n)).length;
    n.properties.dumping_count = count;
  });

  // Assign IDs for hover highlighting
  neighborhoods.features.forEach((f, i) => f.id = i);

  const counts = neighborhoods.features.map(f => f.properties.dumping_count);
  const maxCount = Math.max(...counts);


  // Add Mapbox sources/layers
  map.addSource('neighborhoods', { type: 'geojson', data: neighborhoods });
  map.addSource('dumping', { type: 'geojson', data: 'assets/dumping.geojson' });
  map.addSource('underdrains', { type: 'geojson', data: 'assets/underdrains.geojson' });

  // Choropleth
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

  // Borders
  map.addLayer({
    id: 'neighborhoods-borders',
    type: 'line',
    source: 'neighborhoods',
    paint: { 'line-color': 'rgba(138, 137, 137, 1)', 'line-width': 1 }
  });

  // Points
  map.addLayer({
    id: 'underdrains-layer',
    type: 'circle',
    source: 'underdrains',
    paint: { 'circle-radius': 7, 'circle-color': '#3498DB' }
  });

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

  //Bar chart 
  const neighborhoodNames = neighborhoods.features.map(f => f.properties.L_HOOD);
  const dumpingCounts = neighborhoods.features.map(f => f.properties.dumping_count);

  const ctx = document.getElementById('dumpingChart').getContext('2d');
  const dumpingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: neighborhoodNames,
      datasets: [{
        label: 'Illegal Dumpings',
        data: dumpingCounts,
        backgroundColor: '#E74C3C'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Dumping Reports' } },
        x: { title: { display: true, text: 'Neighborhood' } }
      }
    }
  });

  //Neighborhood Dumpings Hover
  map.on('mousemove', 'neighborhoods-layer', e => {
    const name = e.features[0].properties.L_HOOD;
    const count = e.features[0].properties.dumping_count;
    map.getCanvas().style.cursor = 'pointer';
    document.querySelector('#legend .legend-title').textContent =
      `Amount of Neighborhood Dumpings: ${name} (${count})`;
  });

  map.on('mouseleave', 'neighborhoods-layer', () => {
    map.getCanvas().style.cursor = '';
    document.querySelector('#legend .legend-title').textContent = 'Neighborhood Dumpings';
  });

  // Reset button
  document.getElementById('reset').addEventListener('click', () => {
    map.flyTo({ center: [-122.33, 47.60], zoom: 10.7 });
  });

});