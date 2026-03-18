/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Emitter } from '@theia/core/lib/common/event';
import { injectable } from '@theia/core/shared/inversify';

export interface SkyePlatformGroup {
    id: string;
    label: string;
    description?: string;
}

export interface SkyePlatformApp {
    id: string;
    label: string;
    summary: string;
    groupId: string;
    href: string;
    featured: boolean;
    external: boolean;
    order: number;
    keywords: string[];
}

export interface SkyePlatformRegistry {
    source: string;
    groups: SkyePlatformGroup[];
    apps: SkyePlatformApp[];
}

interface AppRegistryPayload {
    groups?: Array<{ id?: string; label?: string; description?: string }>;
    apps?: Array<{
        id?: string;
        label?: string;
        summary?: string;
        groupId?: string;
        surfacePath?: string;
        featured?: boolean;
        drawerOrder?: number;
        searchTerms?: string[];
        aliases?: string[];
    }>;
}

interface HubRegistryPayload {
    sections?: Array<{
        id?: string;
        title?: string;
        description?: string;
        items?: Array<{
            id?: string;
            label?: string;
            href?: string;
            summary?: string;
            external?: boolean;
        }>;
    }>;
}

const REGISTRY_CANDIDATES = [
    '/_shared/app-registry.json',
    '/S0L26-0s/hub-registry.json'
];

@injectable()
export class SkyeAppRegistryService {

    protected readonly onDidChangeRegistryEmitter = new Emitter<void>();
    readonly onDidChangeRegistry = this.onDidChangeRegistryEmitter.event;

    protected registryPromise: Promise<SkyePlatformRegistry> | undefined;
    protected cachedRegistry: SkyePlatformRegistry | undefined;

    async getRegistry(): Promise<SkyePlatformRegistry> {
        if (this.cachedRegistry) {
            return this.cachedRegistry;
        }
        if (!this.registryPromise) {
            this.registryPromise = this.loadRegistry();
        }
        return this.registryPromise;
    }

    protected async loadRegistry(): Promise<SkyePlatformRegistry> {
        const registries: SkyePlatformRegistry[] = [];
        for (const candidate of REGISTRY_CANDIDATES) {
            try {
                const response = await fetch(candidate, { method: 'GET' });
                if (!response.ok) {
                    continue;
                }
                const payload = await response.json();
                const registry = candidate.includes('app-registry')
                    ? this.fromAppRegistry(payload as AppRegistryPayload)
                    : this.fromHubRegistry(payload as HubRegistryPayload);
                if (registry.apps.length > 0) {
                    registries.push(registry);
                }
            } catch {
                continue;
            }
        }

        if (registries.length > 0) {
            const merged = this.mergeRegistries(registries);
            this.cachedRegistry = merged;
            this.onDidChangeRegistryEmitter.fire(undefined);
            return merged;
        }

        throw new Error('Unable to load the 0s app registry from the current runtime.');
    }

    protected mergeRegistries(registries: SkyePlatformRegistry[]): SkyePlatformRegistry {
        const groups = new Map<string, SkyePlatformGroup>();
        const apps = new Map<string, SkyePlatformApp>();

        for (const registry of registries) {
            for (const group of registry.groups) {
                if (!groups.has(group.id)) {
                    groups.set(group.id, group);
                }
            }
            for (const app of registry.apps) {
                const key = `${app.id}::${app.href}`;
                const existing = apps.get(key);
                if (!existing) {
                    apps.set(key, app);
                    continue;
                }
                apps.set(key, {
                    ...existing,
                    summary: existing.summary.length >= app.summary.length ? existing.summary : app.summary,
                    featured: existing.featured || app.featured,
                    external: existing.external || app.external,
                    order: Math.min(existing.order, app.order),
                    keywords: Array.from(new Set([...existing.keywords, ...app.keywords]))
                });
            }
        }

        return {
            source: 'aggregated',
            groups: Array.from(groups.values()),
            apps: Array.from(apps.values()).sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
        };
    }

    protected fromAppRegistry(payload: AppRegistryPayload): SkyePlatformRegistry {
        const groups = (payload.groups ?? [])
            .filter(group => !!group.id && !!group.label)
            .map(group => ({
                id: group.id!,
                label: group.label!,
                description: group.description
            }));

        const apps = (payload.apps ?? [])
            .filter(app => !!app.id && !!app.label && !!app.surfacePath)
            .map(app => ({
                id: app.id!,
                label: app.label!,
                summary: app.summary ?? 'Launch this 0s surface from the platform catalog.',
                groupId: app.groupId ?? 'platforms',
                href: app.surfacePath!,
                featured: !!app.featured,
                external: isExternalHref(app.surfacePath!),
                order: app.drawerOrder ?? Number.MAX_SAFE_INTEGER,
                keywords: [...(app.searchTerms ?? []), ...(app.aliases ?? [])]
            }))
            .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

        return {
            source: 'app-registry',
            groups,
            apps
        };
    }

    protected fromHubRegistry(payload: HubRegistryPayload): SkyePlatformRegistry {
        const groups = (payload.sections ?? [])
            .filter(section => !!section.id && !!section.title)
            .map(section => ({
                id: section.id!,
                label: section.title!,
                description: section.description
            }));

        const apps = (payload.sections ?? []).flatMap((section, sectionIndex) =>
            (section.items ?? [])
                .filter(item => !!item.id && !!item.label && !!item.href)
                .map((item, itemIndex) => ({
                    id: item.id!,
                    label: item.label!,
                    summary: item.summary ?? 'Launch this 0s surface from the platform catalog.',
                    groupId: section.id ?? 'platforms',
                    href: item.href!,
                    featured: sectionIndex === 0 && itemIndex < 6,
                    external: !!item.external || isExternalHref(item.href!),
                    order: sectionIndex * 100 + itemIndex,
                    keywords: []
                }))
        );

        return {
            source: 'hub-registry',
            groups,
            apps
        };
    }
}

function isExternalHref(href: string): boolean {
    return /^https?:\/\//i.test(href);
}