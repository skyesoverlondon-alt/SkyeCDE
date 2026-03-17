/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const productExtensionPath = path.resolve(__dirname, '..', '..', 'theia-extensions', 'product');

const benignWarnings = [
    warning => /simpleWorker\.js/.test(warning.module?.resource || '') && /the request of a dependency is an expression/.test(warning.message || ''),
    warning => /editorSimpleWorker\.js/.test(warning.module?.resource || '') && /the request of a dependency is an expression/.test(warning.message || '')
];

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

// serve favico from root
// @ts-ignore
configs[0].plugins.push(
    // @ts-ignore
    new CopyWebpackPlugin({
        patterns: [
            {
                context: path.resolve('.', '..', '..', 'applications', 'browser', 'ico'),
                from: '**'
            }
        ]
    })
);

configs.forEach(config => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'theia-ide-product-ext': productExtensionPath
    };
    config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        ...benignWarnings
    ];
});

module.exports = [
    ...configs,
    nodeConfig.config
];