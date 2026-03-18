/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { SkyesOverLondonUpdater, SkyesOverLondonUpdaterClient, SkyesOverLondonUpdaterPath } from '../../common/updater/skyes-over-london-updater';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { SkyesOverLondonUpdaterImpl } from './skyes-over-london-updater-impl';

export default new ContainerModule(bind => {
    bind(SkyesOverLondonUpdaterImpl).toSelf().inSingletonScope();
    bind(SkyesOverLondonUpdater).toService(SkyesOverLondonUpdaterImpl);
    bind(ElectronMainApplicationContribution).toService(SkyesOverLondonUpdater);
    bind(ElectronConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<SkyesOverLondonUpdaterClient>(SkyesOverLondonUpdaterPath, client => {
            const server = context.container.get<SkyesOverLondonUpdater>(SkyesOverLondonUpdater);
            server.setClient(client);
            client.onDidCloseConnection(() => server.disconnectClient(client));
            return server;
        })
    ).inSingletonScope();
});
