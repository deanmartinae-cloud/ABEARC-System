const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'src', 'frontend', 'data', 'davao-city-boundary.geojson');
const SERVICE = 'https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA/MunicipalPopMF/MapServer/2/query';
const TOLERANCE_DEGREES = 0.00005;

const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const ratio = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) { x = end[0]; y = end[1]; }
    else if (ratio > 0) { x += dx * ratio; y += dy * ratio; }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};

const simplifyOpenLine = (points, tolerance) => {
  if (points.length <= 2) return points.slice();
  const threshold = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maximum = threshold;
    let selected = -1;
    for (let index = first + 1; index < last; index++) {
      const distance = squaredSegmentDistance(points[index], points[first], points[last]);
      if (distance > maximum) { maximum = distance; selected = index; }
    }
    if (selected < 0) continue;
    markers[selected] = 1;
    stack.push([first, selected], [selected, last]);
  }
  return points.filter((_, index) => markers[index]);
};

const simplifyRing = (ring, tolerance) => {
  const points = ring.slice();
  if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
  if (points.length < 4) return [...points, points[0]];
  const anchor = points.reduce((best, point, index) => point[0] < points[best][0] ? index : best, 0);
  const rotated = [...points.slice(anchor), ...points.slice(0, anchor)];
  let split = 1;
  let farthest = -1;
  for (let index = 1; index < rotated.length; index++) {
    const dx = rotated[index][0] - rotated[0][0];
    const dy = rotated[index][1] - rotated[0][1];
    const distance = dx * dx + dy * dy;
    if (distance > farthest) { farthest = distance; split = index; }
  }
  const first = simplifyOpenLine(rotated.slice(0, split + 1), tolerance);
  const second = simplifyOpenLine([...rotated.slice(split), rotated[0]], tolerance);
  return [...first, ...second.slice(1)];
};

const visitCoordinates = (node, callback) => {
  if (Array.isArray(node) && node.length >= 2 && Number.isFinite(node[0]) && Number.isFinite(node[1])) callback(node);
  else if (Array.isArray(node)) node.forEach(child => visitCoordinates(child, callback));
};

(async () => {
  const params = new URLSearchParams({
    where: "city_name = 'Davao City'",
    outFields: 'city_name,city_code,psgc_10d,munarea_sqkm',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    f: 'geojson'
  });
  const response = await fetch(`${SERVICE}?${params}`, {
    headers: { 'User-Agent': 'ABEARC-Davao-Boundary-Updater/1.0' },
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`GeoRiskPH boundary request returned HTTP ${response.status}.`);
  const source = await response.json();
  const feature = source?.features?.[0];
  if (!feature || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw new Error('GeoRiskPH did not return the Davao City polygon.');
  const simplifyPolygon = polygon => polygon.map(ring => simplifyRing(ring, TOLERANCE_DEGREES));
  const coordinates = feature.geometry.type === 'Polygon'
    ? simplifyPolygon(feature.geometry.coordinates)
    : feature.geometry.coordinates.map(simplifyPolygon);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  let points = 0;
  visitCoordinates(coordinates, coordinate => {
    bounds[0] = Math.min(bounds[0], coordinate[0]);
    bounds[1] = Math.min(bounds[1], coordinate[1]);
    bounds[2] = Math.max(bounds[2], coordinate[0]);
    bounds[3] = Math.max(bounds[3], coordinate[1]);
    points++;
  });
  if (points < 100 || bounds.some(value => !Number.isFinite(value))
      || bounds[0] < 125 || bounds[2] > 126 || bounds[1] < 6.5 || bounds[3] > 8) {
    throw new Error('The returned Davao City boundary failed geometry validation.');
  }
  const output = {
    type: 'FeatureCollection',
    bbox: bounds,
    features: [{
      type: 'Feature',
      properties: {
        name: 'City of Davao',
        city_name: feature.properties.city_name,
        city_code: feature.properties.city_code,
        psgc_10d: feature.properties.psgc_10d,
        area_sqkm: feature.properties.munarea_sqkm,
        source: 'PSA Municipal Boundary via GeoRiskPH',
        source_url: 'https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA/MunicipalPopMF/MapServer/2'
      },
      geometry: { type: feature.geometry.type, coordinates }
    }]
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`, 'utf8');
  console.log(`Davao City boundary updated: ${points.toLocaleString()} points; bbox ${bounds.join(', ')}.`);
})().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
