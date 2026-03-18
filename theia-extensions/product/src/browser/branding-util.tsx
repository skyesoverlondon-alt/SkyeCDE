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
import { getBrandingVariant } from './skyes-over-london-config';
import { SkyePlatformApp, SkyePlatformRegistry } from './skye-app-registry';

const PRODUCT_SOURCE_URL = 'https://github.com/SkyeCDE/SkyeCDE';
const PRODUCT_DOCS_URL = `${PRODUCT_SOURCE_URL}#readme`;
const PRODUCT_ISSUES_URL = `${PRODUCT_SOURCE_URL}/issues`;

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService: WindowService;
}

interface StudioCard {
    title: string;
    description: string;
    eyebrow: string;
    href: string;
}

const CORE_PLATFORM_LABELS = [
    'SuperIDE',
    'Neural Space Pro',
    'kAIxU Platform',
    'GBP Rescue Suite',
    'Contractor Workflow Suite',
    'SkyeCloud',
    'SkyeDocxPro',
    'SkyeVault Pro',
    'SkyeAdmin'
];

const studioCards: StudioCard[] = [
    {
        eyebrow: 'Visuals',
        title: 'Design Surface',
        description: 'Shape UI systems, design tokens, illustrations, layout concepts and brand assets from one workspace shell.',
        href: PRODUCT_DOCS_URL
    },
    {
        eyebrow: 'Motion',
        title: 'Video + Motion',
        description: 'Organize motion pipelines, assets, scripts and build flows for editing, rendering and review work.',
        href: PRODUCT_DOCS_URL
    },
    {
        eyebrow: 'Audio',
        title: 'Sound Lab',
        description: 'Keep audio automation, transcription helpers, processing tools and delivery scripts close to production files.',
        href: PRODUCT_DOCS_URL
    },
    {
        eyebrow: 'AI',
        title: 'Prompt + Agent Ops',
        description: 'Drive generative tooling, prompts, copilots and content systems directly from your creative workspace.',
        href: PRODUCT_DOCS_URL
    }
];

const workflowCards: StudioCard[] = [
    {
        eyebrow: 'Capture',
        title: 'Ingest + Organize',
        description: 'Use the explorer, search, tags and workspace structure as a control center for raw assets and working files.',
        href: PRODUCT_DOCS_URL
    },
    {
        eyebrow: 'Create',
        title: 'Compose + Iterate',
        description: 'Blend code, prompts, automation and content editing in the same environment without switching contexts.',
        href: PRODUCT_DOCS_URL
    },
    {
        eyebrow: 'Ship',
        title: 'Publish + Review',
        description: 'Prepare builds, packages, previews and collaboration flows for clients, teammates and deployment targets.',
        href: PRODUCT_DOCS_URL
    }
];

export function renderProductName(): React.ReactNode {
    const variant = getBrandingVariant();
    const suffix = variant !== 'stable' ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return <h1>Skyes <span className="gs-blue-header">Over London</span>{suffix}</h1>;
}

export function renderProductTagline(): React.ReactNode {
    return <p className='skye-hero-tagline'>
        A 0s-first command deck where the platform catalog is primary and the Theia shell stays in the support layer.
    </p>;
}

export function renderStudioBrandStrip(): React.ReactNode {
    const variant = getBrandingVariant();
    const suffix = variant !== 'stable' ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return <section className='skye-brand-strip'>
        <div className='theia-icon skye-brand-strip-mark' aria-hidden='true'></div>
        <div className='skye-brand-strip-copy'>
            <span className='skye-card-eyebrow'>0s shell truth</span>
            <strong>Skyes Over London{suffix}</strong>
            <p>The 0s platform is the product surface. Theia is the shell upgrade that hosts the launcher, editors, and extension plumbing.</p>
        </div>
    </section>;
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
            Skyes Over London is a 0s command environment that surfaces your platform apps, launch lanes, and control menus inside a customizable shell. The underlying
            editor and extension plumbing are powered by an open <BrowserLink text="platform foundation"
                url={PRODUCT_SOURCE_URL} windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            Use it as the front door into SuperIDE, kAIxU, contractor systems, admin surfaces, doc production, vault-backed flows, and the rest of the catalog. The shell should tell
            that 0s-first story consistently across the launcher, Getting Started, About, and Extensions.
        </div>
    </div>;
}

export function renderExtendingCustomizing(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Extend the shell
        </h3>
        <div >
            Keep first-party 0s apps in the platform registry and expose them through the launcher and Extensions surfaces. Marketplace add-ons from the <BrowserLink text="OpenVSX registry" url="https://open-vsx.org/"
                windowService={windowService} ></BrowserLink> stay secondary to the built-in catalog.
        </div>
        <div>
            Because the shell sits on a composable platform core, it can serve as the host layer for your own app registry, control menus, and platform families.
            Browse <BrowserLink text="the platform docs" url={PRODUCT_DOCS_URL}
                windowService={windowService} ></BrowserLink> when you want to push the product deeper.
        </div>
    </div>;
}

export function renderSupport(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Operator notes
        </h3>
        <div>
            Treat this workspace as a command deck: shape the UI, replace product copy, add launch surfaces and connect your creative tooling without leaving the repo.
            If you need platform-level guidance, the <BrowserLink text="platform support ecosystem" url={PRODUCT_ISSUES_URL}
                windowService={windowService} ></BrowserLink> is still relevant underneath your custom brand.
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
            the <BrowserLink text="platform project on GitHub" url={PRODUCT_ISSUES_URL}
                windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            For product-specific issues in this customized shell, keep a project-local backlog and use your repo workflow as the source of truth for UI, packaging and experience changes.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Product base
        </h3>
        <div >
            This shell is built on top of a composable upstream platform and can keep borrowing from
            <BrowserLink text="the upstream source" url={PRODUCT_SOURCE_URL}
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
            Use the <BrowserLink text="platform documentation" url={PRODUCT_DOCS_URL}
                windowService={windowService} ></BrowserLink> for the underlying platform, then layer your own studio conventions on top.
        </div>
    </div>;
}

export function renderCollaboration(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Collaboration
        </h3>
        <div >
            Share workspaces, review changes and coordinate creative operations from the same shell. Built-in collaboration can support live handoffs and review sessions.
            The collaboration layer is powered by
            the <BrowserLink text="Open Collaboration Tools" url="https://www.open-collab.tools/" windowService={windowService} /> project
            and uses their public server infrastructure.
        </div>
    </div>;
}

export function renderDownloads(): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Updates + packaging
        </h3>
        <div className='gs-action-container'>
            Keep using the built-in update and packaging flow while you reshape the product around your own creative workflow.
        </div>
        <div className='gs-action-container'>
            Once the shell is branded and stable, this section can become your release notes or app distribution entry point.
        </div>
    </div>;
}

function renderCardGrid(cards: StudioCard[], windowService: WindowService): React.ReactNode {
    return <div className='skye-card-grid'>
        {cards.map(card => <a
            key={card.title}
            className='skye-card'
            href={card.href}
            target='_blank'
            rel='noreferrer'
        >
            <span className='skye-card-eyebrow'>{card.eyebrow}</span>
            <h4>{card.title}</h4>
            <p>{card.description}</p>
            <span className='skye-card-cta'>Open reference ↗</span>
        </a>)}
    </div>;
}

function renderRegistryTileGrid(apps: SkyePlatformApp[]): React.ReactNode {
    return <div className='skye-launcher-card-grid'>
        {apps.map(app => <a
            key={`${app.id}:${app.href}`}
            className='skye-launcher-card'
            href={app.href}
            target={app.external ? '_blank' : undefined}
            rel={app.external ? 'noreferrer' : undefined}
        >
            <span className='skye-launcher-card-badge'>{badgeText(app.label)}</span>
            <span className='skye-launcher-card-copy'>
                <strong>{app.label}</strong>
                <small>{app.summary}</small>
            </span>
            <span className='skye-launcher-card-cta'>{app.external ? 'External' : 'Launch'}</span>
        </a>)}
    </div>;
}

function findCorePlatforms(registry?: SkyePlatformRegistry): SkyePlatformApp[] {
    if (!registry) {
        return [];
    }
    const selected = CORE_PLATFORM_LABELS
        .map(label => registry.apps.find(app => app.label === label))
        .filter((app): app is SkyePlatformApp => !!app);

    return Array.from(new Map(selected.map(app => [`${app.id}:${app.href}`, app])).values());
}

export function renderRegistryHighlights(_windowService: WindowService, registry?: SkyePlatformRegistry): React.ReactNode {
    if (!registry) {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>0s launch deck</h3>
            <div className='skye-section-intro'>Loading the built-in registry so Getting Started and About can speak from the same app catalog.</div>
        </div>;
    }

    const coreApps = findCorePlatforms(registry);
    return <div className='gs-section'>
        <h3 className='gs-section-header'>0s launch deck</h3>
        <div className='skye-section-intro'>Core platforms and major launch surfaces that should define the shell story before marketplace extensions do.</div>
        {renderRegistryTileGrid(coreApps)}
    </div>;
}

export function renderRegistryStatus(registry?: SkyePlatformRegistry): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>Built-in 0s registry</h3>
        <div className='skye-launcher-metric-strip'>
            <div className='skye-launcher-metric'>
                <strong>{registry?.apps.length ?? 0}</strong>
                <span>catalog entries</span>
            </div>
            <div className='skye-launcher-metric'>
                <strong>{registry?.groups.length ?? 0}</strong>
                <span>registry groups</span>
            </div>
            <div className='skye-launcher-metric'>
                <strong>{registry?.source ?? 'pending'}</strong>
                <span>active source</span>
            </div>
        </div>
    </div>;
}

export function renderRegistryCatalog(_windowService: WindowService, registry?: SkyePlatformRegistry): React.ReactNode {
    if (!registry) {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>Full app catalog</h3>
            <div className='skye-section-intro'>Waiting for the aggregated registry payload.</div>
        </div>;
    }

    return <div className='gs-section'>
        <h3 className='gs-section-header'>Full app catalog</h3>
        <div className='skye-section-intro'>The shell now reads from the aggregated registry instead of only showing generic studio placeholders.</div>
        <div className='skye-registry-group-list'>
            {registry.groups.map(group => {
                const apps = registry.apps.filter(app => app.groupId === group.id);
                if (!apps.length) {
                    return undefined;
                }
                return <section key={group.id} className='skye-registry-group'>
                    <div className='skye-registry-group-header'>
                        <div>
                            <h4>{group.label}</h4>
                            {group.description && <p>{group.description}</p>}
                        </div>
                        <span className='skye-catalog-group-count'>{apps.length} entries</span>
                    </div>
                    <div className='skye-registry-chip-list'>
                        {apps.map(app => <a
                            key={`${app.id}:${app.href}`}
                            className='skye-registry-chip'
                            href={app.href}
                            target={app.external ? '_blank' : undefined}
                            rel={app.external ? 'noreferrer' : undefined}
                        >
                            <strong>{app.label}</strong>
                            <small>{app.external ? 'External property' : 'Built-in launch surface'}</small>
                        </a>)}
                    </div>
                </section>;
            })}
        </div>
    </div>;
}

export function renderStudioHero(): React.ReactNode {
    return <section className='skye-hero-panel'>
        <div className='skye-hero-copy'>
            <span className='skye-badge'>Royal neon studio shell</span>
            {renderProductName()}
            {renderProductTagline()}
            <div className='skye-hero-metrics'>
                <div className='skye-metric'>
                    <strong>Design</strong>
                    <span>UI systems, branding, layouts</span>
                </div>
                <div className='skye-metric'>
                    <strong>Media</strong>
                    <span>Assets, motion, audio pipelines</span>
                </div>
                <div className='skye-metric'>
                    <strong>AI Ops</strong>
                    <span>Prompts, agents, automation</span>
                </div>
            </div>
        </div>
        <div className='skye-hero-visual' aria-hidden='true'>
            <div className='skye-hero-orb skye-hero-orb-primary'></div>
            <div className='skye-hero-orb skye-hero-orb-secondary'></div>
            <div className='gs-logo skye-hero-logo'></div>
        </div>
    </section>;
}

export function renderStudioApps(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>Studio surfaces</h3>
        <div className='skye-section-intro'>Use these cards as the foundation for the app launcher experience you want to build next.</div>
        {renderCardGrid(studioCards, windowService)}
    </div>;
}

export function renderStudioWorkflow(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>Workflow lanes</h3>
        <div className='skye-section-intro'>Map your repo into clear intake, creation and delivery stages so the shell feels like a real production environment.</div>
        {renderCardGrid(workflowCards, windowService)}
    </div>;
}

function badgeText(label: string): string {
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
}
