app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({error: err.message});
  if (err?.message?.startsWith('Invalid file type.') || err?.message?.startsWith('Invalid map image type.')) return res.status(400).json({error: err.message});
  try { logError("GLOBAL_ERROR", err.message, err.stack); } catch(e) {}
  res.status(500).json({error: "Server Error"});
});
