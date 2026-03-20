const path = require('path');

const runtime = require(path.resolve(__dirname, '..', 'netlify', 'functions', '_lib', 'runtime'));

console.log(`storageBackend=${String(runtime.PACKAGE_STATE_BACKEND || 'file')}`);
console.log(`dataDir=${String(runtime.PACKAGE_DATA_DIR || '')}`);
console.log(`databaseTable=${String(runtime.DATABASE_TABLE || '')}`);