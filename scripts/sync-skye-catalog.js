#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = '/workspaces/SkyeCDE/Skye0s-s0l26';
const sourceCatalogPath = '/workspaces/SkyeCDE/SkyeDevNotes/Maintenance/Apps-Platforms/Catalog';
const appRegistryPath = path.join(repoRoot, 'Sky0s-Platforms/SuperIDE/src/data/app-registry.json');
const hubRegistryPath = path.join(repoRoot, 'Sky0s-Platforms/SuperIDE/public/S0L26-0s/hub-registry.json');
const outputPath = path.join(repoRoot, 'theia-extensions/product/src/browser/generated/skye-generated-catalog.ts');

const rawCatalog = fs.readFileSync(sourceCatalogPath, 'utf8');
const appRegistry = JSON.parse(fs.readFileSync(appRegistryPath, 'utf8'));
const hubRegistry = JSON.parse(fs.readFileSync(hubRegistryPath, 'utf8'));

const launchMap = buildLaunchMap(appRegistry, hubRegistry);
const generated = buildCatalog(rawCatalog, launchMap);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, renderCatalogModule(generated));

console.log(`Generated ${outputPath} from ${sourceCatalogPath}`);

function buildCatalog(text, launchMap) {
    const sectionMatches = [...text.matchAll(/^(\d+)\.\s+(.*)$/gm)];
    const groups = [];
    const apps = [];

    for (let index = 0; index < sectionMatches.length; index++) {
        const match = sectionMatches[index];
        const start = match.index;
        const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index : text.length;
        const block = text.slice(start, end);
        const title = match[2].trim();
        const groupId = slug(title);
        const platformPath = readIndentedValue(block, 'Path:');
        const summary = readParagraph(block, 'What it is:');

        groups.push({
            id: groupId,
            label: title,
            description: summary || platformPath || 'Catalog group from the Sky0s source-of-truth inventory.'
        });

        const rootLaunch = findLaunch(title, launchMap);
        apps.push(makeEntry({
            id: `${groupId}-platform-root`,
            label: title,
            groupId,
            summary: summary || `Platform root for ${title}.`,
            inventoryPath: platformPath,
            rawName: title,
            launch: rootLaunch,
            platform: true,
            order: index * 1000
        }));

        const bulletMatches = [...block.matchAll(/^\s*-\s+([^\n]+?)\s+—\s+(.*)$/gm)];
        let order = 1;
        for (const bullet of bulletMatches) {
            const rawName = bullet[1].trim();
            const label = humanize(rawName);
            const inventoryPath = joinInventoryPath(platformPath, rawName);
            const launch = findLaunch(label, launchMap) || findLaunch(rawName, launchMap);
            apps.push(makeEntry({
                id: `${groupId}-${slug(rawName)}`,
                label,
                groupId,
                summary: bullet[2].trim(),
                inventoryPath,
                rawName,
                launch,
                order: index * 1000 + order
            }));
            order += 1;
        }
    }

    return { groups, apps };
}

function makeEntry({ id, label, groupId, summary, inventoryPath, rawName, launch, platform = false, order }) {
    const keywords = Array.from(new Set([label, rawName, groupId].filter(Boolean)));
    return {
        id,
        label,
        summary,
        groupId,
        href: launch ? launch.href : null,
        launchable: !!launch,
        external: launch ? !!launch.external : false,
        featured: launch ? !!launch.featured : false,
        order,
        keywords,
        inventoryPath,
        platform,
        source: 'catalog'
    };
}

function buildLaunchMap(appRegistry, hubRegistry) {
    const map = new Map();

    for (const app of appRegistry.apps || []) {
        const entry = {
            href: app.surfacePath,
            external: isExternal(app.surfacePath),
            featured: !!app.featured
        };
        indexLaunch(map, app.label, entry);
        indexLaunch(map, app.id, entry);
        for (const alias of app.aliases || []) {
            indexLaunch(map, alias, entry);
        }
    }

    for (const section of hubRegistry.sections || []) {
        for (const item of section.items || []) {
            const entry = {
                href: item.href,
                external: !!item.external || isExternal(item.href),
                featured: false
            };
            indexLaunch(map, item.label, entry);
            indexLaunch(map, item.id, entry);
        }
    }

    return map;
}

function indexLaunch(map, value, entry) {
    if (!value) {
        return;
    }
    const key = normalize(value);
    if (!map.has(key)) {
        map.set(key, entry);
    }
}

function findLaunch(value, launchMap) {
    if (!value) {
        return undefined;
    }
    const clean = value.replace(/\.html$/i, '').replace(/\/$/, '');
    return launchMap.get(normalize(clean)) || launchMap.get(normalize(humanize(clean)));
}

function joinInventoryPath(platformPath, rawName) {
    if (!platformPath) {
        return rawName;
    }
    if (!rawName) {
        return platformPath;
    }
    if (rawName.startsWith('Sky0s-Platforms/')) {
        return rawName;
    }
    return `${platformPath}${rawName}`;
}

function readIndentedValue(block, label) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\n\\s+([^\\n]+)`);
    const match = block.match(pattern);
    return match ? match[1].trim() : '';
}

function readParagraph(block, label) {
    const lines = block.split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === label.trim());
    if (start === -1) {
        return '';
    }
    const parts = [];
    for (let index = start + 1; index < lines.length; index++) {
        const line = lines[index];
        if (!line.trim()) {
            if (parts.length > 0) {
                break;
            }
            continue;
        }
        if (!/^\s{2,}/.test(line)) {
            break;
        }
        if (/^[A-Z][^:]+:$/.test(line.trim())) {
            break;
        }
        parts.push(line.trim());
    }
    return parts.join(' ');
}

function humanize(value) {
    const trimmed = value.replace(/\.html$/i, '').replace(/\/$/, '').trim();
    if (!trimmed) {
        return value;
    }
    return trimmed;
}

function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isExternal(value) {
    return /^https?:\/\//i.test(value || '');
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderCatalogModule(generated) {
    return `/********************************************************************************\n * Generated from /workspaces/SkyeCDE/SkyeDevNotes/Maintenance/Apps-Platforms/Catalog\n * Do not edit manually; run node scripts/sync-skye-catalog.js\n ********************************************************************************/\n\nexport const skyeGeneratedCatalog = ${JSON.stringify(generated, null, 2)} as const;\n`;
}