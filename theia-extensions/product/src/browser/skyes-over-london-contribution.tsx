/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { inject, injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@theia/core/lib/common/menu';
import { WindowService } from '@theia/core/lib/browser/window/window-service';

const PRODUCT_SOURCE_URL = 'https://github.com/SkyeCDE/SkyeCDE';
const PRODUCT_ISSUES_URL = `${PRODUCT_SOURCE_URL}/issues`;
const PRODUCT_DOCS_URL = `${PRODUCT_SOURCE_URL}#readme`;

export namespace SkyesOverLondonMenus {
    export const HELP: MenuPath = [...CommonMenus.HELP, 'skyes-over-london'];
}
export namespace SkyesOverLondonCommands {
    export const CATEGORY = 'Skyes Over London';
    export const REPORT_ISSUE: Command = {
        id: 'skyes-over-london:report-issue',
        category: CATEGORY,
        label: 'Platform Issues'
    };
    export const DOCUMENTATION: Command = {
        id: 'skyes-over-london:documentation',
        category: CATEGORY,
        label: 'Platform Docs'
    };
    export const OPEN_APP_CATALOG: Command = {
        id: 'skyes-over-london:open-app-catalog',
        category: CATEGORY,
        label: 'Open 0s App Catalog'
    };
}

@injectable()
export class SkyesOverLondonContribution implements CommandContribution, MenuContribution {

    @inject(WindowService)
    protected readonly windowService: WindowService;

    static REPORT_ISSUE_URL = PRODUCT_ISSUES_URL;
    static DOCUMENTATION_URL = PRODUCT_DOCS_URL;

    registerCommands(commandRegistry: CommandRegistry): void {
        commandRegistry.registerCommand(SkyesOverLondonCommands.REPORT_ISSUE, {
            execute: () => this.windowService.openNewWindow(SkyesOverLondonContribution.REPORT_ISSUE_URL, { external: true })
        });
        commandRegistry.registerCommand(SkyesOverLondonCommands.DOCUMENTATION, {
            execute: () => this.windowService.openNewWindow(SkyesOverLondonContribution.DOCUMENTATION_URL, { external: true })
        });
        commandRegistry.registerCommand(SkyesOverLondonCommands.OPEN_APP_CATALOG, {
            execute: async () => {
                await commandRegistry.executeCommand('vsxExtensions.toggle');
                await commandRegistry.executeCommand('vsxExtension.showBuiltins');
            }
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(SkyesOverLondonMenus.HELP, {
            commandId: SkyesOverLondonCommands.REPORT_ISSUE.id,
            label: SkyesOverLondonCommands.REPORT_ISSUE.label,
            order: '1'
        });
        menus.registerMenuAction(SkyesOverLondonMenus.HELP, {
            commandId: SkyesOverLondonCommands.DOCUMENTATION.id,
            label: SkyesOverLondonCommands.DOCUMENTATION.label,
            order: '2'
        });
        menus.registerMenuAction(SkyesOverLondonMenus.HELP, {
            commandId: SkyesOverLondonCommands.OPEN_APP_CATALOG.id,
            label: SkyesOverLondonCommands.OPEN_APP_CATALOG.label,
            order: '3'
        });
    }
}
