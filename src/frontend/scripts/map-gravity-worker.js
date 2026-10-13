// The routing code is shared with the map; only terrain I/O crosses to the page.
self.window = self;
let ABEARC_MAP_ELEVATION_SOURCES, ABEARC_MAP_ELEVATION_RESOLUTION_M;
let ABEARC_MAP_DEFAULT_ELEVATION_SOURCE, abearcMapElevationSource;
let requestSequence = 0;
const pendingTerrain = new Map();
function terrainRequest(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++requestSequence;
    pendingTerrain.set(id, { resolve, reject });
    self.postMessage({ type, id, ...payload });
  });
}
function requestAbearcElevations(locations) { return terrainRequest('elevations', { locations }); }
function haversineMetres(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2
    + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742017.6 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
importScripts(`19-map-gravity-path.js${self.location.search}`);
updateAbearcGravityProgress = (percent, stage, detail) => self.postMessage({ type: 'progress', percent, stage, detail });
abearcGravityFetchServerPath = (_start, _end, _signal, _sourceKey, corridorM) => terrainRequest('native', { corridorM });
self.onmessage = async ({ data }) => {
  if (data.type === 'response') {
    const pending = pendingTerrain.get(data.id);
    if (!pending) return;
    pendingTerrain.delete(data.id);
    if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
    return;
  }
  if (data.type !== 'start') return;
  ABEARC_MAP_ELEVATION_RESOLUTION_M = data.resolutions;
  ABEARC_MAP_ELEVATION_SOURCES = new Set(Object.keys(data.resolutions));
  ABEARC_MAP_DEFAULT_ELEVATION_SOURCE = abearcMapElevationSource = data.sourceKey;
  abearcGravityVisibleContourDatasets = () => data.contours;
  try {
    const result = await abearcGravityRunSearch(data.start, data.end, null, abearcMapGravityPathRequestId, data.sourceKey, data.preferUniformSlope, data.routingMode);
    // Large sampled grids and validation arrays are only needed inside this worker.
    if (result.indexes?.length) {
      result.plan.locations = result.indexes.map(index => result.plan.locations[index]);
      result.elevations = result.indexes.map(index => result.elevations[index]);
      result.indexes = result.plan.locations.map((_, index) => index);
      delete result.plan.local;
      delete result.plan.activeMask;
      if (result.finalTerrainValidation) {
        delete result.finalTerrainValidation.locations;
        delete result.finalTerrainValidation.elevations;
      }
    }
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
