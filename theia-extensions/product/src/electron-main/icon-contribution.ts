/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as os from 'os';

import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';

import { injectable } from '@theia/core/shared/inversify';
import { BrowserWindow, nativeImage } from '@theia/core/electron-shared/electron';

const STUDIO_WINDOW_ICON = nativeImage.createFromDataURL('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs>
        <linearGradient id="studioGradient" x1="18" y1="14" x2="110" y2="114" gradientUnits="userSpaceOnUse">
            <stop stop-color="#A243FF"/>
            <stop offset="0.55" stop-color="#FFD660"/>
            <stop offset="1" stop-color="#27F2FF"/>
        </linearGradient>
        <linearGradient id="studioGlass" x1="36" y1="42" x2="92" y2="98" gradientUnits="userSpaceOnUse">
            <stop stop-color="rgba(255,255,255,.28)"/>
            <stop offset="1" stop-color="rgba(255,255,255,.08)"/>
        </linearGradient>
    </defs>
    <rect x="8" y="8" width="112" height="112" rx="30" fill="#0B0C14"/>
    <rect x="20" y="24" width="88" height="24" rx="12" fill="url(#studioGradient)"/>
    <path d="M36 67c0-7.732 6.268-14 14-14h32c7.732 0 14 6.268 14 14v11c0 7.732-6.268 14-14 14H50c-7.732 0-14-6.268-14-14V67Z" fill="url(#studioGlass)" stroke="#27F2FF" stroke-width="2.4"/>
    <circle cx="64" cy="72" r="10" fill="#FFD660" opacity=".92"/>
</svg>
`));

@injectable()
export class IconContribution implements ElectronMainApplicationContribution {

    onStart(application: ElectronMainApplication): void {
        if (os.platform() === 'linux') {
            const windowOptions = application.config.electron.windowOptions;
            if (windowOptions && windowOptions.icon === undefined) {
                // The window image is undefined. If the executable has an image set, this is used as a fallback.
                // Since AppImage does not support this anymore via electron-builder, set an image for the linux platform.
                windowOptions.icon = STUDIO_WINDOW_ICON;
                // also update any existing windows, e.g. the splashscreen
                for (const window of BrowserWindow.getAllWindows()) {
                    window.setIcon(STUDIO_WINDOW_ICON);
                }
            }

        }
    }
}
