const { proxyRuntimeRoute } = require('../_lib/runtime-bridge');

exports.handler = async (event) => proxyRuntimeRoute(event, ['GET', 'OPTIONS'], '/api/runtime/task-logs');