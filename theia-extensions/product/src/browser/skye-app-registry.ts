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
import { skyeGeneratedCatalog } from './generated/skye-generated-catalog';

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
    href?: string;
    inventoryPath?: string;
    featured: boolean;
    external: boolean;
    launchable: boolean;
    order: number;
    keywords: string[];
    platform?: boolean;
}

export interface SkyePlatformRegistry {
    source: string;
    groups: SkyePlatformGroup[];
    apps: SkyePlatformApp[];
}

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
        const generatedRegistry = this.fromGeneratedCatalog();
        if (generatedRegistry.apps.length > 0) {
            this.cachedRegistry = generatedRegistry;
            this.onDidChangeRegistryEmitter.fire(undefined);
            return generatedRegistry;
        }

        throw new Error('Unable to load the 0s app registry from the generated catalog snapshot.');
    }

    protected fromGeneratedCatalog(): SkyePlatformRegistry {
        const groups = skyeGeneratedCatalog.groups.map(group => ({ ...group }));
        const apps = skyeGeneratedCatalog.apps.map(app => ({
            id: app.id,
            label: app.label,
            summary: app.summary,
            groupId: app.groupId,
            href: app.href ?? undefined,
            inventoryPath: app.inventoryPath,
            featured: app.featured,
            external: app.external,
            launchable: app.launchable,
            order: app.order,
            keywords: [...app.keywords],
            platform: app.platform
        }));

        return {
            source: 'catalog',
            groups,
            apps
        };
    }
}