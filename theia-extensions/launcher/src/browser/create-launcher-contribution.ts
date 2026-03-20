/********************************************************************************
 * Copyright (C) 2022-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ConfirmDialog, Dialog, FrontendApplication, FrontendApplicationContribution, StorageService } from '@theia/core/lib/browser';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { ILogger, MaybePromise } from '@theia/core/lib/common';
import { nls } from '@theia/core/lib/common/nls';
import { inject, injectable } from '@theia/core/shared/inversify';
import { LauncherService } from './launcher-service';
import { DesktopFileService } from './desktopfile-service';

@injectable()
export class CreateLauncherCommandContribution implements FrontendApplicationContribution {

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(LauncherService) private readonly launcherService: LauncherService;

    @inject(DesktopFileService) private readonly desktopFileService: DesktopFileService;

    onStart(_app: FrontendApplication): MaybePromise<void> {
        const appConfig = FrontendApplicationConfigProvider.get();
        const applicationName = appConfig.applicationName;
        const uriScheme = appConfig.electron.uriScheme;

        this.launcherService.isInitialized(uriScheme).then(async initialized => {
            if (!initialized) {
                const messageContainer = document.createElement('div');
                // eslint-disable-next-line max-len
                messageContainer.textContent = nls.localizeByDefault(`Install a shell command for ${applicationName}?\nYou will be able to open the 0s command deck from the command line by typing '${uriScheme}'.`);
                messageContainer.setAttribute('style', 'white-space: pre-line');
                const details = document.createElement('p');
                details.textContent = nls.localizeByDefault('Administrator privileges are required for installation. You may be prompted for your password next. Gate bootstrap metadata for first-party launch targets will be written during install.');
                messageContainer.appendChild(details);
                const dialog = new ConfirmDialog({
                    title: nls.localizeByDefault('Install 0s launcher command'),
                    msg: messageContainer,
                    ok: Dialog.YES,
                    cancel: Dialog.NO
                });
                const install = await dialog.open();
                this.launcherService.createLauncher(!!install, {
                    uriScheme,
                    requiresGateBootstrap: true,
                    launchTargets: this.launcherService.buildFirstPartyLaunchTargets(uriScheme)
                });
                this.logger.info('Initialized application launcher.');
            } else {
                this.logger.info('Application launcher was already initialized.');
            }
        });

        this.desktopFileService.isInitialized().then(async initialized => {
            if (!initialized) {
                const messageContainer = document.createElement('div');
                // eslint-disable-next-line max-len
                messageContainer.textContent = nls.localizeByDefault(`Create an applications-menu entry for ${applicationName}?\nThis adds a .desktop file so the studio is easier to launch directly from your desktop environment.`);
                messageContainer.setAttribute('style', 'white-space: pre-line');
                const dialog = new ConfirmDialog({
                    title: nls.localizeByDefault('Install desktop entry'),
                    msg: messageContainer,
                    ok: Dialog.YES,
                    cancel: Dialog.NO
                });
                const install = await dialog.open();
                this.desktopFileService.createOrUpdateDesktopfile(!!install, {
                    applicationName,
                    createUrlHandler: true,
                    uriScheme
                });
                this.logger.info('Created or updated .desktop file.');
            } else {
                this.logger.info('Desktop file was not updated or created.');
            }
        });
    }
}
