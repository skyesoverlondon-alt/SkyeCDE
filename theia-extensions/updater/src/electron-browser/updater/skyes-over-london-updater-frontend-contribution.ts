/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import {
    Command,
    CommandContribution,
    CommandRegistry,
    Emitter,
    MenuContribution,
    MenuModelRegistry,
    MenuPath,
    MessageService,
    Progress
} from '@theia/core/lib/common';
import { PreferenceScope, PreferenceService } from '@theia/core/lib/common';
import { SkyesOverLondonUpdater, SkyesOverLondonUpdaterClient, UpdaterError, UpdateInfo, UpdateAvailabilityInfo, UpdaterSettings } from '../../common/updater/skyes-over-london-updater';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { CommonMenus, OpenerService } from '@theia/core/lib/browser';
import { ElectronMainMenuFactory } from '@theia/core/lib/electron-browser/menu/electron-main-menu-factory';
import URI from '@theia/core/lib/common/uri';
import { URI as VSCodeURI } from 'vscode-uri';

export namespace SkyesOverLondonUpdaterCommands {

    const category = 'Skyes Over London Updater';

    export const CHECK_FOR_UPDATES: Command = {
        id: 'electron-skyes-over-london:check-for-updates',
        label: 'Check for Updates...',
        category
    };

    export const RESTART_TO_UPDATE: Command = {
        id: 'electron-skyes-over-london:restart-to-update',
        label: 'Restart to Update',
        category
    };

}

export namespace SkyesOverLondonUpdaterMenu {
    export const MENU_PATH: MenuPath = [...CommonMenus.FILE_SETTINGS_SUBMENU, '3_settings_submenu_update'];
}

@injectable()
export class SkyesOverLondonUpdaterClientImpl implements SkyesOverLondonUpdaterClient {

    protected readonly onReadyToInstallEmitter = new Emitter<void>();
    readonly onReadyToInstall = this.onReadyToInstallEmitter.event;

    protected readonly onUpdateAvailableEmitter = new Emitter<UpdateAvailabilityInfo>();
    readonly onUpdateAvailable = this.onUpdateAvailableEmitter.event;

    protected readonly onErrorEmitter = new Emitter<UpdaterError>();
    readonly onError = this.onErrorEmitter.event;

    protected readonly onCancelEmitter = new Emitter<void>();
    readonly onCancel = this.onCancelEmitter.event;

    notifyReadyToInstall(): void {
        this.onReadyToInstallEmitter.fire();
    }

    updateAvailable(available: boolean, updateInfo?: UpdateInfo): void {
        this.onUpdateAvailableEmitter.fire({ available, updateInfo });
    }

    reportError(error: UpdaterError): void {
        this.onErrorEmitter.fire(error);
    }

    reportCancelled(): void {
        this.onCancelEmitter.fire();
    }

}

// Dynamic menus aren't yet supported by electron: https://github.com/eclipse-theia/theia/issues/446
@injectable()
export class ElectronMenuUpdater {

    @inject(ElectronMainMenuFactory)
    protected readonly factory: ElectronMainMenuFactory;

    public update(): void {
        this.setMenu();
    }

    private setMenu(): void {
        window.electronTheiaCore.setMenu(this.factory.createElectronMenuBar());
    }

}

@injectable()
export class SkyesOverLondonUpdaterFrontendContribution implements CommandContribution, MenuContribution {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(ElectronMenuUpdater)
    protected readonly menuUpdater: ElectronMenuUpdater;

    @inject(SkyesOverLondonUpdater)
    protected readonly updater: SkyesOverLondonUpdater;

    @inject(SkyesOverLondonUpdaterClientImpl)
    protected readonly updaterClient: SkyesOverLondonUpdaterClientImpl;

    @inject(PreferenceService)
    private readonly preferenceService: PreferenceService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    protected readyToUpdate = false;

    private progress: Progress | undefined;
    private intervalId: NodeJS.Timeout | undefined;
    private currentUpdateInfo: UpdateInfo | undefined;

    @postConstruct()
    protected init(): void {
        this.updaterClient.onUpdateAvailable(({ available, updateInfo }) => {
            if (available) {
                this.currentUpdateInfo = updateInfo;
                this.handleDownloadUpdate(updateInfo);
            } else {
                this.handleNoUpdate();
            }
        });

        this.updaterClient.onReadyToInstall(async () => {
            this.readyToUpdate = true;
            this.menuUpdater.update();
            this.handleUpdatesAvailable();
        });

        this.updaterClient.onError(error => this.handleError(error));
        this.updaterClient.onCancel(() => this.stopProgress());

        this.preferenceService.ready.then(() => {
            this.syncUpdaterSettings();
        });
        this.preferenceService.onPreferenceChanged(e => {
            if (e.preferenceName === 'updates.checkForUpdates' ||
                e.preferenceName === 'updates.checkInterval' ||
                e.preferenceName === 'updates.channel') {
                this.syncUpdaterSettings();
            }
        });
    }

    protected syncUpdaterSettings(): void {
        const settings: UpdaterSettings = {
            checkForUpdates: this.preferenceService.get<boolean>('updates.checkForUpdates', true),
            checkInterval: this.preferenceService.get<number>('updates.checkInterval', 60),
            channel: this.preferenceService.get<'stable' | 'preview' | 'next'>('updates.channel', 'stable')
        };
        this.updater.setUpdaterSettings(settings);
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SkyesOverLondonUpdaterCommands.CHECK_FOR_UPDATES, {
            execute: async () => {
                this.updater.checkForUpdates();
            },
            isEnabled: () => !this.readyToUpdate,
            isVisible: () => !this.readyToUpdate
        });
        registry.registerCommand(SkyesOverLondonUpdaterCommands.RESTART_TO_UPDATE, {
            execute: () => this.updater.onRestartToUpdateRequested(),
            isEnabled: () => this.readyToUpdate,
            isVisible: () => this.readyToUpdate
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(SkyesOverLondonUpdaterMenu.MENU_PATH, {
            commandId: SkyesOverLondonUpdaterCommands.CHECK_FOR_UPDATES.id
        });
        registry.registerMenuAction(SkyesOverLondonUpdaterMenu.MENU_PATH, {
            commandId: SkyesOverLondonUpdaterCommands.RESTART_TO_UPDATE.id
        });
    }

    protected async handleDownloadUpdate(updateInfo?: UpdateInfo): Promise<void> {
        const message = updateInfo
            ? `Skyes Over London ${updateInfo.version} is available. Download it now?`
            : 'A Skyes Over London update is available. Download it now?';
        const actions = ['Not now', 'Yes'];
        const checkForUpdates = this.preferenceService.get<boolean>('updates.checkForUpdates', true);
        if (checkForUpdates) {
            actions.push('Never');
        }
        const answer = await this.messageService.info(message, ...actions);
        if (answer === 'Never') {
            this.preferenceService.set('updates.checkForUpdates', false, PreferenceScope.User);
            return;
        }
        if (answer === 'Yes') {
            this.stopProgress();
            this.progress = await this.messageService.showProgress({
                text: 'Skyes Over London Update',
                options: { cancelable: true }
            }, () => this.updater.cancel());
            let dots = 0;
            this.intervalId = setInterval(() => {
                if (this.progress !== undefined) {
                    dots = (dots + 1) % 4;
                    this.progress.report({ message: 'Downloading' + '.'.repeat(dots) });
                }
            }, 1000);
            this.updater.downloadUpdate();
        }
    }

    protected async handleNoUpdate(): Promise<void> {
        this.messageService.info('Skyes Over London is already up to date');
    }

    protected async handleUpdatesAvailable(): Promise<void> {
        if (this.progress !== undefined) {
            this.progress.report({ work: { done: 1, total: 1 } });
            this.stopProgress();
        }
        const message = this.currentUpdateInfo
            ? `Skyes Over London ${this.currentUpdateInfo.version} has been downloaded and will install on exit. Restart now?`
            : 'A Skyes Over London update has been downloaded and will install on exit. Restart now?';
        const answer = await this.messageService.info(message, 'No', 'Yes');
        if (answer === 'Yes') {
            this.updater.onRestartToUpdateRequested();
        }
    }

    protected async handleError(error: UpdaterError): Promise<void> {
        this.stopProgress();
        if (error.errorLogPath) {
            const viewLogAction = 'View Error Log';
            const answer = await this.messageService.error(error.message, viewLogAction);
            if (answer === viewLogAction) {
                const uri = new URI(VSCodeURI.file(error.errorLogPath));
                const opener = await this.openerService.getOpener(uri);
                opener.open(uri);
            }
        } else {
            this.messageService.error(error.message);
        }
    }

    private stopProgress(): void {
        if (this.intervalId !== undefined) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (this.progress !== undefined) {
            this.progress.cancel();
            this.progress = undefined;
        }
    }
}
