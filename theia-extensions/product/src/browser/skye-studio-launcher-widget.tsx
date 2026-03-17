/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { CommandRegistry } from '@theia/core/lib/common/command';
import { codicon, CommonCommands, ReactWidget } from '@theia/core/lib/browser';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { FILE_NAVIGATOR_TOGGLE_COMMAND_ID } from '@theia/navigator/lib/browser/navigator-contribution';

interface StudioAction {
    label: string;
    description: string;
    icon: string;
    run: () => void | Promise<void>;
}

interface StudioLink {
    label: string;
    href: string;
}

const PRODUCT_SOURCE_URL = 'https://github.com/SkyeCDE/SkyeCDE';
const PRODUCT_DOCS_URL = `${PRODUCT_SOURCE_URL}#readme`;

@injectable()
export class SkyeStudioLauncherWidget extends ReactWidget {

    static readonly ID = 'skye-studio-launcher';
    static readonly LABEL = 'Studio';

    protected readonly productActions: StudioAction[] = [
        {
            label: 'Home',
            description: 'Return to the creative dashboard.',
            icon: codicon('home'),
            run: () => this.executeCommand(GettingStartedWidget.ID)
        },
        {
            label: 'Explorer',
            description: 'Open files, assets and workspace structure.',
            icon: codicon('files'),
            run: () => this.executeCommand(FILE_NAVIGATOR_TOGGLE_COMMAND_ID)
        },
        {
            label: 'Extensions',
            description: 'Manage OpenVSX integrations and add-ons.',
            icon: codicon('extensions'),
            run: () => this.executeCommand('vsxExtensions.toggle')
        },
        {
            label: 'AI Chat',
            description: 'Launch the built-in AI workspace panel.',
            icon: codicon('sparkle'),
            run: () => this.executeCommand('aiChat:toggle')
        }
    ];

    protected readonly workflowActions: StudioAction[] = [
        {
            label: 'New File',
            description: 'Start a fresh document, script or prompt.',
            icon: codicon('new-file'),
            run: () => this.executeCommand(CommonCommands.NEW_UNTITLED_TEXT_FILE.id)
        },
        {
            label: 'Command Palette',
            description: 'Trigger any command from one search surface.',
            icon: codicon('terminal-cmd'),
            run: () => this.executeCommand('workbench.action.showCommands')
        },
        {
            label: 'Settings',
            description: 'Tune the product shell and editor behavior.',
            icon: codicon('settings-gear'),
            run: () => this.executeCommand(CommonCommands.OPEN_PREFERENCES.id)
        },
        {
            label: 'About',
            description: 'Open product details and installed extensions.',
            icon: codicon('info'),
            run: () => this.executeCommand(CommonCommands.ABOUT_COMMAND.id)
        }
    ];

    protected readonly referenceLinks: StudioLink[] = [
        {
            label: 'Platform Docs',
            href: PRODUCT_DOCS_URL
        },
        {
            label: 'OpenVSX Marketplace',
            href: 'https://open-vsx.org/'
        },
        {
            label: 'Platform Source',
            href: PRODUCT_SOURCE_URL
        }
    ];

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @postConstruct()
    protected init(): void {
        this.id = SkyeStudioLauncherWidget.ID;
        this.title.label = SkyeStudioLauncherWidget.LABEL;
        this.title.caption = 'Skyes Over London Launcher';
        this.title.closable = false;
        this.title.iconClass = codicon('rocket');
        this.addClass('skye-studio-launcher-widget');
        this.update();
    }

    protected async executeCommand(commandId: string, ...args: unknown[]): Promise<void> {
        await this.commands.executeCommand(commandId, ...args);
    }

    protected async openExternal(href: string): Promise<void> {
        await this.windowService.openNewWindow(href, { external: true });
    }

    protected renderActionGroup(title: string, intro: string, actions: StudioAction[]): React.ReactNode {
        return <section className='skye-launcher-section'>
            <div className='skye-launcher-section-header'>
                <h3>{title}</h3>
                <p>{intro}</p>
            </div>
            <div className='skye-launcher-action-list'>
                {actions.map(action => <button
                    key={action.label}
                    className='skye-launcher-action'
                    onClick={() => void action.run()}
                >
                    <span className={`skye-launcher-action-icon ${action.icon}`}></span>
                    <span className='skye-launcher-action-copy'>
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                    </span>
                </button>)}
            </div>
        </section>;
    }

    protected renderReferenceLinks(): React.ReactNode {
        return <section className='skye-launcher-section'>
            <div className='skye-launcher-section-header'>
                <h3>References</h3>
                <p>Keep upstream docs and extension sources close while you customize the shell.</p>
            </div>
            <div className='skye-launcher-link-list'>
                {this.referenceLinks.map(link => <button
                    key={link.label}
                    className='skye-launcher-link'
                    onClick={() => void this.openExternal(link.href)}
                >
                    <span>{link.label}</span>
                    <i className={codicon('arrow-up-right')}></i>
                </button>)}
            </div>
        </section>;
    }

    override render(): React.ReactNode {
        return <div className='skye-launcher-shell'>
            <header className='skye-launcher-hero'>
                <span className='skye-badge'>Royal neon access</span>
                <h2>Launch the command deck fast.</h2>
                <p>Pin the core views you use most and keep creative workflow controls one click away in the left rail.</p>
            </header>
            {this.renderActionGroup('Core Surfaces', 'Jump between the main studio spaces.', this.productActions)}
            {this.renderActionGroup('Workflow Tools', 'Create, configure and operate from the same place.', this.workflowActions)}
            {this.renderReferenceLinks()}
        </div>;
    }
}