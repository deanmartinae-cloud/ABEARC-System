const __routeController324 = async (req, res) => {
  try {
    res.set('Cache-Control', 'private, max-age=900');
    res.json(await getMapTerraClimateConfig());
  } catch (error) {
    logError('MAP_TERRACLIMATE_CONFIG_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({ error: 'TerraClimate availability is temporarily unavailable.' });
  }
};

const __routeController325 = async (req, res) => {
  try {
    const dataset = await getMapTerraClimateDataset(req.query.start, req.query.end);
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({
      success: true,
      start: dataset.start,
      end: dataset.end,
      months: dataset.months,
      stats: dataset.stats,
      generated_at: dataset.generated_at
    });
  } catch (error) {
    logError('MAP_TERRACLIMATE_PREPARE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'Unable to prepare TerraClimate temperature for the selected dates.'
    });
  }
};

const __routeController326 = async (req, res) => {
  try {
    const buffer = await getMapTerraClimateTile(req.query.start, req.query.end, req.params.z, req.params.x, req.params.y);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Length': buffer.length
    });
    res.end(buffer);
  } catch (error) {
    logError('MAP_TERRACLIMATE_TILE_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'TerraClimate temperature tile is temporarily unavailable.'
    });
  }
};

const __routeController327 = async (req, res) => {
  try {
    const result = await getMapTerraClimateSeries(req.query.start, req.query.end, req.query.lat, req.query.lng);
    res.set('Cache-Control', 'private, max-age=3600');
    res.json(result);
  } catch (error) {
    logError('MAP_TERRACLIMATE_SERIES_FAILED', error.message, error.stack);
    res.status(error.statusCode || 503).json({
      error: error.statusCode === 400 ? error.message : 'Unable to prepare TerraClimate graph data for this point.'
    });
  }
};
