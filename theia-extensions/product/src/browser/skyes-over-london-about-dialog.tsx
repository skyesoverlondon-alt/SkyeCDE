/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';
import { AboutDialog, AboutDialogProps, ABOUT_CONTENT_CLASS } from '@theia/core/lib/browser/about-dialog';
import { injectable, inject } from '@theia/core/shared/inversify';
import {
    renderDocumentation,
    renderDownloads,
    renderProductName,
    renderProductTagline,
    renderRegistryCatalog,
    renderRegistryHighlights,
    renderRegistryStatus,
    renderSourceCode,
    renderStudioBrandStrip,
    renderSupport,
    renderTickets,
    renderWhatIs
} from './branding-util';
import { SkyeAppRegistryService, SkyePlatformRegistry } from './skye-app-registry';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
@injectable()
export class SkyesOverLondonAboutDialog extends AboutDialog {

    @inject(VSXEnvironment)
    protected readonly environment: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(SkyeAppRegistryService)
    protected readonly registryService: SkyeAppRegistryService;

    protected vscodeApiVersion: string;
    protected registry: SkyePlatformRegistry | undefined;

    constructor(
        @inject(AboutDialogProps) protected readonly props: AboutDialogProps
    ) {
        super(props);
    }

    protected async doInit(): Promise<void> {
        this.vscodeApiVersion = await this.environment.getVscodeApiVersion();
        this.registry = await this.registryService.getRegistry().catch(() => undefined);
        super.doInit();
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderContent()}
        </div>;
    }

    protected renderContent(): React.ReactNode {
        return <div className='ad-container'>
            <div className='skye-dashboard-layout'>
                <div className='skye-dashboard-main'>
                    <section className='skye-hero-panel'>
                        <div className='skye-hero-copy'>
                            <span className='skye-badge'>About this product</span>
                            {renderProductName()}
                            {renderProductTagline()}
                            {this.renderVersion()}
                        </div>
                        <div className='skye-hero-visual' aria-hidden='true'>
                            <div className='skye-hero-orb skye-hero-orb-primary'></div>
                            <div className='skye-hero-orb skye-hero-orb-secondary'></div>
                            <div className='ad-logo skye-hero-logo'></div>
                        </div>
                    </section>
                </div>
                <div className='skye-dashboard-rail'>
                    {renderRegistryStatus(this.registry)}
                    <div className='gs-section'>
                        <h3 className='gs-section-header'>Installed extensions</h3>
                        {this.renderExtensions()}
                    </div>
                </div>
            </div>
            {renderStudioBrandStrip()}
            <hr className='gs-hr' />
            <div className='flex-grid'>
                <div className='col'>
                    {renderRegistryHighlights(this.windowService, this.registry)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderRegistryCatalog(this.windowService, this.registry)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderWhatIs(this.windowService)}
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
                    {renderDownloads()}
                </div>
            </div>
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
}
