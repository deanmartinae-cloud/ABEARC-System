const __routeController320 = async (req, res) => {
  try {
    res.set('Cache-Control', 'private, max-age=900');
    res.json(await getMapChirpsConfig());
  } catch (error) {
    logError('MAP_CHIRPS_CONFIG_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({ error: 'CHIRPS availability is temporarily unavailable.' });
  }
};

const __routeController321 = async (req, res) => {
  try {
    const dataset = await getMapChirpsDataset(req.query.start, req.query.end);
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({
      success: true,
      start: dataset.start,
      end: dataset.end,
      days: dataset.days,
      stats: dataset.stats,
      granules: dataset.granules,
      generated_at: dataset.generated_at
    });
  } catch (error) {
    logError('MAP_CHIRPS_PREPARE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'Unable to prepare CHIRPS rainfall for the selected dates.'
    });
  }
};

const __routeController322 = async (req, res) => {
  try {
    const buffer = await getMapChirpsTile(req.query.start, req.query.end, req.params.z, req.params.x, req.params.y);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Length': buffer.length
    });
    res.end(buffer);
  } catch (error) {
    logError('MAP_CHIRPS_TILE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'CHIRPS rainfall tile is temporarily unavailable.'
    });
  }
};

const __routeController323 = async (req, res) => {
  try {
    const result = await getMapChirpsSeries(req.query.start, req.query.end, req.query.lat, req.query.lng);
    res.set('Cache-Control', 'private, max-age=3600');
    res.json(result);
  } catch (error) {
    logError('MAP_CHIRPS_SERIES_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'Unable to prepare CHIRPS graph data for this point.'
    });
  }
};
