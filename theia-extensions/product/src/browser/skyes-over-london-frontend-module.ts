/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { WidgetFactory, FrontendApplicationContribution, bindViewContribution } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { applyBranding } from './skyes-over-london-config';
import { CommandContribution } from '@theia/core/lib/common/command';
import { ContainerModule } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { SkyeAppCatalogContribution } from './skye-app-catalog-contribution';
import { SkyeAppCatalogWidget } from './skye-app-catalog-widget';
import { SkyeBackgroundSceneContribution } from './skye-background-scene-contribution';
import { SkyeAppRegistryService } from './skye-app-registry';
import { SkyeStudioLauncherContribution } from './skye-studio-launcher-contribution';
import { SkyeStudioLauncherWidget } from './skye-studio-launcher-widget';
import { SkyesOverLondonAboutDialog } from './skyes-over-london-about-dialog';
import { SkyesOverLondonContribution } from './skyes-over-london-contribution';
import { SkyesOverLondonGettingStartedWidget } from './skyes-over-london-getting-started-widget';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    applyBranding();

    bind(SkyesOverLondonGettingStartedWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: GettingStartedWidget.ID,
        createWidget: () => context.container.get<SkyesOverLondonGettingStartedWidget>(SkyesOverLondonGettingStartedWidget),
    })).inSingletonScope();
    bind(SkyeStudioLauncherWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: SkyeStudioLauncherWidget.ID,
        createWidget: () => context.container.get<SkyeStudioLauncherWidget>(SkyeStudioLauncherWidget),
    })).inSingletonScope();
    bind(SkyeAppRegistryService).toSelf().inSingletonScope();
    bind(SkyeAppCatalogWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: SkyeAppCatalogWidget.ID,
        createWidget: () => context.container.get<SkyeAppCatalogWidget>(SkyeAppCatalogWidget),
    })).inSingletonScope();
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(SkyesOverLondonAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(SkyesOverLondonAboutDialog).inSingletonScope();
    }

    bindViewContribution(bind, SkyeStudioLauncherContribution);
    bind(FrontendApplicationContribution).toService(SkyeStudioLauncherContribution);

    bind(SkyeAppCatalogContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SkyeAppCatalogContribution);

    bind(SkyeBackgroundSceneContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SkyeBackgroundSceneContribution);

    bind(SkyesOverLondonContribution).toSelf().inSingletonScope();
    [CommandContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(SkyesOverLondonContribution)
    );
});
