/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';

import { Message } from '@theia/core/lib/browser';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { PreferenceService } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import { LocationMapperService } from '@theia/mini-browser/lib/browser/location-mapper-service';
import {
    renderCollaboration,
    renderDocumentation,
    renderDownloads,
    renderExtendingCustomizing,
    renderRegistryCatalog,
    renderRegistryHighlights,
    renderSourceCode,
    renderRegistryStatus,
    renderStudioBrandStrip,
    renderStudioHero,
    renderSupport,
    renderTickets,
    renderWhatIs
} from './branding-util';
import { SkyeAppRegistryService, SkyePlatformRegistry } from './skye-app-registry';

import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';

@injectable()
export class SkyesOverLondonGettingStartedWidget extends GettingStartedWidget {

    @inject(VSXEnvironment)
    protected readonly environment: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(LocationMapperService)
    protected readonly locationMapperService: LocationMapperService;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(SkyeAppRegistryService)
    protected readonly registryService: SkyeAppRegistryService;

    protected vscodeApiVersion: string;
    protected registry: SkyePlatformRegistry | undefined;

    protected async doInit(): Promise<void> {
        super.doInit();
        this.vscodeApiVersion = await this.environment.getVscodeApiVersion();
        await this.preferenceService.ready;
        this.registry = await this.registryService.getRegistry().catch(() => undefined);
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const htmlElement = document.getElementById('alwaysShowWelcomePage');
        if (htmlElement) {
            htmlElement.focus();
        }
    }

    protected render(): React.ReactNode {
        return <div className='gs-container'>
            <div className='gs-content-container'>
                <div className='skye-dashboard-layout'>
                    <div className='skye-dashboard-main'>
                        {renderStudioHero()}
                    </div>
                    <div className='skye-dashboard-rail'>
                        {this.renderActions()}
                    </div>
                </div>
                {renderStudioBrandStrip()}
                {this.renderHeader()}
                <hr className='gs-hr' />
                <div className='flex-grid'>
                    <div className='col'>
                        {renderRegistryHighlights(this.openerService, this.locationMapperService, this.windowService, this.registry)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderRegistryCatalog(this.openerService, this.locationMapperService, this.windowService, this.registry)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderWhatIs(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderRegistryStatus(this.registry)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderExtendingCustomizing(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderSupport(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderTickets(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderSourceCode(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderDocumentation(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {this.renderAIBanner()}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderCollaboration(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderDownloads()}
                    </div>
                </div>
            </div>
            <div className='gs-preference-container'>
                {this.renderPreferences()}
            </div>
        </div>;
    }

    protected renderActions(): React.ReactNode {
        return <div className='gs-container'>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderStart()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderSettings()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderRecentWorkspaces()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderHelp()}
                </div>
            </div>
        </div>;
    }

    protected renderHeader(): React.ReactNode {
        return <div className='gs-header'>
            {this.renderVersion()}
        </div>;
    }

    protected renderVersion(): React.ReactNode {
        return <div>
            <p className='gs-sub-header' >
                {this.applicationInfo ? 'Version ' + this.applicationInfo.version : '-'}
            </p>

            <p className='gs-sub-header' >
                {'VS Code API Version: ' + this.vscodeApiVersion}
            </p>
        </div>;
    }

    protected renderAIBanner(): React.ReactNode {
        const framework = super.renderAIBanner();
        if (React.isValidElement<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>>(framework)) {
            return React.cloneElement(framework, { className: 'gs-section' });
        }
        return framework;
    }
}
