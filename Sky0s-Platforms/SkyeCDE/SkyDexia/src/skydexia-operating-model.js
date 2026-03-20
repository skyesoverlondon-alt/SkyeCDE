export function getSkyDexiaOperatingModel() {
  return {
    audit: {
      currentScore: 49,
      targetScore: 85,
      summary: 'SkyDexia already owns real release discipline, but it still has to graduate from a governed wrapper into a multi-page SkyDex-first operating package.'
    },
    pages: [
      { id: 'command', label: 'Command Center', summary: 'Score, directives, mission deck, and lane-wide status.' },
      { id: 'workspace', label: 'Workspace + Files', summary: 'Repo navigation, file editing, and lane-owned source control.' },
      { id: 'runtime', label: 'Runtime + Logs', summary: 'Start, stop, inspect, and recover live runtimes.' },
      { id: 'launch', label: 'Launch Surfaces', summary: 'Preserved product authority and full-app launch routing.' },
      { id: 'delivery', label: 'Delivery + Proof', summary: 'Validation, workflows, artifacts, release gates, and handoff output.' },
      { id: 'cloud', label: 'GitHub + Cloud', summary: 'GitHub, Netlify, Cloudflare, data, and storage posture.' },
      { id: 'mail', label: 'Mail + Identity', summary: 'SMTP, Resend fallback, forms, identity, and admin posture.' },
      { id: 'sovereign', label: 'Sovereign Controls', summary: '0megaSkyeGate, SKNore, SovereignVariables, and .skye posture.' }
    ],
    directives: [
      'SkyDex remains the product authority.',
      'SkyDexia expands by dedicated pages, not by stacking more panels into one shell.',
      'Every menu, panel, and drawer must be scrollable, collapsible, and minimizable.',
      'Theia stays in the support layer behind SkyDex-owned operator flows.',
      'Release proof must come from live lane controls, not from notes alone.'
    ],
    launchLanes: [
      {
        tag: 'Product authority',
        title: 'Current SkyDex operating surface',
        status: 'live',
        summary: 'The original SkyDex surface already carries bounded agenting, SKNore release truth, GitHub push, and Netlify deploy controls that SkyDexia has to preserve and elevate.',
        actions: [
          { type: 'launch-target', label: 'Open current SkyDex', targetKey: 'currentSkyDex' },
          { type: 'file-path', label: 'Open SkyDex README', path: 'Sky0s-Platforms/SkyDex/SkyDex4_fixed/README.md' },
          { type: 'workspace-root', label: 'Inspect SkyDex source root', root: 'Sky0s-Platforms/SkyDex/SkyDex4_fixed', recursive: true, limit: 180 }
        ]
      },
      {
        tag: 'Upgrade package',
        title: 'SkyDexia full-app discipline',
        status: 'active',
        summary: 'All SkyDexia launch paths must stay on real app surfaces. No preview-widget fallback is acceptable for production-facing routes.',
        actions: [
          { type: 'launch-target', label: 'Open SkyDexia full app', targetKey: 'self' },
          { type: 'file-path', label: 'Open launch map', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-launch-map.js' },
          { type: 'file-path', label: 'Open audit checklist', path: 'SkyeDevNotes/PAtches and upgrades/TheiaLaunchers/SkyDexia-SkyeStandard-Audit.md' }
        ]
      },
      {
        tag: 'Comparison',
        title: 'Cross-lane comparison surfaces',
        status: 'available',
        summary: 'SkyDexia can compare itself against the other major Skye IDE lanes without making them the current work target.',
        actions: [
          { type: 'launch-target', label: 'Open SuperIDEia', targetKey: 'superIDEia' },
          { type: 'launch-target', label: 'Open KaixuSuperIDEia', targetKey: 'kaixuSuperIDEia' },
          { type: 'launch-target', label: 'Open SkaixuProIDEia', targetKey: 'skaixuProIDEia' }
        ]
      }
    ],
    cloudLanes: [
      {
        tag: 'GitHub',
        title: 'Source promotion lane',
        status: 'build-out',
        summary: 'SkyDexia needs a first-class promotion surface for repo, branch, commit, release evidence, and push posture.',
        actions: [
          { type: 'file-path', label: 'Open release command center', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/SKYDEXIA_RELEASE_COMMAND_CENTER.md' },
          { type: 'file-path', label: 'Open deployment systems guide', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/deployment/SKYDEXIA_DEPLOYMENT_SYSTEMS.md' }
        ]
      },
      {
        tag: 'Netlify',
        title: 'Functions and deploy posture',
        status: 'build-out',
        summary: 'Netlify deploy, functions, blobs, and evidence should be visible from a dedicated page instead of hidden behind a generic release note.',
        actions: [
          { type: 'workspace-root', label: 'Inspect SuperIDE Netlify root', root: 'Sky0s-Platforms/SuperIDE', recursive: false, limit: 120 },
          { type: 'file-path', label: 'Open environment template', path: 'SkyeDevNotes/DeployGuides/UltimateEnVarTemplate' }
        ]
      },
      {
        tag: 'Cloudflare',
        title: 'Edge worker boundary',
        status: 'build-out',
        summary: 'Worker targets, bindings, and deployment truth need a first-class Cloudflare operating surface.',
        actions: [
          { type: 'workspace-root', label: 'Inspect 0megaSkyeGate root', root: 'Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate', recursive: false, limit: 120 },
          { type: 'workspace-root', label: 'Inspect SuperIDE worker lane', root: 'Sky0s-Platforms/SuperIDE/worker', recursive: true, limit: 160 }
        ]
      },
      {
        tag: 'Data',
        title: 'Neon, R2, and Blobs posture',
        status: 'build-out',
        summary: 'Neon/Postgres, R2, and Netlify Blobs are part of the real Skye Standard and need an explicit operating posture from SkyDexia.',
        actions: [
          { type: 'workspace-root', label: 'Inspect SuperIDE db root', root: 'Sky0s-Platforms/SuperIDE/db', recursive: true, limit: 140 },
          { type: 'file-path', label: 'Open SkyDexia audit', path: 'SkyeDevNotes/PAtches and upgrades/TheiaLaunchers/SkyDexia-SkyeStandard-Audit.md' }
        ]
      }
    ],
    mailIdentityLanes: [
      {
        tag: 'Mail',
        title: 'SMTP and Resend posture',
        status: 'build-out',
        summary: 'SkyDexia needs a real mail operating surface covering Gmail-compatible SMTP, Resend fallback, and message-lane readiness.',
        actions: [
          { type: 'workspace-root', label: 'Inspect SkyeMail2.0 root', root: 'Sky0s-Platforms/SkyeMail2.0', recursive: false, limit: 140 },
          { type: 'file-path', label: 'Open environment template', path: 'SkyeDevNotes/DeployGuides/UltimateEnVarTemplate' }
        ]
      },
      {
        tag: 'Identity',
        title: 'Forms, login, and admin posture',
        status: 'build-out',
        summary: 'Identity, forms, admin capture, and access posture should be promoted into one owned operator surface.',
        actions: [
          { type: 'workspace-root', label: 'Inspect SkyeMail identity surfaces', root: 'Sky0s-Platforms/SkyeMail2.0', recursive: false, limit: 120 },
          { type: 'workspace-root', label: 'Inspect SuperIDE docs', root: 'Sky0s-Platforms/SuperIDE/docs', recursive: true, limit: 120 }
        ]
      }
    ],
    sovereignLanes: [
      {
        tag: 'Gate',
        title: '0megaSkyeGate boundary',
        status: 'active',
        summary: 'The sovereign AI boundary is already real in this repo. SkyDexia should expose that truth directly and keep release work gate-aware.',
        actions: [
          { type: 'workspace-root', label: 'Inspect gate root', root: 'Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate', recursive: true, limit: 160 },
          { type: 'file-path', label: 'Open Skye Standard', path: 'SkyeDevNotes/PAtches and upgrades/TheiaLaunchers/SkyeStandard' }
        ]
      },
      {
        tag: 'Policy',
        title: 'SKNore release truth',
        status: 'active',
        summary: 'SkyDex already proves SKNore matters for release truth. SkyDexia has to carry that policy posture into its own operating package.',
        actions: [
          { type: 'launch-target', label: 'Open current SkyDex policy surface', targetKey: 'currentSkyDex' },
          { type: 'file-path', label: 'Open SkyDex README', path: 'Sky0s-Platforms/SkyDex/SkyDex4_fixed/README.md' }
        ]
      },
      {
        tag: 'Variables',
        title: 'SovereignVariables and .skye posture',
        status: 'build-out',
        summary: 'SovereignVariables, vault flows, and .skye package posture need first-class operator visibility instead of being implied by notes.',
        actions: [
          { type: 'workspace-root', label: 'Inspect SuperIDE SovereignVariables', root: 'Sky0s-Platforms/SuperIDE/SovereignVariables', recursive: true, limit: 160 },
          { type: 'file-path', label: 'Open SkyDexia audit', path: 'SkyeDevNotes/PAtches and upgrades/TheiaLaunchers/SkyDexia-SkyeStandard-Audit.md' }
        ]
      }
    ]
  };
}