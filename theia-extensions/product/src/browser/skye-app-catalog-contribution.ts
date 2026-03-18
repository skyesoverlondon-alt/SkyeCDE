/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution, WidgetManager } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { VSXExtensionsViewContainer } from '@theia/vsx-registry/lib/browser/vsx-extensions-view-container';
import { SkyeAppCatalogWidget } from './skye-app-catalog-widget';

@injectable()
export class SkyeAppCatalogContribution implements FrontendApplicationContribution {

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    async initializeLayout(): Promise<void> {
        const container = await this.widgetManager.getOrCreateWidget(VSXExtensionsViewContainer.ID) as VSXExtensionsViewContainer;
        const widget = await this.widgetManager.getOrCreateWidget(SkyeAppCatalogWidget.ID) as SkyeAppCatalogWidget;
        container.addWidget(widget, {
            order: 5,
            initiallyCollapsed: false
        });
    }
}