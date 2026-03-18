/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

export const SkyesOverLondonUpdaterPath = '/services/skyes-over-london-updater';
export const SkyesOverLondonUpdater = Symbol('SkyesOverLondonUpdater');
export interface UpdaterSettings {
    checkForUpdates: boolean;
    checkInterval: number;
    channel: 'stable' | 'preview' | 'next';
}

export interface SkyesOverLondonUpdater extends RpcServer<SkyesOverLondonUpdaterClient> {
    checkForUpdates(): void;
    downloadUpdate(): void;
    onRestartToUpdateRequested(): void;
    disconnectClient(client: SkyesOverLondonUpdaterClient): void;
    cancel(): void;
    setUpdaterSettings(settings: UpdaterSettings): void;
}

export const SkyesOverLondonUpdaterClient = Symbol('SkyesOverLondonUpdaterClient');

export interface UpdaterError {
    message: string;
    errorLogPath?: string;
}

export interface UpdateInfo {
    version: string;
}

export interface UpdateAvailabilityInfo {
    available: boolean;
    updateInfo?: UpdateInfo;
}

export interface SkyesOverLondonUpdaterClient {
    updateAvailable(available: boolean, updateInfo?: UpdateInfo): void;
    notifyReadyToInstall(): void;
    reportError(error: UpdaterError): void;
    reportCancelled(): void;
}
