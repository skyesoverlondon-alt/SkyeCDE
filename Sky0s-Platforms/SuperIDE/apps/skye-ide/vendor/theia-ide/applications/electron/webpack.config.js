/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const fs = require('fs');
const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');

/**
 * Webpack plugin to patch the bundled ripgrep path for asar compatibility.
 * When packaged with asar, __dirname resolves inside app.asar but the native binaries
 * are extracted to app.asar.unpacked via asarUnpack.
 *
 * The native-webpack-plugin bundles ripgrep path resolution directly into main.js,
 * so we need to patch the bundle after emit to add asar path rewriting.
 */
class PatchRipgrepPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tapAsync('PatchRipgrepPlugin', (compilation, callback) => {
            const mainJsPath = path.join(compiler.outputPath, 'main.js');
            if (fs.existsSync(mainJsPath)) {
                let content = fs.readFileSync(mainJsPath, 'utf8');
                let patched = false;
                const patterns = [
                    /(\w+)\.rgPath\s*=\s*(\w+)\.join\(\s*__dirname\s*,\s*["']\.\/native\/rg["']\s*\+\s*\(["']win32["']\s*===\s*process\.platform\s*\?\s*["']\.exe["']\s*:\s*["']["']\s*\)\s*\)/g,
                    /(\w+)\.rgPath\s*=\s*(\w+)\.join\(\s*__dirname\s*,\s*`\.\/native\/rg\$\{process\.platform\s*===\s*['"]win32['"]\s*\?\s*['"]\.exe['"]\s*:\s*['"]['"]}\s*`\s*\)/g
                ];

                let newContent = content;
                for (const pattern of patterns) {
                    newContent = newContent.replace(pattern, (match, exportsVar, pathVar) => {
                        patched = true;
                        return `(()=>{const p=${pathVar}.join(__dirname,"./native/rg"+("win32"===process.platform?".exe":""));return ${exportsVar}.rgPath=p.includes(".asar"+${pathVar}.sep)?p.replace(".asar"+${pathVar}.sep,".asar.unpacked"+${pathVar}.sep):p})()`;
                    });
                }

                if (patched) {
                    fs.writeFileSync(mainJsPath, newContent);
                    console.log('Patched main.js ripgrep path for asar compatibility');
                } else {
                    throw new Error('Could not find ripgrep pattern to patch in main.js. The pattern may have changed in @theia/native-webpack-plugin.');
                }
            }
            callback();
        });
    }
}

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

/**
 * Do no run TerserPlugin with parallel: true
 * Each spawned node may take the full memory configured via NODE_OPTIONS / --max_old_space_size
 * In total this may lead to OOM issues
 */
if (nodeConfig.config.optimization) {
    nodeConfig.config.optimization = {
        ...(nodeConfig.config.optimization || {}),
        minimize: false,
        minimizer: []
    };
}
nodeConfig.config.devtool = false;
nodeConfig.config.cache = false;
nodeConfig.config.parallelism = 1;
nodeConfig.config.stats = 'errors-warnings';

for (const config of configs) {
    config.devtool = false;
    config.cache = false;
    config.parallelism = 1;
    config.stats = 'errors-warnings';
    config.optimization = {
        ...(config.optimization || {}),
        minimize: false,
        minimizer: []
    };
    if (config.plugins) {
        config.plugins = config.plugins.filter(plugin => !(plugin instanceof CompressionPlugin));
    }
    if (config.module?.rules) {
        config.module.rules = config.module.rules.filter(rule => rule.loader !== 'source-map-loader');
    }
}

// Add the ripgrep patch plugin to the node config
nodeConfig.config.plugins = nodeConfig.config.plugins || [];
nodeConfig.config.plugins.push(new PatchRipgrepPlugin());

module.exports = [
    ...configs,
    nodeConfig.config
];