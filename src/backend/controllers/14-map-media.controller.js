const __routeController197 = (req, res) => {
  res.json(mapMediaConfig);
};

const __routeController224 = async (req, res) => {
  try {
    const tile = await renderMapZoningTile(req.params.z, req.params.x, req.params.y);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
      'Content-Length': tile.length
    });
    res.send(tile);
  } catch (err) {
    logError('MAP_ZONING_TILE_FAILED', err.message, err.stack);
    res.status(err.statusCode || 503).json({ error: err.statusCode === 400 ? err.message : 'Zoning map layer is temporarily unavailable.' });
  }
};

const __routeController300 = async (req, res) => {
  try {
    res.json(await getMapZoningLabels(req.query));
  } catch (err) {
    logError('MAP_ZONING_LABELS_FAILED', err.message, err.stack);
    res.status(err.statusCode || 503).json({ error: err.statusCode === 400 ? err.message : 'Zoning labels are temporarily unavailable.' });
  }
};

const __routeController301 = async (req, res) => {
  try {
    res.json(await getMapCoordinateInfo(req.query.latitude, req.query.longitude));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode === 400 ? err.message : 'Location information is temporarily unavailable.' });
  }
};

const __routeController302 = async (req, res) => {
  try {
    res.json(await getMapAdministrativeBoundary(req.query.query, req.query.type, req.query.code));
  } catch (err) {
    res.status(err.statusCode || 503).json({ error: err.statusCode === 400 ? err.message : 'Offline administrative boundary database is unavailable.' });
  }
};

const __routeController305 = async (req, res) => {
  try {
    res.json({
      source: MAP_ADMIN_BOUNDARIES_SOURCE,
      offline_only: true,
      results: getMapAdministrativeSearch(req.query.q || req.query.query || '', req.query.limit)
    });
  } catch (err) {
    res.status(err.statusCode || 503).json({ error: err.message || 'Offline administrative boundary search is unavailable.' });
  }
};

const mapElevationSources = {
  'namria-dtm5-prs92': { label: 'NAMRIA DTM 5 m (PRS92)', resolutionM: 5, provider: 'namria-local' },
  'aws-copernicus-glo30': { label: 'AWS Copernicus GLO-30 DSM', resolutionM: 30, provider: 'aws-copernicus', cogCode: '10', bucket: 'copernicus-dem-30m' },
  'copernicus-glo90': { label: 'Copernicus GLO-90 DSM', resolutionM: 90, provider: 'open-meteo' },
  'aws-copernicus-glo90': { label: 'AWS Copernicus GLO-90 DSM', resolutionM: 90, provider: 'aws-copernicus', cogCode: '30', bucket: 'copernicus-dem-90m' },
  'aws-mapzen': { label: 'AWS Terrain Tiles (Mapzen)', resolutionM: 30, provider: 'aws-mapzen' },
  'opentopo-srtm30': { label: 'Open Topo Data SRTM Radar DEM', resolutionM: 30, provider: 'open-topodata', dataset: 'srtm30m' }
};
const mapElevationCogCache = new Map();
let mapElevationNamriaImagePromise = null;

const mapElevationNamriaRasterPath = () => {
  const localSource = 'D:\\Special Project\\Data Source\\NAMRIA\\DTM\\DTM_5m.tif';
  return [MAP_NAMRIA_DTM_PATH, process.platform === 'win32' ? localSource : ''].find(file => file && fs.existsSync(file)) || MAP_NAMRIA_DTM_PATH;
};

const mapElevationNamria = async (locations, signal) => {
  const rasterPath = mapElevationNamriaRasterPath();
  if (!fs.existsSync(rasterPath)) {
    const error = new Error(`NAMRIA DTM is not installed at ${rasterPath}.`);
    error.statusCode = 503;
    throw error;
  }
  if (!mapElevationNamriaImagePromise) {
    mapElevationNamriaImagePromise = import('geotiff')
      .then(({ fromFile }) => fromFile(rasterPath))
      .then(tiff => tiff.getImage())
      .catch(error => {
        mapElevationNamriaImagePromise = null;
        throw error;
      });
  }
  const image = await mapElevationNamriaImagePromise;
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  const width = image.getWidth();
  const height = image.getHeight();
  const noData = Number(image.getGDALNoData());
  const blockWidth = image.getTileWidth?.() || 256;
  const blockHeight = image.getTileHeight?.() || 256;

  // IMPORTANT: sample the NAMRIA raster using the same cell-centre bilinear
  // surface used by the gravity-flow sub-cell router. The old implementation
  // returned the value of the containing 5 m cell (floor/nearest sampling).
  // That made a mathematically level contour appear to rise/fall whenever the
  // line crossed a raster-cell boundary, and the strict final gravity-profile
  // validator could then reject an otherwise valid contour-following route.
  const queries = locations.map((location, index) => {
    const rasterX = (Number(location.longitude) - originX) / resolutionX - 0.5;
    const rasterY = (Number(location.latitude) - originY) / resolutionY - 0.5;
    if (!Number.isFinite(rasterX) || !Number.isFinite(rasterY)
        || rasterX < -0.5 || rasterX > width - 0.5
        || rasterY < -0.5 || rasterY > height - 0.5) {
      const error = new Error('The selected measurement extends beyond the NAMRIA DTM coverage.');
      error.statusCode = 422;
      throw error;
    }
    const clampedX = Math.max(0, Math.min(width - 1, rasterX));
    const clampedY = Math.max(0, Math.min(height - 1, rasterY));
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(clampedX)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(clampedY)));
    const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
    const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
    return {
      index, x0, y0, x1, y1,
      tx: x1 === x0 ? 0 : Math.max(0, Math.min(1, clampedX - x0)),
      ty: y1 === y0 ? 0 : Math.max(0, Math.min(1, clampedY - y0))
    };
  });

  const blocks = new Map();
  const blockKeys = new Set();
  const blockKeyForPixel = (pixelX, pixelY) => `${Math.floor(pixelX / blockWidth)}/${Math.floor(pixelY / blockHeight)}`;
  for (const query of queries) {
    blockKeys.add(blockKeyForPixel(query.x0, query.y0));
    blockKeys.add(blockKeyForPixel(query.x1, query.y0));
    blockKeys.add(blockKeyForPixel(query.x0, query.y1));
    blockKeys.add(blockKeyForPixel(query.x1, query.y1));
  }

  for (const key of blockKeys) {
    if (signal?.aborted) {
      const error = new Error('Request was aborted');
      error.name = 'AbortError';
      throw error;
    }
    const [blockX, blockY] = key.split('/').map(Number);
    const left = blockX * blockWidth;
    const top = blockY * blockHeight;
    const right = Math.min(width, left + blockWidth);
    const bottom = Math.min(height, top + blockHeight);
    const [band] = await image.readRasters({ window: [left, top, right, bottom], samples: [0], signal });
    blocks.set(key, { left, top, width: right - left, band });
  }

  const pixelValue = (pixelX, pixelY) => {
    const block = blocks.get(blockKeyForPixel(pixelX, pixelY));
    if (!block) return NaN;
    const value = Number(block.band[(pixelY - block.top) * block.width + pixelX - block.left]);
    if (!Number.isFinite(value) || (Number.isFinite(noData) && value === noData)) return NaN;
    return value;
  };

  const elevations = new Array(locations.length);
  for (const query of queries) {
    const z00 = pixelValue(query.x0, query.y0);
    const z10 = pixelValue(query.x1, query.y0);
    const z01 = pixelValue(query.x0, query.y1);
    const z11 = pixelValue(query.x1, query.y1);
    if (![z00, z10, z01, z11].every(Number.isFinite)) {
      const error = new Error('The selected measurement crosses an area without NAMRIA DTM coverage.');
      error.statusCode = 422;
      throw error;
    }
    const top = z00 + (z10 - z00) * query.tx;
    const bottom = z01 + (z11 - z01) * query.tx;
    elevations[query.index] = top + (bottom - top) * query.ty;
  }
  return elevations;
};


const mapGravityHeap = class {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  before(a, b) { return a.ascent < b.ascent || (a.ascent === b.ascent && a.priority < b.priority); }
  push(priority, node, ascent = 0) {
    const item = { priority, node, ascent };
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(item, items[parent])) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const tail = items.pop();
    if (!items.length) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      const child = right < items.length && this.before(items[right], items[left]) ? right : left;
      if (!this.before(items[child], tail)) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = tail;
    return root;
  }
};

const mapGravityPixelDistanceToSegment = (column, row, startColumn, startRow, endColumn, endRow, pixelWidthM, pixelHeightM) => {
  const px = (column - startColumn) * pixelWidthM;
  const py = (row - startRow) * pixelHeightM;
  const bx = (endColumn - startColumn) * pixelWidthM;
  const by = (endRow - startRow) * pixelHeightM;
  const length2 = bx * bx + by * by;
  if (!(length2 > 0)) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / length2));
  return Math.hypot(px - bx * t, py - by * t);
};

const mapGravityRasterLineIndexes = (fromIndex, toIndex, width) => {
  let x0 = fromIndex % width;
  let y0 = Math.floor(fromIndex / width);
  const x1 = toIndex % width;
  const y1 = Math.floor(toIndex / width);
  const output = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  for (let guard = 0; guard <= width * 4 + 100000; guard++) {
    output.push(y0 * width + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
  return output;
};

const mapGravityRasterSegmentIsNonAscending = (fromIndex, toIndex, width, elevations, toleranceM) => {
  const indexes = mapGravityRasterLineIndexes(fromIndex, toIndex, width);
  if (!indexes.length) return false;
  let previous = Number(elevations[indexes[0]]);
  if (!Number.isFinite(previous)) return false;
  for (let i = 1; i < indexes.length; i++) {
    const current = Number(elevations[indexes[i]]);
    if (!Number.isFinite(current) || current > previous + toleranceM) return false;
    previous = current;
  }
  return true;
};


const mapGravityCompressRasterPathTurns = (path, width) => {
  if (!Array.isArray(path) || path.length <= 2) return path || [];
  const output = [path[0]];
  let previousDirection = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const ac = a % width, ar = Math.floor(a / width);
    const bc = b % width, br = Math.floor(b / width);
    const direction = `${Math.sign(bc - ac)},${Math.sign(br - ar)}`;
    if (previousDirection !== null && direction !== previousDirection) output.push(a);
    previousDirection = direction;
  }
  if (output[output.length - 1] !== path[path.length - 1]) output.push(path[path.length - 1]);
  return output;
};

const mapGravitySimplifyRasterPath = (path, width, elevations, toleranceM) => {
  if (!Array.isArray(path) || path.length <= 2) return path || [];
  const output = [path[0]];
  let cursor = 0;
  while (cursor < path.length - 1) {
    let candidate = Math.min(path.length - 1, cursor + 80);
    while (candidate > cursor + 1 && !mapGravityRasterSegmentIsNonAscending(path[cursor], path[candidate], width, elevations, toleranceM)) candidate--;
    if (candidate <= cursor) candidate = cursor + 1;
    output.push(path[candidate]);
    cursor = candidate;
  }
  return output;
};

const mapGravityFindRasterPath = ({
  elevations, width, height, activeMask, startIndex, endIndex,
  pixelWidthM, pixelHeightM, ascentToleranceM = 0.10,
  ascentPenalty = 0, maximumStepAscentM = ascentToleranceM
}) => {
  const count = width * height;
  if (!elevations || elevations.length !== count || startIndex < 0 || endIndex < 0 || startIndex >= count || endIndex >= count) return null;
  const startElevation = Number(elevations[startIndex]);
  const endElevation = Number(elevations[endIndex]);
  if (!Number.isFinite(startElevation) || !Number.isFinite(endElevation) || endElevation > startElevation + maximumStepAscentM) return null;
  const costs = new Float64Array(count);
  costs.fill(Infinity);
  const previous = new Int32Array(count);
  previous.fill(-1);
  const totalAscent = new Float64Array(count);
  totalAscent.fill(Infinity);
  const closed = new Uint8Array(count);
  const heap = new mapGravityHeap();
  const endColumn = endIndex % width;
  const endRow = Math.floor(endIndex / width);
  costs[startIndex] = 0;
  totalAscent[startIndex] = 0;
  heap.push(0, startIndex);
  const neighbors = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  while (heap.size) {
    const entry = heap.pop();
    const current = entry.node;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === endIndex) break;
    const row = Math.floor(current / width);
    const column = current % width;
    const currentElevation = Number(elevations[current]);
    if (!Number.isFinite(currentElevation)) continue;
    for (const [dr, dc] of neighbors) {
      const nr = row + dr, nc = column + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const next = nr * width + nc;
      if (closed[next] || (activeMask && !activeMask[next])) continue;
      const nextElevation = Number(elevations[next]);
      if (!Number.isFinite(nextElevation)) continue;
      const rise = Math.max(0, nextElevation - currentElevation);
      if (rise > maximumStepAscentM + 1e-9) continue;
      const stepDistance = Math.hypot(dc * pixelWidthM, dr * pixelHeightM);
      const nextTotalAscent = totalAscent[current] + rise;
      const nextCost = costs[current] + stepDistance + rise * ascentPenalty;
      if (nextCost >= costs[next] - 1e-9) continue;
      costs[next] = nextCost;
      totalAscent[next] = nextTotalAscent;
      previous[next] = current;
      const dx = (endColumn - nc) * pixelWidthM;
      const dy = (endRow - nr) * pixelHeightM;
      heap.push(nextCost + Math.hypot(dx, dy), next);
    }
  }
  if (endIndex !== startIndex && previous[endIndex] < 0) return null;
  const path = [];
  for (let cursor = endIndex, guard = 0; cursor >= 0 && guard <= count + 1; guard++) {
    path.push(cursor);
    if (cursor === startIndex) break;
    cursor = previous[cursor];
    if (cursor < 0) return null;
  }
  path.reverse();
  let maximumRawStepAscentM = 0;
  let totalRawAscentM = 0;
  for (let i = 1; i < path.length; i++) {
    const rise = Number(elevations[path[i]]) - Number(elevations[path[i - 1]]);
    if (rise > 0) {
      maximumRawStepAscentM = Math.max(maximumRawStepAscentM, rise);
      totalRawAscentM += rise;
    }
  }
  return { path, maximumRawStepAscentM, totalRawAscentM, cost: costs[endIndex] };
};



// Reverse gravity reachability: start at the outlet (Point 2) and expand
// uphill through terrain locations that could drain back to the already
// reachable region. This separates feasibility from route extraction and
// avoids committing early to one downhill branch from Point 1.
//
// On refined/interpolated terrain grids the search can also use a small set of
// short any-angle "escape" moves when the ordinary 8-neighbour lattice is
// locally trapped by contour orientation. Every escape segment is sampled on
// the continuous grid surface and is accepted only when the corresponding
// forward segment (high -> low) remains non-ascending. Thus the extra
// connectivity does not relax the gravity rule.
const mapGravityPrimitiveEscapeOffsets = maximumEscapeRadius => {
  const maxRadius = Math.max(2, Math.min(4, Math.round(Number(maximumEscapeRadius) || 3)));
  const offsets = [];
  const gcd = (x, y) => {
    x = Math.abs(x); y = Math.abs(y);
    while (y) { const t = x % y; x = y; y = t; }
    return x || 1;
  };
  for (let radius = 2; radius <= maxRadius; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (!dr && !dc) continue;
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        // Primitive directions only. Multiples such as 2:2 duplicate the
        // ordinary 8-neighbour lattice and add cost without adding topology.
        if (gcd(dr, dc) !== 1) continue;
        offsets.push([dr, dc]);
      }
    }
  }
  return offsets;
};

const mapGravityContinuousGridSampler = (elevations, width, height) => (x, y) => {
  // Ignore arithmetic roundoff at grid lines; zero-weight neighbors may be NoData.
  if (Math.abs(x - Math.round(x)) < 1e-9) x = Math.round(x);
  if (Math.abs(y - Math.round(y)) < 1e-9) y = Math.round(y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width - 1 || y > height - 1) return NaN;
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(width - 1, Math.ceil(x)));
  const y1 = Math.max(0, Math.min(height - 1, Math.ceil(y)));
  const z00 = Number(elevations[y0 * width + x0]);
  const z10 = Number(elevations[y0 * width + x1]);
  const z01 = Number(elevations[y1 * width + x0]);
  const z11 = Number(elevations[y1 * width + x1]);
  if (![z00,z10,z01,z11].every(Number.isFinite)) return NaN;
  const tx = x - x0, ty = y - y0;
  const top = z00 + (z10 - z00) * tx;
  const bottom = z01 + (z11 - z01) * tx;
  return top + (bottom - top) * ty;
};

const mapGravityContinuousSegmentAscent = ({
  elevationAt, fromRow, fromColumn, toRow, toColumn, ascentToleranceM = 0.10
}) => {
  const dx = toColumn - fromColumn, dy = toRow - fromRow;
  const cells = Math.hypot(dx, dy);
  // Axis-aligned one-cell links are linear on a bilinear surface. Diagonal and
  // any-angle links receive denser checks so an interior saddle/hump cannot be
  // skipped simply because both endpoints are lower.
  const samples = Math.max(1, Math.ceil(cells / (Math.abs(dx) < 1e-12 || Math.abs(dy) < 1e-12 ? 0.75 : 0.35)));
  let previous = elevationAt(fromColumn, fromRow);
  if (!Number.isFinite(previous)) return null;
  let ascent = 0;
  for (let step = 1; step <= samples; step++) {
    const t = step / samples;
    const current = elevationAt(fromColumn + dx * t, fromRow + dy * t);
    if (!Number.isFinite(current) || current > previous + ascentToleranceM + 1e-9) return null;
    ascent += Math.max(0, current - previous - 1e-9);
    previous = current;
  }
  return ascent;
};

const mapGravityContinuousSegmentIsNonAscending = args => mapGravityContinuousSegmentAscent(args) !== null;

// Phase 1: build the outlet-reachable terrain mask independently of route
// extraction. Starting at Point 2, expand only to cells whose corresponding
// FORWARD segment (candidate -> current) stays level or descends. This keeps
// every feasible branch instead of committing to the first backward tree that
// happens to touch Point 1.
const mapGravityBuildReverseReachableMask = ({
  elevations, width, height, activeMask, startIndex, endIndex,
  ascentToleranceM = 0.10, allowAnyAngleEscapes = false, maximumEscapeRadius = 3
}) => {
  const count = width * height;
  if (!elevations || elevations.length !== count || startIndex < 0 || endIndex < 0 || startIndex >= count || endIndex >= count) return null;
  const startElevation = Number(elevations[startIndex]);
  const endElevation = Number(elevations[endIndex]);
  if (!Number.isFinite(startElevation) || !Number.isFinite(endElevation) || endElevation > startElevation + ascentToleranceM) return null;

  const reachableMask = new Uint8Array(count);
  const bottleneckMask = new Uint8Array(count);
  // For nodes first reached through a bottleneck-only any-angle edge, retain
  // the exact downstream bridge so the later forward A* can reproduce the
  // same verified connection instead of only inheriting its endpoint mask.
  const escapeTowardOutlet = new Int32Array(count); escapeTowardOutlet.fill(-1);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  queue[tail++] = endIndex;
  reachableMask[endIndex] = 1;
  const elevationAt = mapGravityContinuousGridSampler(elevations, width, height);
  const baseOffsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const escapeOffsets = allowAnyAngleEscapes ? mapGravityPrimitiveEscapeOffsets(maximumEscapeRadius) : [];
  let reachableCount = 1;
  let bottleneckCount = 0;
  let anyAngleEdgesAdded = 0;

  const candidateIsValidPredecessor = (currentRow, currentColumn, nextRow, nextColumn) => {
    if (nextRow < 0 || nextRow >= height || nextColumn < 0 || nextColumn >= width) return false;
    const next = nextRow * width + nextColumn;
    if (activeMask && !activeMask[next]) return false;
    const current = currentRow * width + currentColumn;
    const currentElevation = Number(elevations[current]);
    const nextElevation = Number(elevations[next]);
    if (!Number.isFinite(currentElevation) || !Number.isFinite(nextElevation)) return false;
    // Reverse traversal can only step to equal/higher ground because the real
    // route runs in the opposite direction toward the outlet.
    if (nextElevation < currentElevation - ascentToleranceM - 1e-9) return false;
    return mapGravityContinuousSegmentIsNonAscending({
      elevationAt,
      fromRow: nextRow, fromColumn: nextColumn,
      toRow: currentRow, toColumn: currentColumn,
      ascentToleranceM
    });
  };

  while (head < tail) {
    const current = queue[head++];
    const currentRow = Math.floor(current / width);
    const currentColumn = current % width;
    let ordinaryConnectivity = 0;
    const newlyReachable = [];
    for (const [dr, dc] of baseOffsets) {
      const nr = currentRow + dr, nc = currentColumn + dc;
      if (!candidateIsValidPredecessor(currentRow, currentColumn, nr, nc)) continue;
      ordinaryConnectivity++;
      const next = nr * width + nc;
      if (!reachableMask[next]) newlyReachable.push(next);
    }
    for (const next of newlyReachable) {
      reachableMask[next] = 1;
      queue[tail++] = next;
      reachableCount++;
    }

    // Any-angle work is intentionally confined to low-connectivity cells. It
    // is a topology rescue, not a global shortcut graph. Each candidate link
    // is still sampled continuously and must obey the same 0.10 m tolerance.
    if (allowAnyAngleEscapes && ordinaryConnectivity <= 2) {
      bottleneckMask[current] = 1;
      bottleneckCount++;
      let acceptedHere = 0;
      for (const [dr, dc] of escapeOffsets) {
        const nr = currentRow + dr, nc = currentColumn + dc;
        if (!candidateIsValidPredecessor(currentRow, currentColumn, nr, nc)) continue;
        const next = nr * width + nc;
        if (reachableMask[next]) continue;
        reachableMask[next] = 1;
        escapeTowardOutlet[next] = current;
        queue[tail++] = next;
        reachableCount++;
        acceptedHere++;
        anyAngleEdgesAdded++;
      }
    }
  }

  return {
    reachableMask,
    bottleneckMask,
    escapeTowardOutlet,
    reachableCount,
    bottleneckCount,
    anyAngleEdgesAdded,
    startReachable: Boolean(reachableMask[startIndex]),
    endReachable: Boolean(reachableMask[endIndex])
  };
};

// Phase 2: run a normal forward A* from Point 1 to Point 2, but only through
// terrain proven by Phase 1 to be outlet-reachable. This prevents A* from
// spending work in dead branches and, more importantly, decouples feasibility
// from route selection.
const mapGravityFindMaskedAStarPath = ({
  elevations, width, height, activeMask, reachableMask, bottleneckMask, reverseEscapeTowardOutlet,
  startIndex, endIndex, pixelWidthM, pixelHeightM,
  ascentToleranceM = 0.10, allowAnyAngleEscapes = false, maximumEscapeRadius = 3
}) => {
  const count = width * height;
  if (!elevations || elevations.length !== count || !reachableMask || reachableMask.length !== count) return null;
  if (startIndex < 0 || endIndex < 0 || startIndex >= count || endIndex >= count || !reachableMask[startIndex] || !reachableMask[endIndex]) return null;
  const costs = new Float64Array(count); costs.fill(Infinity);
  const ascents = new Float64Array(count); ascents.fill(Infinity);
  const previous = new Int32Array(count); previous.fill(-1);
  const previousWasAnyAngle = new Uint8Array(count);
  const closed = new Uint8Array(count);
  const heap = new mapGravityHeap();
  const endColumn = endIndex % width;
  const endRow = Math.floor(endIndex / width);
  const elevationAt = mapGravityContinuousGridSampler(elevations, width, height);
  const baseOffsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const escapeOffsets = allowAnyAngleEscapes ? mapGravityPrimitiveEscapeOffsets(maximumEscapeRadius) : [];
  costs[startIndex] = 0;
  ascents[startIndex] = 0;
  heap.push(0, startIndex);
  let expandedCount = 0;
  let anyAngleRelaxations = 0;

  const tryRelax = (current, currentRow, currentColumn, nextRow, nextColumn, isAnyAngle) => {
    if (nextRow < 0 || nextRow >= height || nextColumn < 0 || nextColumn >= width) return false;
    const next = nextRow * width + nextColumn;
    if (closed[next] || !reachableMask[next] || (activeMask && !activeMask[next])) return false;
    const currentElevation = Number(elevations[current]);
    const nextElevation = Number(elevations[next]);
    if (!Number.isFinite(currentElevation) || !Number.isFinite(nextElevation)) return false;
    if (nextElevation > currentElevation + ascentToleranceM + 1e-9) return false;
    const segmentAscent = mapGravityContinuousSegmentAscent({
      elevationAt,
      fromRow: currentRow, fromColumn: currentColumn,
      toRow: nextRow, toColumn: nextColumn,
      ascentToleranceM
    });
    if (segmentAscent === null) return false;
    const stepDistance = Math.hypot((nextColumn - currentColumn) * pixelWidthM, (nextRow - currentRow) * pixelHeightM);
    const nextCost = costs[current] + Math.max(0.001, stepDistance);
    const nextAscent = ascents[current] + segmentAscent;
    if (nextAscent > ascents[next] || (nextAscent === ascents[next] && nextCost >= costs[next] - 1e-9)) return false;
    costs[next] = nextCost;
    ascents[next] = nextAscent;
    previous[next] = current;
    previousWasAnyAngle[next] = isAnyAngle ? 1 : 0;
    const dx = (endColumn - nextColumn) * pixelWidthM;
    const dy = (endRow - nextRow) * pixelHeightM;
    heap.push(nextCost + Math.hypot(dx, dy), next, nextAscent);
    if (isAnyAngle) anyAngleRelaxations++;
    return true;
  };

  while (heap.size) {
    const entry = heap.pop();
    const current = entry.node;
    if (closed[current]) continue;
    closed[current] = 1;
    expandedCount++;
    if (current === endIndex) break;
    const currentRow = Math.floor(current / width);
    const currentColumn = current % width;
    let ordinaryConnectivity = 0;
    for (const [dr, dc] of baseOffsets) {
      const nr = currentRow + dr, nc = currentColumn + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const next = nr * width + nc;
      if (!reachableMask[next] || (activeMask && !activeMask[next])) continue;
      const currentElevation = Number(elevations[current]);
      const nextElevation = Number(elevations[next]);
      if (!Number.isFinite(currentElevation) || !Number.isFinite(nextElevation) || nextElevation > currentElevation + ascentToleranceM + 1e-9) continue;
      ordinaryConnectivity++;
      tryRelax(current, currentRow, currentColumn, nr, nc, false);
    }

    // Reuse the exact bottleneck bridge discovered by the reverse mask. The
    // upstream endpoint itself may have many ordinary neighbors, so relying
    // only on its local degree could otherwise lose a valid reverse-mask edge.
    if (allowAnyAngleEscapes && reverseEscapeTowardOutlet?.[current] >= 0) {
      const bridge = reverseEscapeTowardOutlet[current];
      const bridgeRow = Math.floor(bridge / width), bridgeColumn = bridge % width;
      tryRelax(current, currentRow, currentColumn, bridgeRow, bridgeColumn, true);
    }

    const isBottleneck = Boolean(bottleneckMask?.[current]) || ordinaryConnectivity <= 2;
    if (allowAnyAngleEscapes && isBottleneck) {
      let acceptedHere = 0;
      for (const [dr, dc] of escapeOffsets) {
        if (tryRelax(current, currentRow, currentColumn, currentRow + dr, currentColumn + dc, true)) acceptedHere++;
      }
    }
  }

  if (startIndex !== endIndex && previous[endIndex] < 0) return { path: null, cost: Infinity, expandedCount, anyAngleRelaxations, anyAngleEdgesUsed: 0 };
  const path = [];
  let anyAngleEdgesUsed = 0;
  for (let cursor = endIndex, guard = 0; cursor >= 0 && guard <= count + 1; guard++) {
    path.push(cursor);
    if (cursor === startIndex) break;
    if (previousWasAnyAngle[cursor]) anyAngleEdgesUsed++;
    cursor = previous[cursor];
    if (cursor < 0) return { path: null, cost: Infinity, expandedCount, anyAngleRelaxations, anyAngleEdgesUsed: 0 };
  }
  path.reverse();
  let maximumRawStepAscentM = 0, totalRawAscentM = 0;
  for (let i = 1; i < path.length; i++) {
    const rise = Number(elevations[path[i]]) - Number(elevations[path[i - 1]]);
    if (rise > 0) { maximumRawStepAscentM = Math.max(maximumRawStepAscentM, rise); totalRawAscentM += rise; }
  }
  return {
    path,
    maximumRawStepAscentM,
    totalRawAscentM,
    cost: costs[endIndex],
    expandedCount,
    anyAngleRelaxations,
    anyAngleEdgesUsed
  };
};

// Compatibility wrapper used by the rest of ABEARC. Despite the historical
// name, this now performs a true reverse reachable-mask pass followed by a
// separate masked forward A* route extraction.
const mapGravityFindReverseReachabilityPath = ({
  elevations, width, height, activeMask, startIndex, endIndex,
  pixelWidthM, pixelHeightM, ascentToleranceM = 0.10,
  allowAnyAngleEscapes = false, maximumEscapeRadius = 3
}) => {
  const reverse = mapGravityBuildReverseReachableMask({
    elevations, width, height, activeMask, startIndex, endIndex,
    ascentToleranceM, allowAnyAngleEscapes, maximumEscapeRadius
  });
  if (!reverse) return null;
  if (!reverse.startReachable) {
    return {
      path: null,
      cost: Infinity,
      reachableCount: reverse.reachableCount,
      bottleneckCount: reverse.bottleneckCount,
      anyAngleEdgesUsed: reverse.anyAngleEdgesAdded,
      reverseAnyAngleEdgesAdded: reverse.anyAngleEdgesAdded,
      maskedAStarExpandedCount: 0,
      reachableMask: reverse.reachableMask,
      bottleneckMask: reverse.bottleneckMask,
      reverseEscapeTowardOutlet: reverse.escapeTowardOutlet
    };
  }
  const route = mapGravityFindMaskedAStarPath({
    elevations, width, height, activeMask,
    reachableMask: reverse.reachableMask,
    bottleneckMask: reverse.bottleneckMask,
    reverseEscapeTowardOutlet: reverse.escapeTowardOutlet,
    startIndex, endIndex, pixelWidthM, pixelHeightM,
    ascentToleranceM, allowAnyAngleEscapes, maximumEscapeRadius
  });
  return {
    ...(route || { path: null, cost: Infinity, expandedCount: 0, anyAngleEdgesUsed: 0 }),
    reachableCount: reverse.reachableCount,
    bottleneckCount: reverse.bottleneckCount,
    reverseAnyAngleEdgesAdded: reverse.anyAngleEdgesAdded,
    anyAngleEdgesUsed: Number(route?.anyAngleEdgesUsed) || 0,
    maskedAStarExpandedCount: Number(route?.expandedCount) || 0,
    reachableMask: reverse.reachableMask,
    bottleneckMask: reverse.bottleneckMask,
    reverseEscapeTowardOutlet: reverse.escapeTowardOutlet
  };
};

const mapGravityBilinearElevation = (elevations, width, height, x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width - 1 || y > height - 1) return NaN;
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const z00 = Number(elevations[y0 * width + x0]);
  const z10 = Number(elevations[y0 * width + x1]);
  const z01 = Number(elevations[y1 * width + x0]);
  const z11 = Number(elevations[y1 * width + x1]);
  if (![z00, z10, z01, z11].every(Number.isFinite)) return NaN;
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const top = z00 + (z10 - z00) * tx;
  const bottom = z01 + (z11 - z01) * tx;
  return top + (bottom - top) * ty;
};

// Search the continuous bilinearly interpolated terrain surface rather than
// only the 5 m raster-cell centres. A contour can pass between cell centres;
// centre-only A* can therefore report a false no-path even when a true
// non-ascending line exists on the interpolated DTM surface.
const mapGravityFindInterpolatedRasterPath = ({
  elevations, width, height,
  startX, startY, endX, endY,
  pixelWidthM, pixelHeightM,
  corridorM, factor = 2, ascentToleranceM = 0.10,
  guideRawPoints = null, guideBufferM = 0
}) => {
  const safeFactor = Math.max(2, Math.min(4, Math.round(Number(factor) || 2)));
  const normalizedGuide = Array.isArray(guideRawPoints)
    ? guideRawPoints.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    : [];
  const guided = normalizedGuide.length > 0 && Number(guideBufferM) > 0;
  const boundXs = [Number(startX), Number(endX), ...(guided ? normalizedGuide.map(point => Number(point.x)) : [])];
  const boundYs = [Number(startY), Number(endY), ...(guided ? normalizedGuide.map(point => Number(point.y)) : [])];
  const boundPaddingM = guided ? Math.max(10, Number(guideBufferM) * 1.35) : Math.max(25, Number(corridorM) || 25);
  const padX = Math.ceil(boundPaddingM / pixelWidthM) + 3;
  const padY = Math.ceil(boundPaddingM / pixelHeightM) + 3;
  const cropLeft = Math.max(0, Math.floor(Math.min(...boundXs) - padX));
  const cropRight = Math.min(width - 1, Math.ceil(Math.max(...boundXs) + padX));
  const cropTop = Math.max(0, Math.floor(Math.min(...boundYs) - padY));
  const cropBottom = Math.min(height - 1, Math.ceil(Math.max(...boundYs) + padY));
  const refinedWidth = Math.max(2, Math.round((cropRight - cropLeft) * safeFactor) + 1);
  const refinedHeight = Math.max(2, Math.round((cropBottom - cropTop) * safeFactor) + 1);
  const count = refinedWidth * refinedHeight;
  // Keep the fallback bounded. Larger areas continue to the existing full
  // native/browser fallbacks rather than risking excessive memory use.
  if (count > 3500000) return { attempted: false, reason: 'subcell-grid-too-large', spacingM: Math.max(pixelWidthM, pixelHeightM) / safeFactor };

  const refined = new Float64Array(count);
  const activeMask = new Uint8Array(count);
  // Optional route-guidance mask for coarse-to-fine refinement. Rather than
  // rebuilding a high-resolution grid across the whole terrain corridor, stamp
  // a narrow band around the already viable coarse route. This preserves local
  // detours while keeping 2.5/1.25 m work concentrated where it can matter.
  let guideMask = null;
  if (guided) {
    guideMask = new Uint8Array(count);
    const radiusColumns = Math.max(1, Math.ceil(Number(guideBufferM) / (pixelWidthM / safeFactor)));
    const radiusRows = Math.max(1, Math.ceil(Number(guideBufferM) / (pixelHeightM / safeFactor)));
    const stamp = point => {
      const centerColumn = Math.round((Number(point.x) - cropLeft) * safeFactor);
      const centerRow = Math.round((Number(point.y) - cropTop) * safeFactor);
      const minRow = Math.max(0, centerRow - radiusRows), maxRow = Math.min(refinedHeight - 1, centerRow + radiusRows);
      const minColumn = Math.max(0, centerColumn - radiusColumns), maxColumn = Math.min(refinedWidth - 1, centerColumn + radiusColumns);
      for (let row = minRow; row <= maxRow; row++) {
        const dy = (row - centerRow) / radiusRows;
        for (let column = minColumn; column <= maxColumn; column++) {
          const dx = (column - centerColumn) / radiusColumns;
          if (dx * dx + dy * dy <= 1.05) guideMask[row * refinedWidth + column] = 1;
        }
      }
    };
    normalizedGuide.forEach(stamp);
  }
  const startColumnFloat = (startX - cropLeft) * safeFactor;
  const startRowFloat = (startY - cropTop) * safeFactor;
  const endColumnFloat = (endX - cropLeft) * safeFactor;
  const endRowFloat = (endY - cropTop) * safeFactor;
  const refinedPixelWidthM = pixelWidthM / safeFactor;
  const refinedPixelHeightM = pixelHeightM / safeFactor;
  let activeCount = 0;

  for (let row = 0; row < refinedHeight; row++) {
    const rawY = cropTop + row / safeFactor;
    for (let column = 0; column < refinedWidth; column++) {
      const index = row * refinedWidth + column;
      const rawX = cropLeft + column / safeFactor;
      const elevation = mapGravityBilinearElevation(elevations, width, height, rawX, rawY);
      refined[index] = elevation;
      if (!Number.isFinite(elevation)) continue;
      const distanceToSegmentM = mapGravityPixelDistanceToSegment(
        column, row,
        startColumnFloat, startRowFloat,
        endColumnFloat, endRowFloat,
        refinedPixelWidthM, refinedPixelHeightM
      );
      if ((guideMask || distanceToSegmentM <= Number(corridorM) + Math.max(refinedPixelWidthM, refinedPixelHeightM) * 2)
          && (!guideMask || guideMask[index])) {
        activeMask[index] = 1;
        activeCount++;
      }
    }
  }

  const startColumn = Math.max(0, Math.min(refinedWidth - 1, Math.round(startColumnFloat)));
  const startRow = Math.max(0, Math.min(refinedHeight - 1, Math.round(startRowFloat)));
  const endColumn = Math.max(0, Math.min(refinedWidth - 1, Math.round(endColumnFloat)));
  const endRow = Math.max(0, Math.min(refinedHeight - 1, Math.round(endRowFloat)));
  const startIndex = startRow * refinedWidth + startColumn;
  const endIndex = endRow * refinedWidth + endColumn;
  const exactStartElevation = mapGravityBilinearElevation(elevations, width, height, startX, startY);
  const exactEndElevation = mapGravityBilinearElevation(elevations, width, height, endX, endY);
  if (!Number.isFinite(exactStartElevation) || !Number.isFinite(exactEndElevation)) {
    return { attempted: true, found: false, spacingM: Math.max(refinedPixelWidthM, refinedPixelHeightM), activeCount };
  }
  // Anchor the nearest refined nodes to the exact endpoint interpolations so
  // snapping an endpoint to the subcell lattice cannot invent an artificial rise.
  refined[startIndex] = exactStartElevation;
  refined[endIndex] = exactEndElevation;
  activeMask[startIndex] = 1;
  activeMask[endIndex] = 1;

  const result = mapGravityFindReverseReachabilityPath({
    elevations: refined,
    width: refinedWidth,
    height: refinedHeight,
    activeMask,
    startIndex,
    endIndex,
    pixelWidthM: refinedPixelWidthM,
    pixelHeightM: refinedPixelHeightM,
    ascentToleranceM,
    allowAnyAngleEscapes: true,
    maximumEscapeRadius: safeFactor >= 4 ? 4 : 3
  });
  return {
    attempted: true,
    found: Boolean(result?.path?.length),
    result,
    elevations: refined,
    width: refinedWidth,
    height: refinedHeight,
    cropLeft,
    cropTop,
    factor: safeFactor,
    startIndex,
    endIndex,
    activeCount,
    spacingM: Math.max(refinedPixelWidthM, refinedPixelHeightM),
    pixelWidthM: refinedPixelWidthM,
    pixelHeightM: refinedPixelHeightM,
    exactStartElevation,
    exactEndElevation,
    routeGuided: Boolean(guideMask),
    guideBufferM: guideMask ? Number(guideBufferM) : 0
  };
};



// Build a compact contour network directly from the native NAMRIA raster.
// This is deliberately independent of the map's visible contour layer: the
// gravity tool must be able to reason the same way a user does when looking at
// topographic contours even when no Area measurement currently owns contours.
const mapGravityBuildNativeContourPaths = ({
  elevations, width, height, activeMask,
  originX, originY, resolutionX, resolutionY, left, top,
  minimumLevelM, maximumLevelM, intervalM = 10, maximumSegments = 120000
}) => {
  const interval = Math.max(1, Number(intervalM) || 10);
  const minimum = Math.min(Number(minimumLevelM), Number(maximumLevelM));
  const maximum = Math.max(Number(minimumLevelM), Number(maximumLevelM));
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum - minimum < 0.01) {
    return { paths: [], intervalM: interval, segmentCount: 0, pointCount: 0 };
  }
  const groups = new Map();
  let segmentCount = 0;
  const addSegment = (level, a, b, depth = 0) => {
    if (!a || !b) return true;
    // A bilinear contour curves inside a raster cell. A straight chord can
    // climb off that contour and fail the final 0.10 m terrain check.
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    const sample = (px, py) => mapGravityBilinearElevation(elevations, width, height, px, py);
    if (depth < 12 && Math.abs(sample(x, y) - level) > 0.02) {
      let midpoint;
      if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
        const row = Math.floor(y), low = sample(x, row), high = sample(x, row + 1);
        midpoint = { x, y: row + (level - low) / (high - low) };
      } else {
        const column = Math.floor(x), low = sample(column, y), high = sample(column + 1, y);
        midpoint = { x: column + (level - low) / (high - low), y };
      }
      if (Number.isFinite(midpoint.x) && Number.isFinite(midpoint.y)
          && midpoint.x >= Math.min(a.x, b.x) - 1e-9 && midpoint.x <= Math.max(a.x, b.x) + 1e-9
          && midpoint.y >= Math.min(a.y, b.y) - 1e-9 && midpoint.y <= Math.max(a.y, b.y) + 1e-9) {
        return addSegment(level, a, midpoint, depth + 1) && addSegment(level, midpoint, b, depth + 1);
      }
    }
    const key = Number(level).toFixed(6);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ level: Number(level), points: [a, b] });
    segmentCount++;
    return segmentCount <= maximumSegments;
  };
  const crossing = (ax, ay, az, bx, by, bz, level) => {
    if (!Number.isFinite(az) || !Number.isFinite(bz) || (az < level) === (bz < level) || Math.abs(bz - az) < 1e-12) return null;
    const ratio = (level - az) / (bz - az);
    return { x: ax + (bx - ax) * ratio, y: ay + (by - ay) * ratio };
  };
  let overflow = false;
  for (let row = 0; row < height - 1 && !overflow; row++) {
    for (let column = 0; column < width - 1 && !overflow; column++) {
      const tlIndex = row * width + column;
      const trIndex = tlIndex + 1;
      const blIndex = (row + 1) * width + column;
      const brIndex = blIndex + 1;
      if (activeMask && !activeMask[tlIndex] && !activeMask[trIndex] && !activeMask[blIndex] && !activeMask[brIndex]) continue;
      const tl = Number(elevations[tlIndex]), tr = Number(elevations[trIndex]);
      const br = Number(elevations[brIndex]), bl = Number(elevations[blIndex]);
      if (![tl, tr, br, bl].every(Number.isFinite)) continue;
      const cellMinimum = Math.max(minimum, Math.min(tl, tr, br, bl));
      const cellMaximum = Math.min(maximum, Math.max(tl, tr, br, bl));
      if (!(cellMaximum > cellMinimum + 1e-9)) continue;
      const firstLevel = Math.ceil((cellMinimum - 1e-9) / interval) * interval;
      const lastLevel = Math.floor((cellMaximum + 1e-9) / interval) * interval;
      for (let level = firstLevel; level <= lastLevel + 1e-9; level += interval) {
        if (level < minimum - 1e-9 || level > maximum + 1e-9) continue;
        const edges = [
          crossing(column, row, tl, column + 1, row, tr, level),
          crossing(column + 1, row, tr, column + 1, row + 1, br, level),
          crossing(column + 1, row + 1, br, column, row + 1, bl, level),
          crossing(column, row + 1, bl, column, row, tl, level)
        ];
        const hits = edges.map((point, edge) => point ? { point, edge } : null).filter(Boolean);
        if (hits.length === 2) {
          if (!addSegment(level, hits[0].point, hits[1].point)) { overflow = true; break; }
        } else if (hits.length === 4) {
          const determinant = (tl - level) * (br - level) - (tr - level) * (bl - level);
          const pairs = determinant >= 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
          for (const [a, b] of pairs) {
            if (!addSegment(level, edges[a], edges[b])) { overflow = true; break; }
          }
        }
      }
    }
  }
  if (overflow) return { paths: [], intervalM: interval, segmentCount, pointCount: 0, overflow: true };

  const pointKey = point => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
  const paths = [];
  let pointCount = 0;
  for (const group of groups.values()) {
    if (!group.length) continue;
    const unused = new Set(group.map((_, index) => index));
    const connections = new Map();
    group.forEach((segment, index) => segment.points.forEach(point => {
      const key = pointKey(point);
      if (!connections.has(key)) connections.set(key, []);
      connections.get(key).push(index);
    }));
    const toLngLat = point => [
      originX + (left + point.x + 0.5) * resolutionX,
      originY + (top + point.y + 0.5) * resolutionY
    ];
    const walk = (startIndex, startKey) => {
      const local = [];
      let segmentIndex = startIndex;
      let currentKey = startKey;
      for (let guard = 0; unused.has(segmentIndex) && guard <= group.length + 1; guard++) {
        const segment = group[segmentIndex];
        const firstKey = pointKey(segment.points[0]);
        const from = firstKey === currentKey ? segment.points[0] : segment.points[1];
        const to = firstKey === currentKey ? segment.points[1] : segment.points[0];
        if (!local.length) local.push(from);
        local.push(to);
        unused.delete(segmentIndex);
        currentKey = pointKey(to);
        const next = (connections.get(currentKey) || []).find(index => unused.has(index));
        if (next === undefined) break;
        segmentIndex = next;
      }
      if (local.length > 1) {
        // Keep native 5 m contour geometry, but remove exact duplicate vertices.
        const points = [];
        for (const point of local) {
          const lngLat = toLngLat(point);
          const previous = points[points.length - 1];
          if (!previous || Math.abs(previous[0] - lngLat[0]) > 1e-12 || Math.abs(previous[1] - lngLat[1]) > 1e-12) points.push(lngLat);
        }
        if (points.length > 1) {
          paths.push({ level: Number(group[startIndex].level), points });
          pointCount += points.length;
        }
      }
    };
    connections.forEach((indexes, key) => {
      if (indexes.length === 1 && unused.has(indexes[0])) walk(indexes[0], key);
    });
    while (unused.size) {
      const index = unused.values().next().value;
      walk(index, pointKey(group[index].points[0]));
    }
  }
  return { paths, intervalM: interval, segmentCount, pointCount, overflow: false };
};

const mapGravityNamriaNativePath = async ({ start, end, corridorM = 2500, signal, routingMode = 'minimum-ascent' }) => {
  const rasterPath = mapElevationNamriaRasterPath();
  if (!fs.existsSync(rasterPath)) {
    const error = new Error(`NAMRIA DTM is not installed at ${rasterPath}.`);
    error.statusCode = 503;
    throw error;
  }
  if (!mapElevationNamriaImagePromise) {
    mapElevationNamriaImagePromise = import('geotiff')
      .then(({ fromFile }) => fromFile(rasterPath))
      .then(tiff => tiff.getImage())
      .catch(error => { mapElevationNamriaImagePromise = null; throw error; });
  }
  const image = await mapElevationNamriaImagePromise;
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  const rasterWidth = image.getWidth();
  const rasterHeight = image.getHeight();
  const noData = Number(image.getGDALNoData());
  const toPixel = location => ({
    x: Math.floor((Number(location.longitude) - originX) / resolutionX),
    y: Math.floor((Number(location.latitude) - originY) / resolutionY)
  });
  const startPixel = toPixel(start);
  const endPixel = toPixel(end);
  const inside = point => point.x >= 0 && point.x < rasterWidth && point.y >= 0 && point.y < rasterHeight;
  if (!inside(startPixel) || !inside(endPixel)) {
    const error = new Error('The selected gravity-flow endpoints extend beyond the NAMRIA DTM coverage.');
    error.statusCode = 422;
    throw error;
  }
  const middleLatitude = (Number(start.latitude) + Number(end.latitude)) / 2;
  const pixelWidthM = Math.max(0.25, Math.abs(resolutionX) * 111320 * Math.cos(middleLatitude * Math.PI / 180));
  const pixelHeightM = Math.max(0.25, Math.abs(resolutionY) * 110574);
  const requestedCorridorM = Math.max(25, Math.min(2500, Number(corridorM) || 2500));
  const padX = Math.ceil(requestedCorridorM / pixelWidthM) + 2;
  const padY = Math.ceil(requestedCorridorM / pixelHeightM) + 2;
  const left = Math.max(0, Math.min(startPixel.x, endPixel.x) - padX);
  const right = Math.min(rasterWidth, Math.max(startPixel.x, endPixel.x) + padX + 1);
  const top = Math.max(0, Math.min(startPixel.y, endPixel.y) - padY);
  const bottom = Math.min(rasterHeight, Math.max(startPixel.y, endPixel.y) + padY + 1);
  const width = right - left;
  const height = bottom - top;
  if (!(width > 1 && height > 1) || width * height > 2500000) {
    const error = new Error('The native NAMRIA gravity-flow search area is too large. Reduce the distance or search corridor.');
    error.statusCode = 422;
    throw error;
  }
  const [band] = await image.readRasters({ window: [left, top, right, bottom], samples: [0], signal });
  const elevations = new Float64Array(width * height);
  const activeMask = new Uint8Array(width * height);
  const startColumn = startPixel.x - left, startRow = startPixel.y - top;
  const endColumn = endPixel.x - left, endRow = endPixel.y - top;
  let activeCount = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column;
      const value = Number(band[index]);
      elevations[index] = (!Number.isFinite(value) || (Number.isFinite(noData) && value === noData)) ? NaN : value;
      if (!Number.isFinite(elevations[index])) continue;
      const distanceToSegmentM = mapGravityPixelDistanceToSegment(
        column, row, startColumn, startRow, endColumn, endRow, pixelWidthM, pixelHeightM
      );
      if (distanceToSegmentM <= requestedCorridorM + Math.max(pixelWidthM, pixelHeightM) * 1.5) {
        activeMask[index] = 1;
        activeCount++;
      }
    }
  }
  const startIndex = startRow * width + startColumn;
  const endIndex = endRow * width + endColumn;
  activeMask[startIndex] = 1;
  activeMask[endIndex] = 1;
  const startElevationM = Number(elevations[startIndex]);
  const endElevationM = Number(elevations[endIndex]);
  if (!Number.isFinite(startElevationM) || !Number.isFinite(endElevationM)) {
    const error = new Error('The selected endpoints cross an area without NAMRIA DTM coverage.');
    error.statusCode = 422;
    throw error;
  }

  const exactToleranceM = routingMode === 'downhill-only' ? 1e-6 : 0.10;
  // Keep the native 5 m cell-centre result only as a diagnostic. The displayed
  // elevation profile now uses a continuous bilinear NAMRIA surface, so a path
  // should not be accepted merely because the 5 m cell centres descend. The
  // authoritative native route is therefore searched on the same interpolated
  // surface used by the profile and final validator.
  const nativeCellResult = mapGravityFindReverseReachabilityPath({
    elevations, width, height, activeMask, startIndex, endIndex,
    pixelWidthM, pixelHeightM, ascentToleranceM: exactToleranceM,
    allowAnyAngleEscapes: true, maximumEscapeRadius: 3
  });
  let result = null;
  let strategy = 'native-namria-all-descent';
  let acceptedToleranceM = exactToleranceM;
  let noiseCorrected = false;
  let subcellAttempted = false;
  let subcellSpacingM = Math.max(pixelWidthM, pixelHeightM) / 2;
  let reverseReachableCount = Number(nativeCellResult?.reachableCount) || 0;
  let reverseAnyAngleEdgesUsed = Number(nativeCellResult?.anyAngleEdgesUsed) || Number(nativeCellResult?.reverseAnyAngleEdgesAdded) || 0;
  let maskedAStarExpandedCount = Number(nativeCellResult?.maskedAStarExpandedCount) || 0;
  let bottleneckCount = Number(nativeCellResult?.bottleneckCount) || 0;

  // Coarse-to-fine continuous terrain search:
  //   1) native ~5 m reverse mask + masked A* over the full requested corridor;
  //   2) ~2.5 m bilinear refinement, guided by the native viable route when
  //      one exists, otherwise using expanding full corridors;
  //   3) ~1.25 m only as a bottleneck/refinement rescue. If 2.5 m already has
  //      a clean well-connected route, we do not pay for the 1.25 m grid.
  const startRasterX = (Number(start.longitude) - originX) / resolutionX - 0.5 - left;
  const startRasterY = (Number(start.latitude) - originY) / resolutionY - 0.5 - top;
  const endRasterX = (Number(end.longitude) - originX) / resolutionX - 0.5 - left;
  const endRasterY = (Number(end.latitude) - originY) / resolutionY - 0.5 - top;
  const subcellCorridors = [120, 300, 600, 1200, requestedCorridorM]
    .map(value => Math.min(requestedCorridorM, value))
    .filter((value, index, array) => value >= 25 && array.indexOf(value) === index);

  const rawPointsFromPath = (path, gridWidth, cropLeft = 0, cropTop = 0, factor = 1) =>
    (Array.isArray(path) ? path : Array.from(path || [])).map(index => ({
      x: cropLeft + (index % gridWidth) / factor,
      y: cropTop + Math.floor(index / gridWidth) / factor
    }));
  const nativeGuideRawPoints = nativeCellResult?.path?.length
    ? rawPointsFromPath(nativeCellResult.path, width)
    : null;

  const noteSubcellDiagnostics = subcell => {
    subcellAttempted = subcellAttempted || Boolean(subcell?.attempted);
    if (subcell?.attempted) subcellSpacingM = Math.min(subcellSpacingM, Number(subcell?.spacingM) || subcellSpacingM);
    reverseReachableCount = Math.max(reverseReachableCount, Number(subcell?.result?.reachableCount) || 0);
    reverseAnyAngleEdgesUsed = Math.max(
      reverseAnyAngleEdgesUsed,
      Number(subcell?.result?.anyAngleEdgesUsed) || 0,
      Number(subcell?.result?.reverseAnyAngleEdgesAdded) || 0
    );
    maskedAStarExpandedCount = Math.max(maskedAStarExpandedCount, Number(subcell?.result?.maskedAStarExpandedCount) || 0);
    bottleneckCount = Math.max(bottleneckCount, Number(subcell?.result?.bottleneckCount) || 0);
  };

  const subcellPathBottleneckCount = subcell => {
    if (!subcell?.result?.path?.length || !subcell.result.bottleneckMask) return 0;
    let count = 0;
    for (const index of subcell.result.path) if (subcell.result.bottleneckMask[index]) count++;
    return count;
  };

  const responseFromSubcell = (subcell, subcellCorridorM, responseStrategy, refinementStages, bottleneckRefined = false) => {
    const routeIndexes = Array.from(subcell.result.path);
    const locations = routeIndexes.map((index, routeIndex) => {
      if (routeIndex === 0) return { longitude: Number(start.longitude), latitude: Number(start.latitude) };
      if (routeIndex === routeIndexes.length - 1) return { longitude: Number(end.longitude), latitude: Number(end.latitude) };
      const column = index % subcell.width;
      const row = Math.floor(index / subcell.width);
      const rawX = subcell.cropLeft + column / subcell.factor;
      const rawY = subcell.cropTop + row / subcell.factor;
      return {
        longitude: originX + (left + rawX + 0.5) * resolutionX,
        latitude: originY + (top + rawY + 0.5) * resolutionY
      };
    });
    const routeElevations = routeIndexes.map(index => Number(subcell.elevations[index]));
    let routeDistanceM = 0;
    for (let i = 1; i < routeIndexes.length; i++) {
      const a = routeIndexes[i - 1], b = routeIndexes[i];
      const ac = a % subcell.width, ar = Math.floor(a / subcell.width);
      const bc = b % subcell.width, br = Math.floor(b / subcell.width);
      routeDistanceM += Math.hypot((bc - ac) * subcell.pixelWidthM, (br - ar) * subcell.pixelHeightM);
    }
    return {
      found: true,
      sourceKey: 'namria-dtm5-prs92',
      sourceLabel: mapElevationSources['namria-dtm5-prs92'].label,
      strategy: responseStrategy,
      refinementStages,
      bottleneckRefined,
      routeGuidedRefinement: Boolean(subcell.routeGuided),
      guideBufferM: Number(subcell.guideBufferM) || 0,
      subcellInterpolated: true,
      subcellSpacingM: subcell.spacingM,
      acceptedToleranceM: exactToleranceM,
      maximumRawStepAscentM: subcell.result.maximumRawStepAscentM,
      totalRawAscentM: subcell.result.totalRawAscentM,
      nativeCellPathFound: Boolean(nativeCellResult?.path?.length),
      reverseReachableCount: Number(subcell.result?.reachableCount) || 0,
      maskedAStarExpandedCount: Number(subcell.result?.maskedAStarExpandedCount) || 0,
      bottleneckCount: Number(subcell.result?.bottleneckCount) || 0,
      pathBottleneckCount: subcellPathBottleneckCount(subcell),
      reverseAnyAngleEdgesUsed: Number(subcell.result?.anyAngleEdgesUsed) || 0,
      reverseAnyAngleEdgesAdded: Number(subcell.result?.reverseAnyAngleEdgesAdded) || 0,
      corridorM: subcellCorridorM,
      pixelWidthM: subcell.pixelWidthM,
      pixelHeightM: subcell.pixelHeightM,
      activeCount: subcell.activeCount,
      startElevationM: Number(routeElevations[0]),
      endElevationM: Number(routeElevations[routeElevations.length - 1]),
      routeDistanceM,
      locations,
      elevations: routeElevations
    };
  };

  const runSubcell = ({ factor, corridor, guideRawPoints = null, guideBufferM = 0 }) => {
    const subcell = mapGravityFindInterpolatedRasterPath({
      elevations, width, height,
      startX: startRasterX, startY: startRasterY,
      endX: endRasterX, endY: endRasterY,
      pixelWidthM, pixelHeightM, corridorM: corridor,
      factor, ascentToleranceM: exactToleranceM,
      guideRawPoints, guideBufferM
    });
    noteSubcellDiagnostics(subcell);
    return subcell;
  };

  let factor2Candidate = null;
  let factor2CorridorM = requestedCorridorM;

  // First refine a proven native route. Two buffers allow a small local detour
  // without turning 2.5 m refinement back into a full-corridor brute-force run.
  if (nativeGuideRawPoints?.length) {
    for (const guideBufferM of [30, 75]) {
      const subcell = runSubcell({
        factor: 2,
        corridor: requestedCorridorM,
        guideRawPoints: nativeGuideRawPoints,
        guideBufferM
      });
      if (subcell?.found && subcell.result?.path?.length) {
        factor2Candidate = subcell;
        factor2CorridorM = requestedCorridorM;
        break;
      }
    }
  }

  // If 5 m cell centres did not provide a guide, or a narrow 2.5 m refinement
  // could not reproduce it on the continuous surface, search expanding 2.5 m
  // corridors. This is the important between-cell recovery stage.
  if (!factor2Candidate) {
    for (const subcellCorridorM of subcellCorridors) {
      const subcell = runSubcell({ factor: 2, corridor: subcellCorridorM });
      if (!subcell?.found || !subcell.result?.path?.length) continue;
      factor2Candidate = subcell;
      factor2CorridorM = subcellCorridorM;
      break;
    }
  }

  if (factor2Candidate?.result?.path?.length) {
    const pathBottlenecks = subcellPathBottleneckCount(factor2Candidate);
    const usedAnyAngle = Number(factor2Candidate.result.anyAngleEdgesUsed) > 0;
    const needsBottleneckRefinement = usedAnyAngle || pathBottlenecks > 0;

    // 1.25 m is not a mandatory third full-corridor pass. It is reserved for
    // low-connectivity/any-angle sections discovered at 2.5 m. The refinement
    // follows the 2.5 m route in a tight band; if it cannot improve/reproduce
    // the route, the already strict 2.5 m result remains valid.
    if (needsBottleneckRefinement) {
      const factor2Guide = rawPointsFromPath(
        factor2Candidate.result.path,
        factor2Candidate.width,
        factor2Candidate.cropLeft,
        factor2Candidate.cropTop,
        factor2Candidate.factor
      );
      for (const guideBufferM of [12, 25]) {
        const fine = runSubcell({
          factor: 4,
          corridor: factor2CorridorM,
          guideRawPoints: factor2Guide,
          guideBufferM
        });
        if (fine?.found && fine.result?.path?.length) {
          return responseFromSubcell(
            fine,
            factor2CorridorM,
            'native-namria-reverse-mask-masked-a-star-bottleneck-refined',
            ['5m reverse reachable-mask', '2.5m masked A* continuous refinement', '1.25m bottleneck-only refinement'],
            true
          );
        }
      }
    }

    return responseFromSubcell(
      factor2Candidate,
      factor2CorridorM,
      'native-namria-reverse-mask-masked-a-star-coarse-to-fine',
      ['5m reverse reachable-mask', '2.5m masked A* continuous refinement'],
      false
    );
  }

  // Last continuous-surface rescue: if the 2.5 m lattice itself cannot connect
  // the reverse and forward components, search 1.25 m with expanding corridors.
  // Any-angle links are still generated only at low-connectivity bottlenecks.
  for (const subcellCorridorM of subcellCorridors) {
    const fine = runSubcell({ factor: 4, corridor: subcellCorridorM });
    if (!fine?.found || !fine.result?.path?.length) continue;
    return responseFromSubcell(
      fine,
      subcellCorridorM,
      'native-namria-reverse-mask-masked-a-star-fine-rescue',
      ['5m reverse reachable-mask', '2.5m masked A* continuous search', '1.25m bottleneck-resolution rescue'],
      true
    );
  }

  // Do not relax the terrain rule to accept uphill raster jitter. If the strict
  // interpolated searches fail, continue to the contour-guided fallback built
  // from the same NAMRIA DTM instead of accepting a centre-cell-only shortcut.

  if (!result) {
    // Final native fallback: derive a topographic contour network directly
    // from this same NAMRIA window. This does not depend on a user-visible
    // contour layer. It lets the frontend trace sideways on a level contour
    // and then connect only toward lower contour levels, matching the terrain
    // interpretation used for gravity-pipe reconnaissance.
    const endpointDropM = Math.max(0, startElevationM - endElevationM);
    // A 10 m contour interval can skip the narrow connection needed between
    // endpoints whose total drop is only a few tens of metres. Use a bounded
    // adaptive interval for the native fallback. This adds only a modest number
    // of contour levels and avoids the previous expensive 1 m full-corridor
    // experiment that could make the map unresponsive.
    let nativeContourIntervalM = endpointDropM <= 60 ? 5 : endpointDropM <= 180 ? 10 : 20;
    let nativeContours = mapGravityBuildNativeContourPaths({
      elevations, width, height, activeMask,
      originX, originY, resolutionX, resolutionY, left, top,
      minimumLevelM: endElevationM, maximumLevelM: startElevationM,
      intervalM: nativeContourIntervalM, maximumSegments: 120000
    });
    if (nativeContours.overflow) {
      nativeContourIntervalM *= 2;
      nativeContours = mapGravityBuildNativeContourPaths({
        elevations, width, height, activeMask,
        originX, originY, resolutionX, resolutionY, left, top,
        minimumLevelM: endElevationM, maximumLevelM: startElevationM,
        intervalM: nativeContourIntervalM, maximumSegments: 120000
      });
    }
    return {
      found: false,
      sourceKey: 'namria-dtm5-prs92',
      sourceLabel: mapElevationSources['namria-dtm5-prs92'].label,
      corridorM: requestedCorridorM,
      pixelWidthM,
      pixelHeightM,
      activeCount,
      startElevationM,
      endElevationM,
      exactToleranceM,
      subcellAttempted,
      subcellSpacingM,
      nativeCellPathFound: Boolean(nativeCellResult?.path?.length),
      reverseReachableCount,
      maskedAStarExpandedCount,
      bottleneckCount,
      reverseAnyAngleEdgesUsed,
      refinementStages: ['5m reverse reachable-mask', '2.5m masked A* continuous search', '1.25m bottleneck-resolution rescue'],
      nativeContourGenerated: Boolean(nativeContours.paths?.length),
      nativeContourIntervalM: Number(nativeContours.intervalM) || 10,
      nativeContourSegmentCount: Number(nativeContours.segmentCount) || 0,
      nativeContourPointCount: Number(nativeContours.pointCount) || 0,
      nativeContourOverflow: Boolean(nativeContours.overflow),
      nativeContourPaths: Array.isArray(nativeContours.paths) ? nativeContours.paths : []
    };
  }

  const simplified = noiseCorrected
    ? mapGravityCompressRasterPathTurns(result.path, width)
    : mapGravitySimplifyRasterPath(result.path, width, elevations, acceptedToleranceM);
  const locations = simplified.map((index, routeIndex) => {
    if (routeIndex === 0) return { longitude: Number(start.longitude), latitude: Number(start.latitude) };
    if (routeIndex === simplified.length - 1) return { longitude: Number(end.longitude), latitude: Number(end.latitude) };
    const column = index % width, row = Math.floor(index / width);
    return {
      longitude: originX + (left + column + 0.5) * resolutionX,
      latitude: originY + (top + row + 0.5) * resolutionY
    };
  });
  const routeElevations = simplified.map(index => Number(elevations[index]));
  let routeDistanceM = 0;
  for (let i = 1; i < simplified.length; i++) {
    const a = simplified[i - 1], b = simplified[i];
    const ac = a % width, ar = Math.floor(a / width), bc = b % width, br = Math.floor(b / width);
    routeDistanceM += Math.hypot((bc - ac) * pixelWidthM, (br - ar) * pixelHeightM);
  }
  return {
    found: true,
    sourceKey: 'namria-dtm5-prs92',
    sourceLabel: mapElevationSources['namria-dtm5-prs92'].label,
    strategy,
    noiseCorrected,
    acceptedToleranceM,
    maximumRawStepAscentM: result.maximumRawStepAscentM,
    totalRawAscentM: result.totalRawAscentM,
    corridorM: requestedCorridorM,
    pixelWidthM,
    pixelHeightM,
    activeCount,
    startElevationM,
    endElevationM,
    routeDistanceM,
    locations,
    elevations: routeElevations
  };
};

const mapGravityRemoteSampledPath = async ({ sourceKey, start, end, corridorM = 2500, signal }) => {
  const source = mapElevationSources[sourceKey];
  if (!source || sourceKey === 'namria-dtm5-prs92') {
    const error = new Error('Select a supported non-NAMRIA terrain source.');
    error.statusCode = 400;
    throw error;
  }

  const middleLatitude = (Number(start.latitude) + Number(end.latitude)) / 2;
  const metresPerLon = Math.max(1000, 111320 * Math.cos(middleLatitude * Math.PI / 180));
  const metresPerLat = 110574;
  const originLon = Number(start.longitude);
  const originLat = Number(start.latitude);
  const endX = (Number(end.longitude) - originLon) * metresPerLon;
  const endY = (Number(end.latitude) - originLat) * metresPerLat;
  const straightDistanceM = Math.hypot(endX, endY);
  const requestedCorridorM = Math.max(25, Math.min(2500, Number(corridorM) || 2500));

  // Remote DEMs are sampled on a source-locked local metric grid. Sampling at
  // half the advertised DEM spacing gives the reverse reachability solver a
  // continuous-enough surface without pretending that the provider has finer
  // native detail. Provider-aware budgets keep public/rate-limited services
  // responsive while AWS COG sources can use a denser search.
  const advertisedResolutionM = Math.max(10, Number(source.resolutionM) || 30);
  const baseSpacingM = Math.max(10, advertisedResolutionM / 2);
  const maximumSamples = source.provider === 'aws-copernicus' ? 18000
    : source.provider === 'aws-mapzen' ? 12000
      : source.provider === 'open-meteo' ? 7000 : 4500;

  let spacingM = baseSpacingM;
  const boundsFor = spacing => {
    const minX = Math.min(0, endX) - requestedCorridorM;
    const maxX = Math.max(0, endX) + requestedCorridorM;
    const minY = Math.min(0, endY) - requestedCorridorM;
    const maxY = Math.max(0, endY) + requestedCorridorM;
    return {
      minX, minY,
      width: Math.max(2, Math.ceil((maxX - minX) / spacing) + 1),
      height: Math.max(2, Math.ceil((maxY - minY) / spacing) + 1)
    };
  };
  let bounds = boundsFor(spacingM);
  if (bounds.width * bounds.height > maximumSamples) {
    spacingM *= Math.sqrt((bounds.width * bounds.height) / maximumSamples) * 1.03;
    bounds = boundsFor(spacingM);
  }
  while (bounds.width * bounds.height > maximumSamples) {
    spacingM *= 1.08;
    bounds = boundsFor(spacingM);
  }

  const { minX, minY, width, height } = bounds;
  const startColumn = Math.max(0, Math.min(width - 1, Math.round((0 - minX) / spacingM)));
  const startRow = Math.max(0, Math.min(height - 1, Math.round((0 - minY) / spacingM)));
  const endColumn = Math.max(0, Math.min(width - 1, Math.round((endX - minX) / spacingM)));
  const endRow = Math.max(0, Math.min(height - 1, Math.round((endY - minY) / spacingM)));
  const startIndex = startRow * width + startColumn;
  const endIndex = endRow * width + endColumn;

  const activeMask = new Uint8Array(width * height);
  const locations = [];
  const locationIndexes = [];
  for (let row = 0; row < height; row++) {
    const y = minY + row * spacingM;
    for (let column = 0; column < width; column++) {
      const x = minX + column * spacingM;
      const index = row * width + column;
      const distanceToSegmentM = mapGravityPixelDistanceToSegment(
        column, row, startColumn, startRow, endColumn, endRow, spacingM, spacingM
      );
      if (distanceToSegmentM > requestedCorridorM + spacingM * 1.5) continue;
      activeMask[index] = 1;
      locationIndexes.push(index);
      locations.push({
        longitude: originLon + x / metresPerLon,
        latitude: originLat + y / metresPerLat
      });
    }
  }
  activeMask[startIndex] = 1;
  activeMask[endIndex] = 1;

  const requested = [...locations, start, end];
  const sampled = await mapElevationValues(source, requested, signal);
  const elevations = new Float64Array(width * height);
  elevations.fill(NaN);
  locationIndexes.forEach((index, i) => { elevations[index] = Number(sampled[i]); });
  elevations[startIndex] = Number(sampled[sampled.length - 2]);
  elevations[endIndex] = Number(sampled[sampled.length - 1]);
  const startElevationM = Number(elevations[startIndex]);
  const endElevationM = Number(elevations[endIndex]);
  if (!Number.isFinite(startElevationM) || !Number.isFinite(endElevationM)) {
    const error = new Error(`${source.label} did not return valid endpoint elevations.`);
    error.statusCode = 502;
    throw error;
  }
  if (endElevationM > startElevationM + 0.10) {
    return {
      found: false, sourceKey, sourceLabel: source.label, corridorM: requestedCorridorM,
      pixelWidthM: spacingM, pixelHeightM: spacingM, startElevationM, endElevationM,
      endpointHigher: true, endpointRiseM: endElevationM - startElevationM,
      activeCount: locationIndexes.length, reverseReachableCount: 0,
      maskedAStarExpandedCount: 0, bottleneckCount: 0, reverseAnyAngleEdgesUsed: 0
    };
  }

  const result = mapGravityFindReverseReachabilityPath({
    elevations, width, height, activeMask, startIndex, endIndex,
    pixelWidthM: spacingM, pixelHeightM: spacingM,
    ascentToleranceM: 0.10, allowAnyAngleEscapes: true, maximumEscapeRadius: 4
  });
  if (!result?.path?.length) {
    return {
      found: false, sourceKey, sourceLabel: source.label, corridorM: requestedCorridorM,
      pixelWidthM: spacingM, pixelHeightM: spacingM, startElevationM, endElevationM,
      activeCount: locationIndexes.length,
      reverseReachableCount: Number(result?.reachableCount) || 0,
      maskedAStarExpandedCount: Number(result?.maskedAStarExpandedCount) || 0,
      bottleneckCount: Number(result?.bottleneckCount) || 0,
      reverseAnyAngleEdgesUsed: Number(result?.anyAngleEdgesUsed) || Number(result?.reverseAnyAngleEdgesAdded) || 0,
      refinementStages: [`${Math.round(spacingM)}m source-locked reverse reachable-mask`, 'masked A* with bottleneck any-angle links']
    };
  }

  const route = mapGravityCompressRasterPathTurns(Array.from(result.path), width);
  const routeLocations = route.map((index, routeIndex) => {
    if (routeIndex === 0) return { longitude: Number(start.longitude), latitude: Number(start.latitude) };
    if (routeIndex === route.length - 1) return { longitude: Number(end.longitude), latitude: Number(end.latitude) };
    const column = index % width;
    const row = Math.floor(index / width);
    const x = minX + column * spacingM;
    const y = minY + row * spacingM;
    return { longitude: originLon + x / metresPerLon, latitude: originLat + y / metresPerLat };
  });
  const routeElevations = route.map(index => Number(elevations[index]));
  routeElevations[0] = startElevationM;
  routeElevations[routeElevations.length - 1] = endElevationM;
  return {
    found: true,
    sourceKey,
    sourceLabel: source.label,
    strategy: 'remote-source-reverse-mask-masked-a-star',
    refinementStages: [`${Math.round(spacingM)}m source-locked reverse reachable-mask`, 'masked A* with bottleneck any-angle links'],
    corridorM: requestedCorridorM,
    pixelWidthM: spacingM,
    pixelHeightM: spacingM,
    activeCount: locationIndexes.length,
    startElevationM,
    endElevationM,
    reverseReachableCount: Number(result.reachableCount) || 0,
    maskedAStarExpandedCount: Number(result.maskedAStarExpandedCount) || 0,
    bottleneckCount: Number(result.bottleneckCount) || 0,
    reverseAnyAngleEdgesUsed: Number(result.anyAngleEdgesUsed) || Number(result.reverseAnyAngleEdgesAdded) || 0,
    locations: routeLocations,
    elevations: routeElevations
  };
};

const __routeController303 = async (req, res) => {
  const requestedSourceKey = String(req.body?.source || '');
  const sourceKey = 'namria-dtm5-prs92';
  if (requestedSourceKey && requestedSourceKey !== sourceKey) {
    return res.status(400).json({ error: 'Gravity Flow Path supports NAMRIA DTM 5 m (PRS92) only.' });
  }
  const routingMode = String(req.body?.routing_mode || 'minimum-ascent');
  if (!['minimum-ascent', 'downhill-only'].includes(routingMode)) {
    return res.status(400).json({ error: 'Choose a valid gravity routing goal.' });
  }
  const normalize = value => ({ latitude: Number(value?.latitude), longitude: Number(value?.longitude) });
  const start = normalize(req.body?.start);
  const end = normalize(req.body?.end);
  if ([start, end].some(location => !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)
      || location.latitude < -90 || location.latitude > 90 || location.longitude < -180 || location.longitude > 180)) {
    return res.status(400).json({ error: 'Provide valid start and end coordinates.' });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const searchArgs = {
      start, end, routingMode,
      corridorM: Math.min(2500, Math.max(25, Number(req.body?.corridor_m) || 2500)),
      signal: controller.signal
    };
    const result = await mapGravityNamriaNativePath(searchArgs);
    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    logError('MAP_GRAVITY_PATH_FAILED', err.message, err.stack);
    res.status(err.name === 'AbortError' ? 504 : (err.statusCode || 503)).json({
      error: err.name === 'AbortError' ? 'The gravity-flow terrain search timed out.' : (err.message || 'Gravity-flow terrain search failed.')
    });
  } finally {
    clearTimeout(timeout);
  }
};

const mapElevationOpenTopoData = async (source, locations, signal) => {
  const request = () => fetch(`https://api.opentopodata.org/v1/${source.dataset}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ABEARC-System/1.0 elevation-profile'
    },
    body: JSON.stringify({
      locations: locations
        .map(location => `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`)
        .join('|'),
      interpolation: 'bilinear'
    }),
    signal
  });
  let response = await request();
  if (response.status === 429) {
    await new Promise(resolve => setTimeout(resolve, 1100));
    response = await request();
  }
  const data = await response.json().catch(() => ({}));
  const elevations = Array.isArray(data.results) ? data.results.map(result => Number(result?.elevation)) : [];
  if (!response.ok || data.status !== 'OK') throw new Error(data.error || `${source.label} is unavailable.`);
  return elevations;
};

const mapElevationOpenMeteo = async (locations, signal) => {
  const params = new URLSearchParams({
    latitude: locations.map(location => location.latitude.toFixed(6)).join(','),
    longitude: locations.map(location => location.longitude.toFixed(6)).join(',')
  });
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || 'Copernicus GLO-90 is unavailable.');
  return Array.isArray(data.elevation) ? data.elevation.map(Number) : [];
};

const mapElevationTileCoordinate = (latitude, longitude, zoom = 12) => {
  const scale = 2 ** zoom;
  const latitudeRadians = latitude * Math.PI / 180;
  const tileX = (longitude + 180) / 360 * scale;
  const tileY = (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale;
  return {
    x: Math.floor(tileX),
    y: Math.floor(tileY),
    pixelX: Math.max(0, Math.min(255, Math.floor((tileX - Math.floor(tileX)) * 256))),
    pixelY: Math.max(0, Math.min(255, Math.floor((tileY - Math.floor(tileY)) * 256)))
  };
};

const mapElevationAwsMapzen = async (locations, signal) => {
  const zoom = 12;
  const tiles = new Map();
  const coordinates = locations.map(location => mapElevationTileCoordinate(location.latitude, location.longitude, zoom));
  for (const coordinate of coordinates) {
    const key = `${coordinate.x}/${coordinate.y}`;
    if (tiles.has(key)) continue;
    const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${key}.png`, { signal });
    if (!response.ok) throw new Error('AWS Terrain Tiles (Mapzen) is unavailable.');
    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    tiles.set(key, decoded);
  }
  return coordinates.map(coordinate => {
    const tile = tiles.get(`${coordinate.x}/${coordinate.y}`);
    const offset = (coordinate.pixelY * tile.info.width + coordinate.pixelX) * tile.info.channels;
    return tile.data[offset] * 256 + tile.data[offset + 1] + tile.data[offset + 2] / 256 - 32768;
  });
};

const mapElevationCogTileName = (latitude, longitude, cogCode) => {
  const tileLatitude = Math.floor(latitude);
  const tileLongitude = Math.floor(longitude);
  const latitudeLabel = `${tileLatitude >= 0 ? 'N' : 'S'}${String(Math.abs(tileLatitude)).padStart(2, '0')}_00`;
  const longitudeLabel = `${tileLongitude >= 0 ? 'E' : 'W'}${String(Math.abs(tileLongitude)).padStart(3, '0')}_00`;
  return `Copernicus_DSM_COG_${cogCode}_${latitudeLabel}_${longitudeLabel}_DEM`;
};

const mapElevationAwsCopernicus = async (source, locations, signal) => {
  const { fromUrl } = await import('geotiff');
  const tileGroups = new Map();
  locations.forEach((location, index) => {
    const tileName = mapElevationCogTileName(location.latitude, location.longitude, source.cogCode);
    if (!tileGroups.has(tileName)) tileGroups.set(tileName, []);
    tileGroups.get(tileName).push({ ...location, index });
  });
  const elevations = new Array(locations.length);
  for (const [tileName, points] of tileGroups) {
    const url = `https://${source.bucket}.s3.amazonaws.com/${tileName}/${tileName}.tif`;
    const cacheKey = `${source.bucket}/${tileName}`;
    let tiff = mapElevationCogCache.get(cacheKey);
    if (!tiff) {
      tiff = await fromUrl(url, { cacheSize: 64 }, signal);
      mapElevationCogCache.set(cacheKey, tiff);
      if (mapElevationCogCache.size > 8) mapElevationCogCache.delete(mapElevationCogCache.keys().next().value);
    }
    const image = await tiff.getImage();
    const [originX, originY] = image.getOrigin();
    const [resolutionX, resolutionY] = image.getResolution();
    const blockWidth = image.getTileWidth?.() || 256;
    const blockHeight = image.getTileHeight?.() || 256;
    const blocks = new Map();
    points.forEach(point => {
      const pixelX = Math.max(0, Math.min(image.getWidth() - 1, Math.floor((point.longitude - originX) / resolutionX)));
      const pixelY = Math.max(0, Math.min(image.getHeight() - 1, Math.floor((point.latitude - originY) / resolutionY)));
      const key = `${Math.floor(pixelX / blockWidth)}/${Math.floor(pixelY / blockHeight)}`;
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key).push({ ...point, pixelX, pixelY });
    });
    for (const [key, blockPoints] of blocks) {
      const [blockX, blockY] = key.split('/').map(Number);
      const left = blockX * blockWidth;
      const top = blockY * blockHeight;
      const right = Math.min(image.getWidth(), left + blockWidth);
      const bottom = Math.min(image.getHeight(), top + blockHeight);
      const [band] = await image.readRasters({ window: [left, top, right, bottom], samples: [0], signal });
      const width = right - left;
      blockPoints.forEach(point => {
        elevations[point.index] = Number(band[(point.pixelY - top) * width + point.pixelX - left]);
      });
    }
  }
  return elevations;
};

const mapElevationValues = async (source, locations, signal) => {
  if (locations.length > 100 && ['open-topodata', 'open-meteo'].includes(source.provider)) {
    const elevations = [];
    for (let index = 0; index < locations.length; index += 100) {
      if (index && source.provider === 'open-topodata') await new Promise(resolve => setTimeout(resolve, 1100));
      elevations.push(...await mapElevationValues(source, locations.slice(index, index + 100), signal));
    }
    return elevations;
  }
  if (source.provider === 'namria-local') return mapElevationNamria(locations, signal);
  if (source.provider === 'open-topodata') return mapElevationOpenTopoData(source, locations, signal);
  if (source.provider === 'open-meteo') return mapElevationOpenMeteo(locations, signal);
  if (source.provider === 'aws-mapzen') return mapElevationAwsMapzen(locations, signal);
  if (source.provider === 'aws-copernicus') return mapElevationAwsCopernicus(source, locations, signal);
  throw new Error('Unsupported elevation source.');
};

const __routeController225 = async (req, res) => {
  const locations = Array.isArray(req.body?.locations) ? req.body.locations : [];
  // Keep a generous server-side ceiling as a compatibility safety net. New
  // clients batch elevation requests at 300 points, but older cached frontends
  // and long gravity-path validation requests may still submit more than the
  // historical 400-point limit. Local NAMRIA sampling is block-based, while
  // remote providers are already internally split into smaller requests.
  const maxElevationLocations = 5000;
  if (locations.length < 2 || locations.length > maxElevationLocations) {
    return res.status(400).json({ error: `Provide between 2 and ${maxElevationLocations} elevation locations.` });
  }
  const normalized = locations.map(location => ({
    latitude: Number(location?.latitude),
    longitude: Number(location?.longitude)
  }));
  if (normalized.some(location => !Number.isFinite(location.latitude)
      || location.latitude < -90 || location.latitude > 90
      || !Number.isFinite(location.longitude)
      || location.longitude < -180 || location.longitude > 180)) {
    return res.status(400).json({ error: 'Every profile location must contain valid latitude and longitude values.' });
  }

  const sourceKey = String(req.body?.source || 'opentopo-srtm30');
  const source = mapElevationSources[sourceKey];
  if (!source) return res.status(400).json({ error: 'Select a valid elevation source.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), locations.length > 100 ? 60000 : 20000);
  try {
    const elevations = await mapElevationValues(source, normalized, controller.signal);
    if (elevations.length !== normalized.length || elevations.some(value => !Number.isFinite(value))) {
      const error = new Error(`${source.label} returned incomplete elevation data.`);
      error.statusCode = 502;
      throw error;
    }
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({ elevations, resolution_m: source.resolutionM, source: source.label, source_key: sourceKey });
  } catch (err) {
    logError('MAP_ELEVATION_PROFILE_FAILED', err.message, err.stack);
    res.status(err.name === 'AbortError' ? 504 : (err.statusCode || 503)).json({
      error: err.name === 'AbortError'
        ? 'The terrain elevation service timed out.'
        : 'Terrain elevation data is temporarily unavailable.'
    });
  } finally {
    clearTimeout(timeout);
  }
};

const mapMediaUploadValueMissing = value => value === undefined || value === null || String(value).trim() === '';

const ensureMapMediaUploadHasGeotag = (metadata = {}, originalFilename = 'photo') => {
  const latitude = Number(metadata?.latitude);
  const longitude = Number(metadata?.longitude);
  const embeddedGps = metadata?.__embedded_exif_gps === true;
  if (embeddedGps
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) return;
  const err = new Error(`${originalFilename}: rejected because the original image does not contain valid embedded GPS metadata. GPS shown only in the visible stamp or QR code does not qualify.`);
  err.code = 'MAP_MEDIA_MISSING_EMBEDDED_GPS';
  err.statusCode = 422;
  throw err;
};

const inferMapMediaUploadMetadata = async (file, metadata = {}) => {
  const output = { ...(metadata || {}) };
  output.__embedded_exif_gps = false;
  if (!file?.path) return output;

  // Manual/GeoCam map uploads must be geotagged in the original image metadata itself.
  // Request-body coordinates and coordinates printed in a visible image stamp/QR are not
  // allowed to make an otherwise non-geotagged image eligible for Geotag Map upload.
  try {
    const embedded = monitoringReadExifMetadata(fs.readFileSync(file.path));
    const embeddedLatitude = Number(embedded?.latitude);
    const embeddedLongitude = Number(embedded?.longitude);
    const hasEmbeddedGps = mapMediaCoordinatePresent(embedded?.latitude) && mapMediaCoordinatePresent(embedded?.longitude) && Number.isFinite(embeddedLatitude) && embeddedLatitude >= -90 && embeddedLatitude <= 90
      && Number.isFinite(embeddedLongitude) && embeddedLongitude >= -180 && embeddedLongitude <= 180;
    output.__embedded_exif_gps = hasEmbeddedGps;
    if (hasEmbeddedGps) {
      output.latitude = embeddedLatitude;
      output.longitude = embeddedLongitude;
      output.coordinate_source = 'embedded_exif_manual';
      if (mapMediaUploadValueMissing(output.altitude_m) && Number.isFinite(Number(embedded.altitude_m))) output.altitude_m = Number(embedded.altitude_m);
      if (mapMediaUploadValueMissing(output.bearing_deg) && mapMediaCoordinatePresent(embedded.bearing_deg)) output.bearing_deg = Number(embedded.bearing_deg);
      if (mapMediaUploadValueMissing(output.captured_at) && !mapMediaUploadValueMissing(embedded.captured_at)) output.captured_at = embedded.captured_at;
    } else {
      output.latitude = null;
      output.longitude = null;
      output.coordinate_source = 'missing_embedded_gps';
    }
  } catch (error) {
    output.latitude = null;
    output.longitude = null;
    output.coordinate_source = 'missing_embedded_gps';
    logError('MAP_MEDIA_EMBEDDED_GPS_READ_FAILED', error.message, error.stack);
  }

  const needsInspection = [
    output.captured_at, output.district, output.barangay, output.zoning, output.location_zoning,
    output.bearing_deg, output.accuracy_m, output.stamp_text
  ].some(mapMediaUploadValueMissing);
  if (needsInspection) {
    try {
      const inspected = await inspectProjectGeotagImage(file.path, file.originalname);
      const stampZones = mapZoningFromStampText(inspected?.stampText || '');
      const inferred = {
        captured_at: inspected?.capturedAt,
        accuracy_m: inspected?.accuracyM,
        altitude_m: inspected?.altitudeM,
        bearing_deg: inspected?.bearingDeg,
        district: inspected?.address?.district,
        barangay: inspected?.address?.barangay,
        location_description: inspected?.address?.address,
        zoning: stampZones.zoning,
        location_zoning: stampZones.location_zoning,
        facing_zoning: stampZones.facing_zoning,
        stamp_text: inspected?.stampText
      };
      Object.entries(inferred).forEach(([key, value]) => {
        if ((key === 'captured_at' || key === 'accuracy_m') && !mapMediaUploadValueMissing(value)) {
          // Capture time may still be recovered from the image's QR/stamp when EXIF date is absent.
          // Only GPS eligibility is restricted to embedded image metadata.
          output[key] = value;
          return;
        }
        if (mapMediaUploadValueMissing(output[key]) && !mapMediaUploadValueMissing(value)) output[key] = value;
      });
    } catch (error) {
      logError('MAP_MEDIA_AUTO_METADATA_FAILED', error.message, error.stack);
    }
  }
  const stampedAccuracy = projectGeotagNumber(projectGeotagStampValue(output.stamp_text, 'Accuracy'));
  if (Number.isFinite(stampedAccuracy) && stampedAccuracy >= 0) output.accuracy_m = stampedAccuracy;
  if (mapMediaUploadValueMissing(output.captured_at)) {
    const fallback = projectGeotagFilenameCapturedAt(file.originalname);
    if (fallback) output.captured_at = fallback;
  }
  return output;
};

const __routeController198 = async (req, res) => {
  try {
    const uploadFile = req.file || req.files?.photo?.[0] || req.files?.files?.[0];
    const metadata = await inferMapMediaUploadMetadata(uploadFile, req.body);
    ensureMapMediaUploadHasGeotag(metadata, uploadFile?.originalname || 'Photo');
    const result = await storeMapMediaUpload({ req, file: uploadFile, metadata });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    const uploadFile = req.file || req.files?.photo?.[0] || req.files?.files?.[0];
    if (uploadFile?.path) fs.promises.unlink(uploadFile.path).catch(() => {});
    res.status(err.statusCode || 400).json({ success: false, code: err.code || 'MAP_MEDIA_UPLOAD_FAILED', error: err.message || 'Failed to upload Geotag Map photo.' });
  }
};

const parseMapMediaBatchMetadata = (raw) => {
  try {
    const value = JSON.parse(String(raw || '[]'));
    return Array.isArray(value) ? value : [];
  } catch (err) {
    const e = new Error('Invalid metadata_json.');
    e.code = 'MAP_MEDIA_INVALID_METADATA_JSON';
    e.statusCode = 400;
    throw e;
  }
};

const batchMetadataForFile = (file, metadataList, index) => {
  const byCapture = metadataList.find(meta => meta.client_capture_id && String(file.originalname || '').includes(String(meta.client_capture_id)));
  if (byCapture) return byCapture;
  const byName = metadataList.find(meta => String(meta.original_filename || '').toLowerCase() === String(file.originalname || '').toLowerCase());
  return byName || metadataList[index] || {};
};

const __routeController199 = async (req, res) => {
  const files = req.files || [];
  let metadataList = [];
  try {
    metadataList = parseMapMediaBatchMetadata(req.body.metadata_json);
  } catch (err) {
    files.forEach(file => fs.promises.unlink(file.path).catch(() => {}));
    return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message });
  }
  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      const metadata = batchMetadataForFile(file, metadataList, index);
      try {
        const inferredMetadata = await inferMapMediaUploadMetadata(file, metadata);
        ensureMapMediaUploadHasGeotag(inferredMetadata, file?.originalname || `Photo ${index + 1}`);
        results[index] = await storeMapMediaUpload({ req, file, metadata: inferredMetadata });
      } catch (err) {
        if (file?.path) fs.promises.unlink(file.path).catch(() => {});
        results[index] = {
          success: false,
          duplicate: false,
          client_capture_id: metadata?.client_capture_id || null,
          code: err.code || 'MAP_MEDIA_UPLOAD_FAILED',
          error: err.message || 'Failed to upload this photo.'
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(mapMediaConfig.batchConcurrency, Math.max(files.length, 1)) }, worker));
  const uploaded = results.filter(r => r?.success && !r.duplicate).length;
  const duplicates = results.filter(r => r?.success && r.duplicate).length;
  const failed = results.filter(r => !r?.success).length;
  res.status(failed && uploaded + duplicates === 0 ? 400 : 207).json({
    success: failed === 0,
    uploaded_count: uploaded,
    duplicate_count: duplicates,
    failed_count: failed,
    results
  });
};

const __routeController200 = async (req, res) => {
  try {
    const rows = await queryMapMediaRows(req);
    res.json({
      type: 'FeatureCollection',
      server_time: new Date().toISOString(),
      incremental: Boolean(req.query.updated_after),
      features: rows.filter(r => mapMediaCoordinatePresent(r.latitude) && mapMediaCoordinatePresent(r.longitude)).map(mapMediaGeoJsonFeature)
    });
  } catch (err) {
    res.status(500).json({ success: false, code: 'MAP_MEDIA_QUERY_FAILED', error: 'Failed to load map photos.' });
  }
};

const __routeController306 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body?.ids).slice(0, 500);
    if (!ids.length) return res.json({ results: [] });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids, 'read');
    await enrichMapMediaRowsAdministrativeMetadata(rows);
    res.json({
      results: rows.map(row => ({
        id: Number(row.id),
        barangay: row.barangay || null,
        district: row.district || null
      }))
    });
  } catch (err) {
    logError('MAP_MEDIA_ADMIN_RESOLVE_FAILED', err.message, err.stack);
    res.status(500).json({ error: 'Failed to resolve barangay/district from photo coordinates.' });
  }
};

const __routeController201 = async (req, res) => {
  const row = await getMapMediaForUser(req, req.params.id);
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  res.json(mapMediaPublicFields(row));
};

const __routeController304 = async (req, res) => {
  try {
    const result = await queryMapMediaSiteSeries(req, req.params.id, req.query.radius_m);
    if (!result) return res.status(404).json({ error: 'Map photo not found.' });
    res.json({
      anchor: mapMediaPublicFields(result.anchor),
      radius_m: Math.min(100, Math.max(5, Number(req.query.radius_m) || 25)),
      photos: result.photos.map(mapMediaPublicFields)
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load site photo timeline.' });
  }
};

const sendMapMediaFile = async (req, res, kind) => {
  const row = await getMapMediaForUser(req, req.params.id, { enrich: false });
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  const relative = kind === 'thumbnail' ? row.thumbnail_path : row.original_path;
  if (!relative) return res.status(404).json({ error: 'Map photo file is not available.' });
  const absolute = mapMediaAbsolutePath(kind, relative);
  if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: 'Map photo file is missing.' });
  if (kind === 'original' && String(req.query.download || '') === '1') {
    return res.download(absolute, row.original_filename || path.basename(absolute));
  }
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  res.sendFile(absolute);
};

const __routeController202 = (req, res) => sendMapMediaFile(req, res, 'original');
const __routeController203 = (req, res) => sendMapMediaFile(req, res, 'thumbnail');

const normalizeMapMediaBulkIds = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map(Number)
  .filter(id => Number.isInteger(id) && id > 0))]
  .slice(0, 5000);

const getAuthorizedMapMediaBulkRows = async (req, ids, access = 'manage') => {
  const canAccessAll = access === 'delete' ? await canDeleteOtherMapMedia(req.user) : await canManageAllMapMedia(req.user);
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 400) {
    const chunk = ids.slice(offset, offset + 400);
    const placeholders = chunk.map(() => '?').join(',');
    let accessClause = '';
    let accessParams = [];
    if (!canAccessAll) {
      if (access === 'read') {
        accessClause = `AND (LOWER(COALESCE(visibility, 'organization')) NOT IN ('private','owner') OR owner_user_id=?)`;
        accessParams = [req.user.id];
      } else {
        accessClause = 'AND owner_user_id=?';
        accessParams = [req.user.id];
      }
    }
    rows.push(...await dbAll(`SELECT * FROM MapMedia WHERE id IN (${placeholders}) ${accessClause}`, [...chunk, ...accessParams]));
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => order.get(Number(a.id)) - order.get(Number(b.id)));
};

const safeMapMediaBulkCategory = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 100);

const mapMediaArchiveEntryName = (row, usedNames) => {
  const fallback = `geotag-photo-${row.id}.jpg`;
  const raw = path.basename(String(row.original_filename || fallback)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 180) || fallback;
  const parsed = path.parse(raw);
  let candidate = raw;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${parsed.name}-${suffix}${parsed.ext}`;
    suffix++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const __routeController221 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to rename.' });
    const category = safeMapMediaBulkCategory(req.body.category);
    if (!category) return res.status(400).json({ error: 'A photo category is required.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids);
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be renamed.' });
    const updatedAt = new Date().toISOString();
    for (const row of rows) {
      await dbRun(`UPDATE MapMedia SET category=?, updated_at=? WHERE id=?`, [category, updatedAt, row.id]);
    }
    logActivity({ req, action: 'MAP_MEDIA_BULK_CATEGORY_UPDATE', details: `Updated the category of ${rows.length} Geotag Map photos to ${category}` });
    res.json({ success: true, renamed_count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to rename map photos.' });
  }
};

const __routeController222 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to download.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids, 'read');
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be downloaded.' });
    const available = rows.map(row => ({ row, absolute: mapMediaAbsolutePath('original', row.original_path) }))
      .filter(item => item.absolute && fs.existsSync(item.absolute));
    if (available.length !== rows.length) return res.status(404).json({ error: 'One or more selected photo files are missing.' });
    const totalBytes = available.reduce((sum, item) => sum + Number(fs.statSync(item.absolute).size || 0), 0);
    if (totalBytes > 1024 * 1024 * 1024) return res.status(413).json({ error: 'The selected photos exceed the 1 GB bulk download limit. Narrow the current map results and try again.' });

    const archive = new AdmZip();
    const usedNames = new Set();
    available.forEach(({ row, absolute }) => archive.addLocalFile(absolute, '', mapMediaArchiveEntryName(row, usedNames)));
    const dateLabel = new Date().toISOString().slice(0, 10);
    const archiveName = `geotag-map-photos-${dateLabel}.zip`;
    const temporaryZip = path.join(os.tmpdir(), `abearc-map-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.zip`);
    archive.writeZip(temporaryZip);
    const cleanup = () => fs.promises.unlink(temporaryZip).catch(() => {});
    res.once('finish', cleanup);
    res.once('close', cleanup);
    logActivity({ req, action: 'MAP_MEDIA_BULK_DOWNLOAD', details: `Downloaded ${available.length} Geotag Map photos as ZIP` });
    res.download(temporaryZip, archiveName);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to prepare map photo download.' });
  }
};

const __routeController223 = async (req, res) => {
  try {
    const ids = normalizeMapMediaBulkIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one map photo to delete.' });
    const rows = await getAuthorizedMapMediaBulkRows(req, ids, 'delete');
    if (rows.length !== ids.length) return res.status(403).json({ error: 'One or more map photos cannot be deleted.' });
    if (rows.some(row => Number(row.monitoring_record_id || 0) > 0)) {
      return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit cannot be deleted.' });
    }
    const linkedProjectPhoto = await dbGet(`SELECT 1 as linked FROM ProjectDocumentMapMediaLinks WHERE map_media_id IN (${rows.map(() => '?').join(',')}) LIMIT 1`, rows.map(row => row.id));
    if (linkedProjectPhoto) {
      return res.status(409).json({ error: 'A photo published from a reviewed project document cannot be deleted in Geotag Map. Remove its uploaded file from the project record instead.' });
    }
    for (let offset = 0; offset < rows.length; offset += 400) {
      const chunk = rows.slice(offset, offset + 400);
      const placeholders = chunk.map(() => '?').join(',');
      await dbRun(`DELETE FROM MapMedia WHERE id IN (${placeholders})`, chunk.map(row => row.id));
    }
    rows.forEach(row => {
      [mapMediaAbsolutePath('original', row.original_path), mapMediaAbsolutePath('thumbnail', row.thumbnail_path)].forEach(filePath => {
        try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
      });
    });
    logActivity({ req, action: 'MAP_MEDIA_BULK_DELETE', details: `Deleted ${rows.length} Geotag Map photos` });
    res.json({ success: true, deleted_count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete map photos.' });
  }
};

const __routeController204 = async (req, res) => {
  try {
    const access = await mapMediaReadAccessClause(req, 'MapMedia');
    const [counts, review, categories] = await Promise.all([
      dbGet(`SELECT COUNT(*) total, SUM(CASE WHEN map_status='active' THEN 1 ELSE 0 END) active, SUM(CASE WHEN map_status='hidden' THEN 1 ELSE 0 END) hidden FROM MapMedia WHERE ${access.sql}`, access.params),
      dbAll(`SELECT location_status, COUNT(*) count FROM MapMedia WHERE ${access.sql} GROUP BY location_status`, access.params),
      dbAll(`SELECT category, COUNT(*) count FROM MapMedia WHERE ${access.sql} GROUP BY category ORDER BY category`, access.params)
    ]);
    res.json({ counts, location_review: review, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load map summary.' });
  }
};

const __routeController205 = async (req, res) => {
  try {
    const access = await mapMediaReadAccessClause(req, 'MapMedia');
    const rows = await dbAll(`
      SELECT DISTINCT district, barangay, category, zoning
      FROM MapMedia
      WHERE ${access.sql}
      ORDER BY district, barangay, category, zoning
    `, access.params);
    const uniq = key => [...new Set(rows.map(r => r[key]).filter(Boolean))];
    res.json({ districts: uniq('district'), barangays: uniq('barangay'), categories: uniq('category'), zonings: uniq('zoning') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load map filter options.' });
  }
};

const __routeController206 = async (req, res) => {
  const rows = await queryMapMediaRows(req);
  res.json({ photos: rows.map(mapMediaPublicFields), clustering: mapMediaConfig.cluster, explosion: mapMediaConfig.explosion });
};

const __routeController207 = async (req, res) => {
  const rows = await queryMapMediaRows(req);
  const clusterId = decodeURIComponent(String(req.params.clusterId || ''));
  const ids = clusterId.split(',').map(Number).filter(Boolean);
  res.json({ photos: rows.filter(row => ids.includes(Number(row.id))).map(mapMediaPublicFields) });
};

const __routeController208 = async (req, res) => {
  try {
    const allowed = ['category', 'remarks', 'visibility', 'project_stage', 'zoning', 'location_zoning', 'facing_zoning', 'district', 'barangay', 'location_description'];
    const sets = [];
    const params = [];
    allowed.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        sets.push(`${key}=?`);
        params.push(req.body[key] === '' ? null : String(req.body[key]));
      }
    });
    if (!sets.length) return res.status(400).json({ error: 'No editable map photo fields supplied.' });
    sets.push('updated_at=?');
    params.push(new Date().toISOString(), req.params.id);
    await dbRun(`UPDATE MapMedia SET ${sets.join(', ')} WHERE id=?`, params);
    logActivity({ req, action: 'MAP_MEDIA_UPDATE', details: `Updated Geotag Map photo ${req.params.id}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update map photo.' });
  }
};

const __routeController209 = async (req, res) => {
  const linkedVisit = await dbGet(`SELECT monitoring_record_id FROM MapMedia WHERE id=?`, [req.params.id]);
  if (Number(linkedVisit?.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'The original GeoCam location of a monitoring-confirmation photo cannot be changed.' });
  }
  const latitude = toNullableNumber(req.body.latitude);
  const longitude = toNullableNumber(req.body.longitude);
  const accuracyM = toNullableNumber(req.body.accuracy_m);
  const status = mapLocationStatus({ latitude, longitude, accuracyM, manual: true });
  if (status === 'invalid_coordinates' || latitude === null || longitude === null) return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  await dbRun(`UPDATE MapMedia SET latitude=?, longitude=?, accuracy_m=?, coordinate_source='manual', location_status='manual_location', updated_at=? WHERE id=?`, [
    latitude, longitude, Number.isFinite(accuracyM) ? accuracyM : null, new Date().toISOString(), req.params.id
  ]);
  logActivity({ req, action: 'MAP_MEDIA_LOCATION_MANUAL', details: `Manually corrected Geotag Map photo ${req.params.id} to ${latitude}, ${longitude}` });
  res.json({ success: true, location_status: 'manual_location' });
};

const __routeController210 = async (req, res) => {
  await validateMapProjectAccess(req.user, req.body.project_id);
  await dbRun(`UPDATE MapMedia SET project_id=?, project_stage=COALESCE(?, project_stage), updated_at=? WHERE id=?`, [Number(req.body.project_id), req.body.project_stage || null, new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_LINK_PROJECT', projectId: Number(req.body.project_id), details: `Linked Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController211 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET project_id=NULL, project_stage=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_UNLINK_PROJECT', details: `Unlinked Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController212 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET calendar_event_id=?, updated_at=? WHERE id=?`, [Number(req.body.calendar_event_id), new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_LINK_CALENDAR', details: `Linked Geotag Map photo ${req.params.id} to calendar event ${req.body.calendar_event_id}` });
  res.json({ success: true });
};

const __routeController213 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET calendar_event_id=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_UNLINK_CALENDAR', details: `Unlinked Geotag Map photo ${req.params.id} from calendar event` });
  res.json({ success: true });
};

const __routeController214 = async (req, res) => {
  const linkedVisit = await dbGet(`SELECT monitoring_record_id FROM MapMedia WHERE id=?`, [req.params.id]);
  if (Number(linkedVisit?.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit must remain visible in Geotag Map.' });
  }
  await dbRun(`UPDATE MapMedia SET map_status='hidden', updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_HIDE', details: `Hidden Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController215 = async (req, res) => {
  await dbRun(`UPDATE MapMedia SET map_status='active', updated_at=? WHERE id=?`, [new Date().toISOString(), req.params.id]);
  logActivity({ req, action: 'MAP_MEDIA_RESTORE', details: `Restored Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController216 = async (req, res) => {
  const row = await getMapMediaForUser(req, req.params.id);
  if (!row) return res.status(404).json({ error: 'Map photo not found.' });
  if (Number(row.monitoring_record_id || 0) > 0) {
    return res.status(409).json({ error: 'A GeoCam photo that confirms a monitoring visit cannot be deleted.' });
  }
  if (await mapMediaHasProjectDocumentLink(row.id)) {
    return res.status(409).json({ error: 'This photo was published from a reviewed project document. Remove the uploaded file from the project record to delete it from Geotag Map.' });
  }
  await dbRun(`DELETE FROM MapMedia WHERE id=?`, [req.params.id]);
  [mapMediaAbsolutePath('original', row.original_path), mapMediaAbsolutePath('thumbnail', row.thumbnail_path)].forEach(filePath => {
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  });
  logActivity({ req, action: 'MAP_MEDIA_DELETE', details: `Deleted Geotag Map photo ${req.params.id}` });
  res.json({ success: true });
};

const __routeController217 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, thumbnail_path, stored_filename FROM MapMedia`);
  res.json({ success: true, checked: rows.length });
};

const __routeController218 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, stored_filename FROM MapMedia WHERE thumbnail_path IS NULL OR thumbnail_path=''`);
  let regenerated = 0;
  for (const row of rows) {
    const original = mapMediaAbsolutePath('original', row.original_path);
    if (!original || !fs.existsSync(original)) continue;
    try {
      const thumb = await generateMapMediaThumbnail(original, row.stored_filename);
      await dbRun(`UPDATE MapMedia SET thumbnail_path=?, updated_at=? WHERE id=?`, [thumb, new Date().toISOString(), row.id]);
      regenerated++;
    } catch (err) {
      logError('MAP_MEDIA_REGENERATE_THUMBNAIL_FAILED', err.message, err.stack);
    }
  }
  res.json({ success: true, queued: rows.length, regenerated });
};

const __routeController219 = async (req, res) => {
  const rows = await dbAll(`SELECT id, original_path, thumbnail_path FROM MapMedia`);
  const missing = [];
  rows.forEach(row => {
    const original = mapMediaAbsolutePath('original', row.original_path);
    const thumbnail = row.thumbnail_path ? mapMediaAbsolutePath('thumbnail', row.thumbnail_path) : null;
    if (!original || !fs.existsSync(original)) missing.push({ id: row.id, kind: 'original' });
    if (thumbnail && !fs.existsSync(thumbnail)) missing.push({ id: row.id, kind: 'thumbnail' });
  });
  res.json({
    success: missing.length === 0,
    storage: {
      originals_bytes: dirSize(MAP_MEDIA_ORIGINALS_DIR),
      thumbnails_bytes: dirSize(MAP_MEDIA_THUMBNAILS_DIR),
      temp_bytes: dirSize(MAP_MEDIA_TEMP_DIR)
    },
    missing
  });
};

const __routeController220 = async (req, res) => {
  const q = `%${String(req.query.search || req.query.q || '').trim()}%`;
  const rows = await dbAll(`
    SELECT id, name, requester, stage, district, barangay
    FROM Projects
    WHERE COALESCE(outcome, 'Active') = 'Active'
      AND (? = '%%' OR name LIKE ? OR requester LIKE ? OR district LIKE ? OR barangay LIKE ?)
    ORDER BY datetime(COALESCE(last_activity_at, updated_at, created_at)) DESC
    LIMIT ?
  `, [q, q, q, q, q, Math.min(Math.max(Number(req.query.limit || 25), 1), 100)]);
  res.json({ projects: rows });
};
