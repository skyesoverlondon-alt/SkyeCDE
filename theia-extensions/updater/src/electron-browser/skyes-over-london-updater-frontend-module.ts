/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ElectronMenuUpdater, SkyesOverLondonUpdaterClientImpl, SkyesOverLondonUpdaterFrontendContribution } from './updater/skyes-over-london-updater-frontend-contribution';
import { SkyesOverLondonUpdater, SkyesOverLondonUpdaterClient, SkyesOverLondonUpdaterPath } from '../common/updater/skyes-over-london-updater';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronIpcConnectionProvider } from '@theia/core/lib/electron-browser/messaging/electron-ipc-connection-source';
import { PreferenceContribution } from '@theia/core/lib/common';
import { skyesOverLondonUpdaterPreferenceSchema } from './updater/skyes-over-london-updater-preferences';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(ElectronMenuUpdater).toSelf().inSingletonScope();
    bind(SkyesOverLondonUpdaterClientImpl).toSelf().inSingletonScope();
    bind(SkyesOverLondonUpdaterClient).toService(SkyesOverLondonUpdaterClientImpl);
    bind(SkyesOverLondonUpdater).toDynamicValue(context => {
        const client = context.container.get(SkyesOverLondonUpdaterClientImpl);
        return ElectronIpcConnectionProvider.createProxy(context.container, SkyesOverLondonUpdaterPath, client);
    }).inSingletonScope();
    bind(SkyesOverLondonUpdaterFrontendContribution).toSelf().inSingletonScope();
    bind(MenuContribution).toService(SkyesOverLondonUpdaterFrontendContribution);
    bind(CommandContribution).toService(SkyesOverLondonUpdaterFrontendContribution);

    bind(PreferenceContribution).toConstantValue({ schema: skyesOverLondonUpdaterPreferenceSchema });
});
