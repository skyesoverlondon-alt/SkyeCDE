/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { open, OpenerService } from '@theia/core/lib/browser/opener-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import URI from '@theia/core/lib/common/uri';
import { LocationMapperService } from '@theia/mini-browser/lib/browser/location-mapper-service';
import { SkyePlatformApp } from './skye-app-registry';

const FILE_URI_PATTERN = /^file:\/\//i;
const HTML_FILE_PATTERN = /\.html?(?:$|[?#])/i;

export async function openSkyePlatformApp(
    openerService: OpenerService,
    locationMapperService: LocationMapperService,
    windowService: WindowService,
    app: Pick<SkyePlatformApp, 'href' | 'external'>
): Promise<void> {
    if (!app.href) {
        return;
    }

    if (FILE_URI_PATTERN.test(app.href)) {
        const uri = new URI(app.href);
        if (HTML_FILE_PATTERN.test(app.href)) {
            const launchUrl = await locationMapperService.map(app.href);
            await windowService.openNewWindow(launchUrl, { external: false });
            return;
        }
        await open(openerService, uri);
        return;
    }

    const href = app.external ? app.href : new URL(app.href, window.location.origin).toString();
    await windowService.openNewWindow(href, { external: app.external });
}