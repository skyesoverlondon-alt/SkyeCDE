#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = '/workspaces/SkyeCDE/Skye0s-s0l26';
const sourceCatalogPath = '/workspaces/SkyeCDE/SkyeDevNotes/Maintenance/Apps-Platforms/Catalog';
const appRegistryPath = path.join(repoRoot, 'Sky0s-Platforms/SuperIDE/src/data/app-registry.json');
const hubRegistryPath = path.join(repoRoot, 'Sky0s-Platforms/SuperIDE/public/S0L26-0s/hub-registry.json');
const skyeCdeManifestPath = path.join(repoRoot, 'Sky0s-Platforms/SkyeCDE/skyecde-manifest.json');
const outputPath = path.join(repoRoot, 'theia-extensions/product/src/browser/generated/skye-generated-catalog.ts');

const rawCatalog = fs.readFileSync(sourceCatalogPath, 'utf8');
const appRegistry = JSON.parse(fs.readFileSync(appRegistryPath, 'utf8'));
const hubRegistry = JSON.parse(fs.readFileSync(hubRegistryPath, 'utf8'));
const skyeCdeManifest = fs.existsSync(skyeCdeManifestPath) ? JSON.parse(fs.readFileSync(skyeCdeManifestPath, 'utf8')) : undefined;
const descendantIndexCache = new Map();
const preferredLaunchFiles = ['index.html', 'Index.html', 'index.htm', 'portal.html', 'intro.html', 'home.html', 'landing.html', 'ide.html', 'README.md', 'readme.md'];

const launchMap = buildLaunchMap(appRegistry, hubRegistry);
const generated = buildCatalog(rawCatalog, launchMap);
mergeSkyeCdeBuilds(generated, skyeCdeManifest);
promoteSkyeCdeAsPrimary(generated);

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

        const rootLaunch = resolveLocalLaunch({ inventoryPath: platformPath, rawName: title, platformPath, platform: true })
            || findLaunch([title, platformPath], launchMap);
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
            if (shouldSkipCatalogBullet(groupId, rawName)) {
                continue;
            }
            const label = humanize(rawName);
            const inventoryPath = joinInventoryPath(platformPath, rawName);
            const launch = resolveLocalLaunch({ inventoryPath, rawName, platformPath })
                || findLaunch([label, rawName, inventoryPath], launchMap);
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

function shouldSkipCatalogBullet(groupId, rawName) {
    if (groupId !== 'skyecde') {
        return false;
    }

    return rawName === 'index.html'
        || rawName === 'skyecde-manifest.json'
        || rawName === '_shared/'
        || rawName === '_shared';
}

function mergeSkyeCdeBuilds(generated, manifest) {
    if (!manifest?.builds?.length) {
        return;
    }

    const group = generated.groups.find(entry => entry.id === 'skyecde');
    if (!group) {
        return;
    }

    const manifestDir = path.dirname(skyeCdeManifestPath);
    const existingIds = new Set(generated.apps.map(app => app.id));
    const groupApps = generated.apps.filter(app => app.groupId === 'skyecde');
    const baseOrder = groupApps.reduce((max, app) => Math.max(max, app.order), 8000);

    manifest.builds.forEach((build, index) => {
        const id = `skyecde-${slug(build.id || build.label || `build-${index + 1}`)}`;
        if (existingIds.has(id)) {
            return;
        }

        const hrefPath = typeof build.href === 'string' ? build.href : '';
        const resolvedRelativePath = path.relative(repoRoot, path.resolve(manifestDir, hrefPath));
        const launch = resolveLocalLaunch({
            inventoryPath: resolvedRelativePath,
            rawName: build.label || build.id || `Build ${index + 1}`,
            platformPath: 'Sky0s-Platforms/SkyeCDE/'
        });
        if (!launch) {
            return;
        }

        const summaryParts = [
            build.summary,
            build.status ? `Status: ${build.status}.` : undefined,
            build.source ? `Source platform: ${build.source}.` : undefined
        ].filter(Boolean);

        generated.apps.push({
            id,
            label: build.label || build.id || `Build ${index + 1}`,
            summary: summaryParts.join(' ') || 'SkyeCDE upgraded IDE build.',
            groupId: 'skyecde',
            href: launch.href,
            launchable: true,
            external: false,
            featured: index === 0,
            order: baseOrder + index + 1,
            keywords: Array.from(new Set([
                build.label,
                build.id,
                build.status,
                'SkyeCDE'
            ].filter(Boolean))),
            inventoryPath: resolvedRelativePath,
            platform: false,
            source: 'skycde-manifest'
        });
        existingIds.add(id);
    });
}

function promoteSkyeCdeAsPrimary(generated) {
    const groupIndex = generated.groups.findIndex(group => group.id === 'skyecde');
    if (groupIndex > 0) {
        const [group] = generated.groups.splice(groupIndex, 1);
        generated.groups.unshift(group);
    }

    const skyecdeApps = generated.apps
        .filter(app => app.groupId === 'skyecde')
        .sort((left, right) => {
            if (left.platform !== right.platform) {
                return left.platform ? -1 : 1;
            }
            return left.order - right.order || left.label.localeCompare(right.label);
        });

    if (!skyecdeApps.length) {
        return;
    }

    skyecdeApps.forEach((app, index) => {
        app.order = -10000 + index;
        if (app.platform) {
            app.featured = true;
        }
        if (app.id === 'skyecde-skydexia') {
            app.featured = true;
        }
    });

    const orderedSkyecdeIds = new Set(skyecdeApps.map(app => `${app.id}:${app.href || ''}`));
    const remainingApps = generated.apps.filter(app => !orderedSkyecdeIds.has(`${app.id}:${app.href || ''}`));
    generated.apps.splice(0, generated.apps.length, ...skyecdeApps, ...remainingApps);
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

function findLaunch(values, launchMap) {
    const candidates = Array.isArray(values) ? values.flatMap(value => launchCandidates(value)) : launchCandidates(values);
    for (const candidate of candidates) {
        const match = launchMap.get(normalize(candidate));
        if (match) {
            return match;
        }
    }
    return undefined;
}

function resolveLocalLaunch({ inventoryPath, rawName, platformPath, platform = false }) {
    const candidates = collectLocalPathCandidates(inventoryPath, rawName, platformPath, platform);
    for (const candidate of candidates) {
        const targetPath = resolveWorkspaceTarget(candidate);
        if (targetPath) {
            return {
                href: pathToFileURL(targetPath).toString(),
                external: false,
                featured: false
            };
        }
    }
    return undefined;
}

function collectLocalPathCandidates(inventoryPath, rawName, platformPath, platform) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = value => {
        if (!value || seen.has(value)) {
            return;
        }
        seen.add(value);
        candidates.push(value);
    };

    addCandidate(inventoryPath);
    for (const segment of splitCompositeEntry(rawName)) {
        addCandidate(segment.startsWith('Sky0s-Platforms/') ? segment : joinInventoryPath(platformPath, segment));
    }

    const platformRoot = platformPath ? path.join(repoRoot, platformPath) : undefined;
    if (platformRoot && exists(platformRoot)) {
        for (const segment of splitCompositeEntry(rawName)) {
            const segmentName = path.basename(segment.replace(/\/$/, ''));
            for (const match of findDescendantMatches(platformRoot, segmentName)) {
                addCandidate(path.relative(repoRoot, match));
            }
        }
        if (platform) {
            for (const match of findDescendantMatches(platformRoot, 'index.html')) {
                addCandidate(path.relative(repoRoot, match));
            }
        }
    }

    return candidates;
}

function splitCompositeEntry(rawName) {
    if (!rawName) {
        return [];
    }
    return rawName
        .split(/\s+and\s+|,\s*/)
        .map(part => part.trim())
        .filter(Boolean);
}

function resolveWorkspaceTarget(relativePath) {
    if (!relativePath) {
        return undefined;
    }
    const absolutePath = path.join(repoRoot, relativePath);
    if (!exists(absolutePath)) {
        return undefined;
    }
    const stat = fs.statSync(absolutePath);
    if (stat.isFile()) {
        return absolutePath;
    }
    if (!stat.isDirectory()) {
        return undefined;
    }
    return resolveDirectoryTarget(absolutePath) || absolutePath;
}

function resolveDirectoryTarget(directoryPath, visited = new Set()) {
    const normalizedPath = path.normalize(directoryPath);
    if (visited.has(normalizedPath)) {
        return undefined;
    }
    visited.add(normalizedPath);

    for (const fileName of preferredLaunchFiles) {
        const candidate = path.join(directoryPath, fileName);
        if (exists(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
        .filter(entry => !entry.name.startsWith('.'));
    const htmlFile = entries
        .filter(entry => entry.isFile() && /\.html?$/i.test(entry.name))
        .map(entry => path.join(directoryPath, entry.name))
        .sort()[0];
    if (htmlFile) {
        return htmlFile;
    }

    const childDirectories = entries.filter(entry => entry.isDirectory());
    if (childDirectories.length === 1) {
        const nested = resolveDirectoryTarget(path.join(directoryPath, childDirectories[0].name), visited);
        if (nested) {
            return nested;
        }
    }

    const baseName = normalize(path.basename(directoryPath));
    const rankedDirectories = childDirectories
        .map(entry => ({ name: entry.name, score: scoreNestedDirectory(entry.name, baseName) }))
        .filter(entry => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    for (const entry of rankedDirectories) {
        const nested = resolveDirectoryTarget(path.join(directoryPath, entry.name), visited);
        if (nested) {
            return nested;
        }
    }

    const fallbackFile = entries
        .filter(entry => entry.isFile())
        .map(entry => path.join(directoryPath, entry.name))
        .sort()[0];
    if (fallbackFile) {
        return fallbackFile;
    }

    for (const entry of childDirectories.sort((left, right) => left.name.localeCompare(right.name))) {
        const nested = resolveDirectoryTarget(path.join(directoryPath, entry.name), visited);
        if (nested) {
            return nested;
        }
    }

    return undefined;
}

function scoreNestedDirectory(name, baseName) {
    const normalizedName = normalize(name);
    let score = 0;
    if (baseName && normalizedName.includes(baseName)) {
        score += 4;
    }
    if (normalizedName.includes('platform')) {
        score += 3;
    }
    if (normalizedName.includes('app')) {
        score += 1;
    }
    return score;
}

function findDescendantMatches(rootDirectory, baseName) {
    if (!rootDirectory || !baseName || !exists(rootDirectory) || !fs.statSync(rootDirectory).isDirectory()) {
        return [];
    }
    const cacheKey = path.normalize(rootDirectory);
    let index = descendantIndexCache.get(cacheKey);
    if (!index) {
        index = buildDescendantIndex(rootDirectory);
        descendantIndexCache.set(cacheKey, index);
    }

    return (index.get(normalize(baseName)) || []).slice();
}

function buildDescendantIndex(rootDirectory) {
    const index = new Map();
    const stack = [rootDirectory];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            const absolutePath = path.join(current, entry.name);
            const key = normalize(entry.name.replace(/\/$/, ''));
            if (!index.has(key)) {
                index.set(key, []);
            }
            index.get(key).push(absolutePath);
            if (entry.isDirectory()) {
                stack.push(absolutePath);
            }
        }
    }

    for (const matches of index.values()) {
        matches.sort((left, right) => depth(left) - depth(right) || left.localeCompare(right));
    }
    return index;
}

function depth(value) {
    return value.split(path.sep).length;
}

function exists(value) {
    try {
        fs.accessSync(value);
        return true;
    } catch {
        return false;
    }
}

function launchCandidates(value) {
    if (!value) {
        return [];
    }
    const clean = value.replace(/\\.html$/i, '').replace(/\/$/, '').trim();
    if (!clean) {
        return [];
    }

    const candidates = new Set([clean, humanize(clean)]);
    const trimmedPath = clean
        .replace(/^Sky0s-Platforms\//, '')
        .replace(/^SuperIDE\//, '')
        .replace(/^public\//, '')
        .replace(/^apps\//, '');
    const baseName = path.basename(trimmedPath);
    if (trimmedPath) {
        candidates.add(trimmedPath);
        candidates.add(humanize(trimmedPath));
    }
    if (baseName) {
        candidates.add(baseName);
        candidates.add(humanize(baseName));
    }

    return [...candidates].filter(Boolean);
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
    const trimmed = path.basename(value.replace(/\.html$/i, '').replace(/\/$/, '').trim());
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