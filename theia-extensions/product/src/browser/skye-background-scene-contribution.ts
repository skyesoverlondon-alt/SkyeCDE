/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

const THREE: any = require('three');

declare global {
    interface Window {
        SKYE_SCENE_CONFIG?: {
            mode?: 'gridflow' | 'constellation';
        };
    }
}

@injectable()
export class SkyeBackgroundSceneContribution implements FrontendApplicationContribution {

    protected renderer: any;
    protected scene: any;
    protected camera: any;
    protected starField: any;
    protected goldField: any;
    protected gridGroup: any;
    protected frameHandle = 0;
    protected host: HTMLDivElement | undefined;
    protected resizeHandler = () => this.resize();

    onStart(_app: FrontendApplication): void {
        if (document.getElementById('skye-shell-background')) {
            return;
        }

        document.body.classList.add('skye-shell-layered');
        const host = document.createElement('div');
        host.id = 'skye-shell-background';
        host.className = 'skye-shell-background';
        const canvas = document.createElement('canvas');
        canvas.className = 'skye-shell-background-canvas';
        host.appendChild(canvas);
        document.body.prepend(host);
        this.host = host;

        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x06110d, 0.045);
        this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 0.4, 13);

        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        const point = new THREE.PointLight(0x7ed9a7, 1.4, 40, 2);
        point.position.set(-3, 2, 8);
        const gold = new THREE.PointLight(0xffd86b, 1.2, 40, 2);
        gold.position.set(5, -2, 7);
        this.scene.add(ambient, point, gold);

        this.starField = this.createPointCloud(540, 0x7ed9a7, 0.05, 18);
        this.goldField = this.createPointCloud(240, 0xffd86b, 0.045, 14);
        this.gridGroup = this.createGridGroup(window.SKYE_SCENE_CONFIG?.mode ?? 'gridflow');
        this.scene.add(this.starField, this.goldField, this.gridGroup);

        this.resize();
        window.addEventListener('resize', this.resizeHandler, { passive: true });
        this.animate();
    }

    protected createPointCloud(count: number, color: number, size: number, spread: number): any {
        const positions = new Float32Array(count * 3);
        for (let index = 0; index < count; index++) {
            const stride = index * 3;
            positions[stride] = (Math.random() - 0.5) * spread;
            positions[stride + 1] = (Math.random() - 0.5) * spread;
            positions[stride + 2] = (Math.random() - 0.5) * spread;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Points(geometry, material);
    }

    protected createGridGroup(mode: 'gridflow' | 'constellation'): any {
        const group = new THREE.Group();
        const material = new THREE.LineBasicMaterial({ color: 0x7ed9a7, transparent: true, opacity: mode === 'gridflow' ? 0.28 : 0.14 });
        const goldMaterial = new THREE.LineBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.18 });
        const size = 20;
        const step = 1.5;

        const plane = new THREE.Group();
        for (let value = -size; value <= size; value += step) {
            const horizontal = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-size, value, 0),
                new THREE.Vector3(size, value, 0)
            ]);
            const vertical = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(value, -size, 0),
                new THREE.Vector3(value, size, 0)
            ]);
            plane.add(new THREE.Line(horizontal, material));
            plane.add(new THREE.Line(vertical, goldMaterial));
        }
        plane.rotation.x = -Math.PI / 2.4;
        plane.position.set(0, -4.8, -6);
        group.add(plane);

        const ring = new THREE.TorusGeometry(3.8, 0.035, 16, 120);
        const ringMesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0x7ed9a7, transparent: true, opacity: 0.18 }));
        ringMesh.rotation.x = Math.PI / 2.8;
        ringMesh.position.set(-1.8, 2.2, -7);
        group.add(ringMesh);

        return group;
    }

    protected resize(): void {
        if (!this.renderer || !this.camera) {
            return;
        }
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / Math.max(height, 1);
        this.camera.updateProjectionMatrix();
    }

    protected animate = (): void => {
        if (!this.renderer || !this.scene || !this.camera) {
            return;
        }

        const time = performance.now() * 0.00025;
        if (this.starField) {
            this.starField.rotation.y = time * 0.8;
            this.starField.rotation.x = Math.sin(time * 1.7) * 0.15;
        }
        if (this.goldField) {
            this.goldField.rotation.y = -time * 1.2;
            this.goldField.rotation.z = Math.sin(time) * 0.12;
        }
        if (this.gridGroup) {
            this.gridGroup.rotation.z = Math.sin(time * 0.7) * 0.05;
            this.gridGroup.position.y = Math.sin(time * 2) * 0.18;
        }

        this.camera.position.x = Math.sin(time * 1.4) * 0.55;
        this.camera.position.y = 0.35 + Math.cos(time * 1.1) * 0.28;
        this.camera.lookAt(0, 0, -4);
        this.renderer.render(this.scene, this.camera);
        this.frameHandle = window.requestAnimationFrame(this.animate);
    };
}