/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { LocationMapperService } from '@theia/mini-browser/lib/browser/location-mapper-service';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { openSkyePlatformApp } from './skye-app-opener';
import { SkyeAppRegistryService, SkyePlatformApp, SkyePlatformGroup, SkyePlatformRegistry } from './skye-app-registry';

@injectable()
export class SkyeAppCatalogWidget extends ReactWidget {

    static readonly ID = 'skye-app-catalog-widget';
    static readonly LABEL = '0s App Catalog';

    protected registry: SkyePlatformRegistry | undefined;
    protected loadError: string | undefined;

    @inject(SkyeAppRegistryService)
    protected readonly registryService: SkyeAppRegistryService;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(LocationMapperService)
    protected readonly locationMapperService: LocationMapperService;

    @postConstruct()
    protected init(): void {
        this.id = SkyeAppCatalogWidget.ID;
        this.title.label = SkyeAppCatalogWidget.LABEL;
        this.title.caption = 'Built-in 0s platform registry';
        this.title.closable = false;
        this.title.iconClass = codicon('package');
        this.addClass('skye-app-catalog-widget');
        void this.loadRegistry();
    }

    protected async loadRegistry(): Promise<void> {
        try {
            this.registry = await this.registryService.getRegistry();
            this.loadError = undefined;
        } catch (error) {
            this.loadError = error instanceof Error ? error.message : 'Unable to load the app registry.';
        }
        this.update();
    }

    protected async launch(app: SkyePlatformApp): Promise<void> {
        await openSkyePlatformApp(this.openerService, this.locationMapperService, this.windowService, app);
    }

    protected renderGroup(group: SkyePlatformGroup, apps: SkyePlatformApp[]): React.ReactNode {
        if (!apps.length) {
            return undefined;
        }
        return <section key={group.id} className='skye-catalog-group'>
            <div className='skye-catalog-group-header'>
                <div>
                    <h3>{group.label}</h3>
                    {group.description && <p>{group.description}</p>}
                </div>
                <span className='skye-catalog-group-count'>{apps.length} launch paths</span>
            </div>
            <div className='skye-catalog-grid'>
                {apps.map(app => <button
                    key={`${app.id}:${app.inventoryPath ?? app.href ?? app.label}`}
                    className='skye-catalog-card'
                    disabled={!app.launchable}
                    onClick={() => void this.launch(app)}
                >
                    <span className='skye-catalog-card-badge'>{badgeText(app.label)}</span>
                    <span className='skye-catalog-card-copy'>
                        <strong>{app.label}</strong>
                        <small>{app.summary}</small>
                    </span>
                    <span className='skye-catalog-card-meta'>
                        <span>{app.external ? 'External app' : 'Open app'}</span>
                        <i className={codicon('arrow-up-right')}></i>
                    </span>
                </button>)}
            </div>
        </section>;
    }

    override render(): React.ReactNode {
        if (this.loadError) {
            return <div className='skye-catalog-shell'>
                <section className='skye-catalog-hero'>
                    <h3>0s App Catalog</h3>
                    <p>{this.loadError}</p>
                </section>
            </div>;
        }

        const groups = this.registry?.groups ?? [];
        const apps = (this.registry?.apps ?? []).filter(app => app.launchable && app.href);
        const launchableCount = apps.length;
        const inventoryOnlyCount = (this.registry?.apps ?? []).length - apps.length;

        return <div className='skye-catalog-shell'>
            <section className='skye-catalog-hero'>
                <span className='skye-badge'>Built-in 0s registry</span>
                <h2>Launch platform apps from the Extensions surface.</h2>
                <p>This section exposes the first-party 0s catalog inside Extensions so users can launch real product surfaces without treating OpenVSX as the product identity.</p>
                {inventoryOnlyCount > 0 && <p>{inventoryOnlyCount} inventory-only registry entries are hidden here so this surface stays launch-focused.</p>}
                <div className='skye-catalog-hero-stats'>
                    <div>
                        <strong>{apps.length}</strong>
                        <span>Launchable entries</span>
                    </div>
                    <div>
                        <strong>{launchableCount}</strong>
                        <span>Launchable entries</span>
                    </div>
                    <div>
                        <strong>{inventoryOnlyCount}</strong>
                        <span>Hidden inventory entries</span>
                    </div>
                    <div>
                        <strong>{groups.length}</strong>
                        <span>Platform groups</span>
                    </div>
                </div>
            </section>
            {groups.map(group => this.renderGroup(group, apps.filter(app => app.groupId === group.id)))}
        </div>;
    }
}

function badgeText(label: string): string {
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
}