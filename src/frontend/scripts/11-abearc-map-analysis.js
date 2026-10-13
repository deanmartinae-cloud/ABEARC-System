(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.abearcMapAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const EARTH_RADIUS_M = 6371008.8;

  function haversineMetres(a, b) {
    const toRadians = value => value * Math.PI / 180;
    const latitudeA = toRadians(a[1]);
    const latitudeB = toRadians(b[1]);
    const latitudeDelta = latitudeB - latitudeA;
    const longitudeDelta = toRadians(b[0] - a[0]);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const a = polygon[index], b = polygon[previous];
      const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
      if (Math.abs(cross) < 1e-10
          && point[0] >= Math.min(a[0], b[0]) - 1e-10 && point[0] <= Math.max(a[0], b[0]) + 1e-10
          && point[1] >= Math.min(a[1], b[1]) - 1e-10 && point[1] <= Math.max(a[1], b[1]) + 1e-10) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1])
          && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function interiorElevations(grid, polygon) {
    return grid
      .filter(point => pointInPolygon([point.longitude, point.latitude], polygon))
      .map(point => Number(point.elevation))
      .filter(Number.isFinite);
  }

  function planContourGrids(polygons, sourceResolutionM, options = {}) {
    const maxPolygons = Number(options.maxPolygons || 12);
    const maxSamples = Number(options.maxSamples || 8000);
    const resolution = Number(sourceResolutionM);
    if (!Array.isArray(polygons) || !polygons.length) throw new Error('Select at least one polygon.');
    if (polygons.length > maxPolygons) throw new Error(`Generate contours for at most ${maxPolygons} polygons at a time.`);
    if (!(resolution > 0)) throw new Error('The elevation source has no valid resolution.');
    const dimensions = polygons.map(polygon => {
      const longitudes = polygon.map(point => Number(point[0]));
      const latitudes = polygon.map(point => Number(point[1]));
      const west = Math.min(...longitudes), east = Math.max(...longitudes);
      const south = Math.min(...latitudes), north = Math.max(...latitudes);
      const middleLatitude = (south + north) / 2;
      const widthM = haversineMetres([west, middleLatitude], [east, middleLatitude]);
      const heightM = haversineMetres([(west + east) / 2, south], [(west + east) / 2, north]);
      if (!(widthM > 0) || !(heightM > 0)) throw new Error('A selected polygon has no measurable width or height.');
      return { polygon, west, east, south, north, widthM, heightM };
    });
    const makePlans = scale => dimensions.map(item => {
      const spacing = resolution * scale;
      const columns = Math.max(3, Math.ceil(item.widthM / spacing) + 1);
      const rows = Math.max(3, Math.ceil(item.heightM / spacing) + 1);
      return {
        ...item,
        columns,
        rows,
        samples: columns * rows,
        effectiveSpacingM: Math.max(item.widthM / (columns - 1), item.heightM / (rows - 1))
      };
    });
    let scale = 1;
    let plans = makePlans(scale);
    let totalSamples = plans.reduce((sum, plan) => sum + plan.samples, 0);
    for (let attempt = 0; totalSamples > maxSamples && attempt < 12; attempt++) {
      scale *= Math.sqrt(totalSamples / maxSamples) * 1.02;
      plans = makePlans(scale);
      totalSamples = plans.reduce((sum, plan) => sum + plan.samples, 0);
    }
    if (totalSamples > maxSamples) throw new Error('The selected polygons exceed the contour sampling limit.');
    return {
      plans,
      totalSamples,
      sourceResolutionM: resolution,
      effectiveSpacingM: Math.max(...plans.map(plan => plan.effectiveSpacingM))
    };
  }

  function userStorageKey(base, userId) {
    return `${base}:${String(userId || 'default')}`;
  }

  function userStorageValue(storage, base, userId) {
    const key = userStorageKey(base, userId);
    const scoped = storage.getItem(key);
    if (scoped !== null) return scoped;
    const legacy = storage.getItem(base);
    if (legacy !== null) storage.setItem(key, legacy);
    return legacy;
  }

  function clusterPhotoPoints(items, radius) {
    const cells = new Map();
    const groups = [];
    // Fixed seeds keep groups compact rather than chaining across the map.
    for (const item of [...items].sort((a, b) => a.id - b.id)) {
      const cx = Math.floor(item.x / radius), cy = Math.floor(item.y / radius);
      let nearest = null, best = radius * radius;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const group of cells.get(`${cx + dx}:${cy + dy}`) || []) {
            const distance = (item.x - group[0].x) ** 2 + (item.y - group[0].y) ** 2;
            if (distance <= best) { nearest = group; best = distance; }
          }
        }
      }
      if (nearest) nearest.push(item);
      else {
        const group = [item], key = `${cx}:${cy}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(group);
        groups.push(group);
      }
    }
    return groups;
  }

  return { clusterPhotoPoints, haversineMetres, pointInPolygon, interiorElevations, planContourGrids, userStorageKey, userStorageValue };
});
