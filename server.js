const { buildFrontend } = require('./scripts/build-frontend');
const { loadBackend } = require('./scripts/load-backend');

buildFrontend();
loadBackend(module);
