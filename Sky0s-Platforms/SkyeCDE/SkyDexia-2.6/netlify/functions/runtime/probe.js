const { proxyRuntimeRoute } = require('../_lib/runtime-bridge');

exports.handler = async (event) => proxyRuntimeRoute(event, ['POST', 'OPTIONS'], '/api/runtime/probe');