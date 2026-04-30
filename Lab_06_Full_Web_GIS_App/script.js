// Create map
const map = L.map("map").setView([27.5, 90.4], 8);

// Basemap 1: OpenStreetMap
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Basemap 2: OpenTopoMap
const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenTopoMap contributors"
});

// Layer groups
const dzongkhagLayer = L.layerGroup().addTo(map);
const hospitalLayer = L.layerGroup().addTo(map);
let dzongkhagGeoJsonData = null;
let hospitalGeoJsonData = null;

// Zoom function
function zoomToBhutan() {
  map.setView([27.5, 90.4], 8);
}

// GeoJSON layers
fetch("../Data/bhutan_dzong_web.geojson")
  .then(response => response.json())
  .then(data => {
    dzongkhagGeoJsonData = data;
    L.geoJSON(data, {
      style: {
        color: "black",
        weight: 1,
        fillColor: "orange",
        fillOpacity: 0.3
      },
      onEachFeature: function(feature, layer) {
        layer.on('click', function() {
          layer.bindPopup(getDzongkhagInfo(feature)).openPopup();
        });
      }
    }).addTo(dzongkhagLayer);
  });

fetch("../Data/healthcare.geojson")
  .then(response => response.json())
  .then(data => {
    // Convert MultiPoint to Point for single points
    data.features.forEach(feature => {
      if (feature.geometry.type === 'MultiPoint' && feature.geometry.coordinates.length === 1) {
        feature.geometry.type = 'Point';
        feature.geometry.coordinates = feature.geometry.coordinates[0];
      }
    });
    hospitalGeoJsonData = data;
    const hospitalGeoJsonLayer = L.geoJSON(data, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          pane: 'markerPane',
          radius: 6,
          color: "red",
          fillColor: "red",
          fillOpacity: 0.8
        });
      },
      onEachFeature: function(feature, layer) {
        const hospitalName = feature.properties.name_new || feature.properties.name_old || feature.properties.new_name_1 || "Unknown healthcare centre";
        layer.bindPopup(hospitalName);
        layer.on('click', function(e) {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);
          }
          this.openPopup();
        });
      }
    }).addTo(hospitalLayer);

    hospitalGeoJsonLayer.eachLayer(function(layer) {
      if (layer.bringToFront) {
        layer.bringToFront();
      }
    });
  });

// Add scale bar
L.control.scale({
  imperial: false,
  position: 'bottomleft'
}).addTo(map);

// Lat/Lng coordinate display control
const coordsControl = L.control({ position: 'bottomright' });
coordsControl.onAdd = function(map) {
  this._div = L.DomUtil.create('div', 'coords-control');
  this.update();
  return this._div;
};
coordsControl.update = function(latlng) {
  this._div.innerHTML = latlng
    ? `<strong>Lat:</strong> ${latlng.lat.toFixed(5)}<br><strong>Lng:</strong> ${latlng.lng.toFixed(5)}`
    : 'Move mouse over map';
};
coordsControl.addTo(map);

map.on('mousemove', function(e) {
  coordsControl.update(e.latlng);
});
map.on('mouseout', function() {
  coordsControl.update();
});

// Basemap control
const baseMaps = {
  "OpenStreetMap": osm,
  "OpenTopoMap": topo
};

// Overlay control
const overlayMaps = {
  "Dzongkhag Boundary": dzongkhagLayer,
  "Hospital Locations": hospitalLayer
 };

// Add layer control
L.control.layers(baseMaps, overlayMaps).addTo(map);

// Add a feature group for drawn measurements
const drawnItems = L.featureGroup().addTo(map);

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    edit: false,
    remove: true
  },
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: true,
      metric: true,
      shapeOptions: {
        color: '#f357a1'
      }
    },
    polyline: {
      metric: true,
      shapeOptions: {
        color: '#3388ff'
      }
    },
    rectangle: false,
    circle: {
      shapeOptions: {
        color: '#ff6666'
      }
    },
    marker: false,
    circlemarker: false
  }
});

map.addControl(drawControl);

const drawLineHandler = new L.Draw.Polyline(map, drawControl.options.draw.polyline);
const drawPolygonHandler = new L.Draw.Polygon(map, drawControl.options.draw.polygon);

function disableDrawInteractions() {
  if (map.dragging && map.dragging.enabled()) map.dragging.disable();
  if (map.doubleClickZoom && map.doubleClickZoom.enabled()) map.doubleClickZoom.disable();
  if (map.scrollWheelZoom && map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
}

function enableDrawInteractions() {
  if (map.dragging && !map.dragging.enabled()) map.dragging.enable();
  if (map.doubleClickZoom && !map.doubleClickZoom.enabled()) map.doubleClickZoom.enable();
  if (map.scrollWheelZoom && !map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
}

map.on('draw:drawstart', disableDrawInteractions);
map.on('draw:drawstop', enableDrawInteractions);

const measureDistanceButton = document.getElementById('measureDistanceBtn');
const measureAreaButton = document.getElementById('measureAreaBtn');

if (measureDistanceButton) {
  measureDistanceButton.addEventListener('click', function() {
    drawLineHandler.enable();
    disableDrawInteractions();
  });
}

if (measureAreaButton) {
  measureAreaButton.addEventListener('click', function() {
    drawPolygonHandler.enable();
    disableDrawInteractions();
  });
}

function getDzongkhagInfo(feature) {
  const dzongkhagName = feature.properties.Dzongkhag || feature.properties.adm1_name || 'Unknown';
  const resultParts = [`Dzongkhag: <strong>${dzongkhagName}</strong>`];

  if (hospitalGeoJsonData && hospitalGeoJsonData.features) {
    const insideHospitals = hospitalGeoJsonData.features.filter(hospital => {
      const point = turf.point(hospital.geometry.coordinates);
      return turf.booleanPointInPolygon(point, feature);
    });

    if (insideHospitals.length > 0) {
      resultParts.push(`Healthcare centre count: <strong>${insideHospitals.length}</strong>`);
      resultParts.push('Click a hospital marker to see its name.');
    } else {
      resultParts.push('No healthcare locations found inside this dzongkhag.');
    }
  } else {
    resultParts.push('Healthcare data is not loaded yet.');
  }

  return resultParts.join('<br><br>');
}

map.on(L.Draw.Event.CREATED, function(event) {
  enableDrawInteractions();
  const layer = event.layer;
  const type = event.layerType;
  let resultText = '';

  if (type === 'polyline') {
    const coords = layer.getLatLngs().map(p => [p.lng, p.lat]);
    const lengthKm = turf.length(turf.lineString(coords), { units: 'kilometers' });
    resultText = `Distance: ${lengthKm.toFixed(3)} km`;
  } else if (type === 'polygon') {
    const latlngs = layer.getLatLngs()[0].map(p => [p.lng, p.lat]);
    if (latlngs.length > 2) {
      latlngs.push(latlngs[0]);
      const areaSqMeters = turf.area(turf.polygon([latlngs]));
      resultText = `Area: ${areaSqMeters.toFixed(2)} m²`;
    }
  } else if (type === 'circle') {
    const center = [layer.getLatLng().lng, layer.getLatLng().lat];
    const radiusKm = layer.getRadius() / 1000;
    const circlePolygon = turf.circle(center, radiusKm, {
      steps: 64,
      units: 'kilometers'
    });

    let resultParts = [];

    if (dzongkhagGeoJsonData && dzongkhagGeoJsonData.features) {
      const insideDzongkhags = dzongkhagGeoJsonData.features.filter(feature => {
        return turf.booleanIntersects(circlePolygon, feature);
      });
      if (insideDzongkhags.length > 0) {
        const dzongkhagNames = insideDzongkhags.map(feature => feature.properties.Dzongkhag || feature.properties.adm1_name || 'Unknown');
        resultParts.push(`Dzongkhag(s): <strong>${[...new Set(dzongkhagNames)].join(', ')}</strong>`);
      } else {
        resultParts.push('No dzongkhag boundary intersects this circle.');
      }
    } else {
      resultParts.push('Dzongkhag data is not loaded yet.');
    }

    if (hospitalGeoJsonData && hospitalGeoJsonData.features) {
      const inside = hospitalGeoJsonData.features.filter(feature => {
        const point = turf.point(feature.geometry.coordinates);
        return turf.booleanPointInPolygon(point, circlePolygon);
      });
      if (inside.length > 0) {
        const maxItems = 20;
        const names = inside.map(feature => feature.properties.name_new || feature.properties.name_old || 'Unknown');
        const listItems = names.slice(0, maxItems).map(name => `• ${name}`).join('<br>');
        resultParts.push(`Selected ${inside.length} healthcare centre(s):<br>${listItems}`);
        if (inside.length > maxItems) {
          resultParts.push(`...and ${inside.length - maxItems} more`);
        }
      } else {
        resultParts.push('No healthcare locations found inside this circle.');
      }
    } else {
      resultParts.push('Healthcare data is not loaded yet.');
    }

    resultText = resultParts.join('<br><br>');
  }

  if (resultText) {
    layer.bindPopup(resultText, { maxWidth: 400 }).openPopup();
  }

  drawnItems.addLayer(layer);
});

function toggleLegend() {
  const legend = document.getElementById("legendCard");

  if (legend.style.display === "none") {
    legend.style.display = "block";
  } else {
    legend.style.display = "none";
  }
}