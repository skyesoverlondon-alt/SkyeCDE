/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { AbstractViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';
import { SkyeStudioLauncherWidget } from './skye-studio-launcher-widget';

export const SKYE_STUDIO_LAUNCHER_TOGGLE_COMMAND_ID = 'skye.studio.launcher.toggle';

@injectable()
export class SkyeStudioLauncherContribution extends AbstractViewContribution<SkyeStudioLauncherWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: SkyeStudioLauncherWidget.ID,
            widgetName: SkyeStudioLauncherWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 10
            },
            toggleCommandId: SKYE_STUDIO_LAUNCHER_TOGGLE_COMMAND_ID,
            toggleKeybinding: 'ctrlcmd+shift+l'
        });
    }

    async initializeLayout(): Promise<void> {
        await this.openView({ activate: false, reveal: true });
    }
}