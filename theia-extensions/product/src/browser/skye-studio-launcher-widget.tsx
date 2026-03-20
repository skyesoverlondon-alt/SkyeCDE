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
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { LocationMapperService } from '@theia/mini-browser/lib/browser/location-mapper-service';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { FILE_NAVIGATOR_TOGGLE_COMMAND_ID } from '@theia/navigator/lib/browser/navigator-contribution';
import { openSkyePlatformApp } from './skye-app-opener';
import { SkyeAppRegistryService, SkyePlatformApp, SkyePlatformRegistry } from './skye-app-registry';
import { SkyesOverLondonCommands } from './skyes-over-london-contribution';

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

    protected readonly shellActions: StudioAction[] = [
        {
            label: '0s App Catalog',
            description: 'Open Extensions on the built-in 0s registry surface.',
            icon: codicon('extensions'),
            run: () => this.executeCommand(SkyesOverLondonCommands.OPEN_APP_CATALOG.id)
        },
        {
            label: 'Home',
            description: 'Return to the 0s welcome and overview surfaces.',
            icon: codicon('home'),
            run: () => this.executeCommand(GettingStartedWidget.ID)
        },
        {
            label: 'Launch SkyDex Autonomous',
            description: 'Open SkyDex as a CDE-native autonomous execution lane.',
            icon: codicon('rocket'),
            run: () => this.launchSkydexAutonomous()
        },
        {
            label: 'New File',
            description: 'Start a fresh document, script or prompt.',
            icon: codicon('new-file'),
            run: () => this.executeCommand(CommonCommands.NEW_UNTITLED_TEXT_FILE.id)
        },
        {
            label: 'Explorer',
            description: 'Open files, assets and workspace structure.',
            icon: codicon('files'),
            run: () => this.executeCommand(FILE_NAVIGATOR_TOGGLE_COMMAND_ID)
        },
        {
            label: 'Command Palette',
            description: 'Trigger any command from one search surface.',
            icon: codicon('terminal-cmd'),
            run: () => this.executeCommand('workbench.action.showCommands')
        },
        {
            label: 'AI Chat',
            description: 'Launch the built-in AI workspace panel.',
            icon: codicon('sparkle'),
            run: () => this.executeCommand('aiChat:toggle')
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
            label: 'Platform Source',
            href: PRODUCT_SOURCE_URL
        },
        {
            label: 'Launcher Directive',
            href: `${PRODUCT_SOURCE_URL}/blob/main/SkyeDevNotes/PAtches%20and%20upgrades/implementation-directives/0slauncherimprovements`
        }
    ];

    protected registry: SkyePlatformRegistry | undefined;
    protected loadError: string | undefined;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(LocationMapperService)
    protected readonly locationMapperService: LocationMapperService;

    @inject(SkyeAppRegistryService)
    protected readonly registryService: SkyeAppRegistryService;

    @postConstruct()
    protected init(): void {
        this.id = SkyeStudioLauncherWidget.ID;
        this.title.label = SkyeStudioLauncherWidget.LABEL;
        this.title.caption = 'Skyes Over London Launcher';
        this.title.closable = false;
        this.title.iconClass = codicon('rocket');
        this.addClass('skye-studio-launcher-widget');
        void this.loadRegistry();
        this.update();
    }

    protected async loadRegistry(): Promise<void> {
        try {
            this.registry = await this.registryService.getRegistry();
            this.loadError = undefined;
        } catch (error) {
            this.loadError = error instanceof Error ? error.message : 'Unable to load the 0s app registry.';
        }
        this.update();
    }

    protected async executeCommand(commandId: string, ...args: unknown[]): Promise<void> {
        await this.commands.executeCommand(commandId, ...args);
    }

    protected async openExternal(href: string): Promise<void> {
        await this.windowService.openNewWindow(href, { external: true });
    }

    protected async launchApp(app: SkyePlatformApp): Promise<void> {
        await openSkyePlatformApp(this.openerService, this.locationMapperService, this.windowService, app);
    }

    protected async launchSkydexAutonomous(): Promise<void> {
        const apps = this.registry?.apps ?? [];
        const skydex = apps.find(app =>
            app.launchable
            && !!app.href
            && app.groupId === 'skydex'
            && /\.html?(?:$|[?#])/i.test(app.href)
        ) ?? apps.find(app =>
            app.launchable
            && !!app.href
            && /skydex/i.test(`${app.id} ${app.label} ${app.groupId}`)
            && /\.html?(?:$|[?#])/i.test(app.href)
        );

        if (!skydex?.href) {
            await this.executeCommand(SkyesOverLondonCommands.OPEN_APP_CATALOG.id);
            return;
        }

        if (/^file:\/\//i.test(skydex.href)) {
            const launchUrl = await this.locationMapperService.map(skydex.href);
            const url = new URL(launchUrl, window.location.origin);
            url.searchParams.set('mode', 'execute');
            url.searchParams.set('autonomy', 'autonomous');
            url.searchParams.set('cde', '1');
            await this.windowService.openNewWindow(url.toString(), { external: false });
            return;
        }

        const url = new URL(skydex.href, window.location.origin);
        url.searchParams.set('mode', 'execute');
        url.searchParams.set('autonomy', 'autonomous');
        url.searchParams.set('cde', '1');
        await this.windowService.openNewWindow(url.toString(), { external: skydex.external });
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
                <p>Keep the launcher source of truth, runtime docs and product repo close while you reshape the shell around the 0s.</p>
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

    protected renderFeaturedApps(): React.ReactNode {
        const featuredApps = (this.registry?.apps ?? [])
            .filter(app => app.featured && app.launchable)
            .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
            .slice(0, 6);
        if (!featuredApps.length) {
            return <section className='skye-launcher-section'>
                <div className='skye-launcher-section-header'>
                    <h3>Featured 0s apps</h3>
                    <p>{this.loadError ?? 'Loading the platform catalog from the built-in registry.'}</p>
                </div>
            </section>;
        }

        return <section className='skye-launcher-section'>
            <div className='skye-launcher-section-header'>
                <h3>Featured 0s apps</h3>
                <p>These launch paths come from the platform registry, not from marketplace add-ons.</p>
            </div>
            <div className='skye-launcher-card-grid'>
                {featuredApps.map(app => <button
                    key={app.id}
                    className='skye-launcher-card'
                    onClick={() => void this.launchApp(app)}
                >
                    <span className='skye-launcher-card-badge'>{badgeText(app.label)}</span>
                    <span className='skye-launcher-card-copy'>
                        <strong>{app.label}</strong>
                        <small>{app.summary}</small>
                    </span>
                    <span className='skye-launcher-card-cta'>Launch</span>
                </button>)}
            </div>
        </section>;
    }

    protected renderRegistrySummary(): React.ReactNode {
        const groups = this.registry?.groups ?? [];
        const apps = this.registry?.apps ?? [];
        const launchable = apps.filter(app => app.launchable).length;
        return <section className='skye-launcher-section'>
            <div className='skye-launcher-section-header'>
                <h3>Registry status</h3>
                <p>The launcher and the Extensions catalog now read from the same first-party registry surface.</p>
            </div>
            <div className='skye-launcher-metric-strip'>
                <div className='skye-launcher-metric'>
                    <strong>{apps.length}</strong>
                    <span>catalog entries</span>
                </div>
                <div className='skye-launcher-metric'>
                    <strong>{launchable}</strong>
                    <span>launchable entries</span>
                </div>
                <div className='skye-launcher-metric'>
                    <strong>{groups.length}</strong>
                    <span>registry groups</span>
                </div>
                <div className='skye-launcher-metric'>
                    <strong>{(this.registry?.source ?? 'pending').replace('-', ' ')}</strong>
                    <span>active source</span>
                </div>
            </div>
        </section>;
    }

    override render(): React.ReactNode {
        return <div className='skye-launcher-shell'>
            <header className='skye-launcher-hero'>
                <span className='skye-badge'>0s command deck</span>
                <h2>Launch the platform first. Treat Theia as the shell layer.</h2>
                <p>The launcher now prioritizes first-party app surfaces and routes users into the built-in catalog instead of framing marketplace extensions as the product.</p>
            </header>
            {this.renderFeaturedApps()}
            {this.renderRegistrySummary()}
            {this.renderActionGroup('Shell Utilities', 'Keep file navigation, commands and settings available without taking over the launcher story.', this.shellActions)}
            {this.renderReferenceLinks()}
        </div>;
    }
}

function badgeText(label: string): string {
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
}