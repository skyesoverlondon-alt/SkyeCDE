#!/usr/bin/env node
// @ts-check

/*
 * Generates branded desktop icons for the Skyes Over London packaging pipeline.
 *
 * Inputs:
 *   - theia-extensions/product/src/browser/icons/SkyeCreativeMark.svg
 *   - theia-extensions/product/src/browser/icons/SkyeCreativeMark-next.svg
 *
 * Outputs:
 *   - applications/electron/resources/icons/WindowIcon/512-512.png
 *   - applications/electron/resources/icons/LinuxLauncherIcons/512x512.png
 *   - applications/electron/resources/icons/512x512.png
 *   - applications/electron/resources/icons/WindowsLauncherIcons/SkyesOverLondon.ico
 *   - applications/electron/resources/icons/MacLauncherIcons/icon.icns (when iconutil is available)
 *   - next-channel PNG equivalents under applications/electron-next/resources/icons/
 *
 * Regenerating assets requires ImageMagick (`convert`) for PNG/ICO generation.
 * macOS ICNS generation additionally requires `iconutil`.
 * If the expected PNG assets are already present, Linux packaging can reuse them.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const VARIANTS = {
    stable: {
        source: path.join(ROOT, 'theia-extensions/product/src/browser/icons/SkyeCreativeMark.svg'),
        targetDir: path.join(ROOT, 'applications/electron/resources/icons'),
        generateWindows: true,
        generateMac: true,
    },
    next: {
        source: path.join(ROOT, 'theia-extensions/product/src/browser/icons/SkyeCreativeMark-next.svg'),
        targetDir: path.join(ROOT, 'applications/electron-next/resources/icons'),
        generateWindows: false,
        generateMac: false,
    }
};

function hasCommand(command, args = ['--version']) {
    try {
        childProcess.execFileSync(command, args, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function run(command, args) {
    childProcess.execFileSync(command, args, { stdio: 'inherit' });
}

function generatePng(svgPath, outputPath, size) {
    ensureDir(path.dirname(outputPath));
    run('convert', [svgPath, '-background', 'none', '-resize', `${size}x${size}`, outputPath]);
}

function generateIco(svgPath, outputPath) {
    ensureDir(path.dirname(outputPath));
    run('convert', [svgPath, '-background', 'none', '-define', 'icon:auto-resize=16,24,32,48,64,128,256', outputPath]);
}

function generateIcns(svgPath, outputPath) {
    if (process.platform !== 'darwin') {
        return;
    }
    if (!hasCommand('iconutil', ['-h'])) {
        console.warn(`Skipping ICNS generation for ${path.basename(outputPath)} because iconutil is not available.`);
        return;
    }

    const iconsetDir = path.join(os.tmpdir(), `skye-iconset-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    ensureDir(iconsetDir);

    const iconset = [
        ['icon_16x16.png', 16],
        ['icon_16x16@2x.png', 32],
        ['icon_32x32.png', 32],
        ['icon_32x32@2x.png', 64],
        ['icon_128x128.png', 128],
        ['icon_128x128@2x.png', 256],
        ['icon_256x256.png', 256],
        ['icon_256x256@2x.png', 512],
        ['icon_512x512.png', 512],
        ['icon_512x512@2x.png', 1024],
    ];

    try {
        for (const [fileName, size] of iconset) {
            generatePng(svgPath, path.join(iconsetDir, fileName), size);
        }
        ensureDir(path.dirname(outputPath));
        run('iconutil', ['-c', 'icns', '-o', outputPath, iconsetDir]);
    } finally {
        fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
}

function existingPngOutputs(variant) {
    return [
        path.join(variant.targetDir, 'WindowIcon/512-512.png'),
        path.join(variant.targetDir, 'LinuxLauncherIcons/512x512.png'),
        path.join(variant.targetDir, '512x512.png'),
    ];
}

function generateVariant(variantName) {
    const variant = VARIANTS[variantName];
    if (!variant) {
        throw new Error(`Unknown variant: ${variantName}`);
    }

    if (!fs.existsSync(variant.source)) {
        throw new Error(`Source SVG not found: ${variant.source}`);
    }

    if (!hasCommand('convert')) {
        const reusableOutputs = existingPngOutputs(variant);
        const missingOutputs = reusableOutputs.filter(output => !fs.existsSync(output));
        if (missingOutputs.length === 0) {
            console.warn(
                `ImageMagick \`convert\` is not available. Reusing existing branded icon assets for ${variantName}.`
            );
            return;
        }
        throw new Error(
            'ImageMagick `convert` is required to generate branded desktop icons when prebuilt assets are missing.'
        );
    }

    console.log(`Generating ${variantName} branded icons from ${path.relative(ROOT, variant.source)}`);

    generatePng(variant.source, path.join(variant.targetDir, 'WindowIcon/512-512.png'), 512);
    generatePng(variant.source, path.join(variant.targetDir, 'LinuxLauncherIcons/512x512.png'), 512);
    generatePng(variant.source, path.join(variant.targetDir, '512x512.png'), 512);

    if (variant.generateWindows) {
        generateIco(variant.source, path.join(variant.targetDir, 'WindowsLauncherIcons/SkyesOverLondon.ico'));
    }

    if (variant.generateMac) {
        generateIcns(variant.source, path.join(variant.targetDir, 'MacLauncherIcons/icon.icns'));
    }
}

function main() {
    const requested = process.argv[2] || 'all';
    const variants = requested === 'all' ? Object.keys(VARIANTS) : requested.split(',').map(entry => entry.trim()).filter(Boolean);

    for (const variant of variants) {
        generateVariant(variant);
    }

    console.log('Branded desktop icon generation complete.');
}

main();