/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { WindowService } from '@theia/core/lib/browser/window/window-service';
import * as React from 'react';
import { getBrandingVariant } from './theia-ide-config';

const PRODUCT_SOURCE_URL = 'https://github.com/SkyeCDE/SkyeCDE';
const PRODUCT_DOCS_URL = `${PRODUCT_SOURCE_URL}#readme`;
const PRODUCT_ISSUES_URL = `${PRODUCT_SOURCE_URL}/issues`;

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService: WindowService;
}

export function renderProductName(): React.ReactNode {
    const variant = getBrandingVariant();
    const suffix = variant !== 'stable' ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return <h1>Skyes <span className="gs-blue-header">Over London</span>{suffix}</h1>;
}

function BrowserLink(props: ExternalBrowserLinkProps): JSX.Element {
    return <a
        role={'button'}
        tabIndex={0}
        href={props.url}
        target='_blank'
    >
        {props.text}
    </a>;
}

export function renderWhatIs(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            What is this workspace?
        </h3>
        <div>
            Skyes Over London is a royal neon creative workspace for cloud and desktop. The shell is based on an open <BrowserLink text="platform foundation"
                url={PRODUCT_SOURCE_URL} windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            Use it as a floating command deck for design systems, media operations, automation and AI-assisted production.
        </div>
    </div>;
}

export function renderExtendingCustomizing(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Extend the studio shell
        </h3>
        <div >
            You can extend the shell at runtime by installing VS Code extensions from the <BrowserLink text="OpenVSX registry" url="https://open-vsx.org/"
                windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            The platform core can still serve as a <span className='gs-text-bold'>template</span> for building custom tools and internal creative systems. Browse <BrowserLink text="the platform docs" url={PRODUCT_DOCS_URL}
                windowService={windowService} ></BrowserLink> when you want to customize it deeper.
        </div>
    </div>;
}

export function renderSupport(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Operator notes
        </h3>
        <div>
            Platform-level guidance is still available through the <BrowserLink text="platform support page" url={PRODUCT_ISSUES_URL}
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderTickets(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Feedback loop
        </h3>
        <div >
            Platform-level bugs can still be traced upstream to
            the <BrowserLink text="the platform project on Github" url={PRODUCT_ISSUES_URL}
                windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            Keep product-specific feedback in your repo workflow and use your own backlog for UI, packaging and experience changes.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Product base
        </h3>
        <div >
            The source base remains available
            on <BrowserLink text="Github" url={PRODUCT_SOURCE_URL}
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderDocumentation(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Platform documentation
        </h3>
        <div >
            Use the <BrowserLink text="platform docs" url={PRODUCT_DOCS_URL}
                windowService={windowService} ></BrowserLink> for the underlying platform.
        </div>
    </div>;
}

export function renderCollaboration(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Collaboration
        </h3>
        <div >
            The shell still supports built-in collaboration.
            You can share your workspace with others and work together in real time.
            The collaboration feature is powered by
            the <BrowserLink text="Open Collaboration Tools" url="https://www.open-collab.tools/" windowService={windowService} /> project
            and uses their public server infrastructure.
        </div>
    </div>;
}

export function renderDownloads(): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Updates and Downloads
        </h3>
        <div className='gs-action-container'>
            You can update Skyes Over London directly in this application by navigating to
            File {'>'} Preferences {'>'} Check for Updates… Moreover the application will check for updates
            after each launch automatically.
        </div>
        <div className='gs-action-container'>
            Alternatively you can download the most recent version from your distribution channel.
        </div>
    </div>;
}
