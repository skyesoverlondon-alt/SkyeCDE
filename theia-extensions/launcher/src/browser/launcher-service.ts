/********************************************************************************
 * Copyright (C) 2022 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Endpoint } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

export interface LauncherTargetMetadata {
    id: string;
    label: string;
    launchUrl?: string;
    commandId?: string;
    requiresGateBootstrap?: boolean;
    gateAlias?: string;
}

export interface LauncherBootstrapOptions {
    uriScheme?: string;
    gateUrl?: string;
    sessionToken?: string;
    requiresGateBootstrap?: boolean;
    launchTargets?: LauncherTargetMetadata[];
}

@injectable()
export class LauncherService {

    async isInitialized(uriScheme?: string): Promise<boolean> {
        const query = uriScheme ? `?uriScheme=${encodeURIComponent(uriScheme)}` : '';
        const response = await fetch(new Request(`${this.endpoint()}/initialized${query}`), {
            body: undefined,
            method: 'GET'
        }).then(r => r.json());
        return !!response?.initialized;
    }

    async createLauncher(create: boolean, uriSchemeOrOptions?: string | LauncherBootstrapOptions): Promise<void> {
        const options: LauncherBootstrapOptions = typeof uriSchemeOrOptions === 'string'
            ? { uriScheme: uriSchemeOrOptions }
            : (uriSchemeOrOptions ?? {});
        fetch(new Request(`${this.endpoint()}`), {
            body: JSON.stringify({
                create,
                uriScheme: options.uriScheme,
                requiresGateBootstrap: !!options.requiresGateBootstrap,
                gateUrl: options.gateUrl,
                sessionToken: options.sessionToken,
                launchTargets: options.launchTargets ?? []
            }),
            method: 'PUT',
            headers: new Headers({ 'Content-Type': 'application/json' })
        });
    }

    buildFirstPartyLaunchTargets(uriScheme: string): LauncherTargetMetadata[] {
        const normalizedScheme = String(uriScheme || 'skye').trim();
        const launchUri = (path: string): string => `${normalizedScheme}://launch?target=${encodeURIComponent(path)}`;

        return [
            {
                id: 'skydex-autonomous',
                label: 'SkyDex Autonomous',
                launchUrl: launchUri('SkyDex4_fixed/index.html?mode=execute&autonomy=autonomous&cde=1'),
                requiresGateBootstrap: true,
                gateAlias: 'kaixu/deep'
            },
            {
                id: 'app-catalog',
                label: '0s App Catalog',
                commandId: 'skyes-over-london:open-app-catalog',
                requiresGateBootstrap: false
            }
        ];
    }

    protected endpoint(): string {
        const url = new Endpoint({ path: 'launcher' }).getRestUrl().toString();
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
}
