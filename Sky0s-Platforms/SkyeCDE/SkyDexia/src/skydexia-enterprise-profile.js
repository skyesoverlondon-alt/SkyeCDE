export function getSkyDexiaEnterpriseProfile() {
  return {
    title: 'SkyDexia enterprise delivery board',
    description: 'SkyDexia is being built as a governed upgrade lane with explicit ownership, release gates, risk handling, and verification evidence instead of a generic bridge shell.',
    highlights: [
      { value: 'P1', label: 'program tier' },
      { value: '4', label: 'release gates tracked' },
      { value: '24h', label: 'operator review target' }
    ],
    workspacePacks: [
      {
        id: 'skydexia-lane-root',
        label: 'SkyDexia lane root',
        root: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
        recursive: true,
        limit: 200,
        description: 'Open the full SkyDexia lane package including shell, launch map, preview actions, and release artifacts.'
      },
      {
        id: 'skycde-shared-shell',
        label: 'SkyeCDE shared shell',
        root: 'Sky0s-Platforms/SkyeCDE/_shared',
        recursive: true,
        limit: 160,
        description: 'Inspect the shared shell and bridge plumbing that powers the lane.'
      },
      {
        id: 'skydex-source',
        label: 'Current SkyDex source',
        root: 'Sky0s-Platforms/SkyDex',
        recursive: false,
        limit: 120,
        description: 'Compare the upgrade lane against the preserved SkyDex product source.'
      }
    ],
    missionConsole: {
      title: 'SkyDexia command deck',
      description: 'Open the preserved SkyDex product, inspect lane-owned source, and start the exact runtimes that matter for SkyDexia release work.',
      launchDeck: [
        {
          label: 'Current SkyDex',
          targetKey: 'currentSkyDex',
          meta: 'Preserved product surface',
          description: 'Open the original SkyDex experience to confirm identity and release continuity.',
          buttonLabel: 'Open current SkyDex'
        },
        {
          label: 'SuperIDEia comparison lane',
          targetKey: 'superIDEia',
          meta: 'Cross-lane comparison',
          description: 'Open the SuperIDEia lane when the SkyDexia build needs side-by-side upgrade comparison.',
          buttonLabel: 'Open SuperIDEia'
        }
      ],
      ownershipDeck: [
        {
          label: 'Shell entry',
          path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-shell.js',
          description: 'Primary lane composition and shell wiring for SkyDexia.'
        },
        {
          label: 'Launch map',
          path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-launch-map.js',
          description: 'Canonical route map for full-app targets in the lane.'
        },
        {
          label: 'Runtime recipes',
          path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-terminal-actions.js',
          description: 'Lane runtime definitions for SkyDexia and comparison environments.'
        }
      ],
      runtimeDeck: [
        {
          label: 'SkyDexia primary runtime',
          recipeId: 'skydexia',
          meta: 'Primary smoke target',
          description: 'Start the SkyDexia static server for lane validation and release proof.',
          buttonLabel: 'Start SkyDexia runtime'
        },
        {
          label: 'SuperIDE comparison runtime',
          recipeId: 'superIDE',
          meta: 'Comparison target',
          description: 'Start the SuperIDE runtime when SkyDexia work needs product comparison.',
          buttonLabel: 'Start SuperIDE runtime'
        }
      ]
    },
    validationChecks: [
      {
        id: 'skydexia-launch-check',
        title: 'Preserved SkyDex launch check',
        owner: 'Core shell',
        description: 'Open the preserved SkyDex target and record that the authoritative product surface still routes correctly.',
        successDetail: 'Current SkyDex launch target opened successfully.',
        summarySteps: [
          'Open current SkyDex from the mission console.',
          'Confirm the preserved product path remains active.'
        ],
        steps: [
          { type: 'launch-target', targetKey: 'currentSkyDex' }
        ]
      },
      {
        id: 'skydexia-owned-file-check',
        title: 'Owned shell file check',
        owner: 'Core shell',
        description: 'Load the lane shell entry so the active implementation is in the editor before review.',
        successDetail: 'SkyDexia shell source loaded successfully.',
        summarySteps: [
          'Open the SkyDexia shell entry file.',
          'Confirm the file path and contents are loaded in-lane.'
        ],
        steps: [
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-shell.js' }
        ]
      },
      {
        id: 'skydexia-runtime-check',
        title: 'Primary runtime check',
        owner: 'Runtime ops',
        description: 'Start the primary SkyDexia runtime from inside the lane.',
        successDetail: 'SkyDexia runtime started successfully.',
        summarySteps: [
          'Start the SkyDexia runtime recipe.',
          'Confirm runtime state is populated in the lane.'
        ],
        steps: [
          { type: 'runtime-recipe', recipeId: 'skydexia' }
        ]
      }
    ],
    workflowActions: [
      {
        id: 'skydexia-release-kickoff',
        label: 'Release kickoff',
        description: 'Open the lane scope, generate the release brief, and pull the shell entry file into the editor for immediate review.',
        outcome: 'Operator starts a release cycle with the correct scope, artifact, and source file already loaded.',
        summarySteps: [
          'Open the SkyDexia lane workspace pack.',
          'Generate the dated release brief.',
          'Load the shell entry file for review.'
        ],
        steps: [
          { type: 'workspace-pack', packId: 'skydexia-lane-root' },
          { type: 'artifact-template', templateId: 'skydexia-release-brief' },
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-shell.js' }
        ]
      },
      {
        id: 'skydexia-runtime-smoke',
        label: 'Runtime smoke prep',
        description: 'Generate the smoke report and start the primary SkyDexia runtime so the lane is ready for proof capture.',
        outcome: 'Smoke evidence work begins with the runtime already started and the report path prepared.',
        summarySteps: [
          'Generate the smoke report artifact.',
          'Start the SkyDexia runtime recipe.'
        ],
        steps: [
          { type: 'artifact-template', templateId: 'skydexia-smoke-report' },
          { type: 'runtime-recipe', recipeId: 'skydexia' }
        ]
      }
    ],
    artifactTemplates: [
      {
        id: 'skydexia-release-brief',
        label: 'Release brief',
        path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/{{TODAY}}-release-brief.md',
        description: 'Create the lane release brief with change scope, runtime proof, and signoff fields.',
        content: '# {{LANE_TITLE}} Release Brief\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Change scope\n-\n\n## Product surfaces checked\n- Current SkyDex\n- SkyDexia lane shell\n\n## Runtime evidence\n- Runtime recipe:\n- Launch URL:\n- Log capture:\n\n## Risks and mitigations\n-\n\n## Signoff\n- Owner:\n- Reviewer:\n'
      },
      {
        id: 'skydexia-smoke-report',
        label: 'Smoke report',
        path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/{{TODAY}}-smoke-report.md',
        description: 'Generate a smoke checklist file for lane shell, runtime, and preserved-product validation.',
        content: '# {{LANE_TITLE}} Smoke Report\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Checks\n- [ ] Lane shell loads\n- [ ] Workspace pack opens\n- [ ] Runtime starts\n- [ ] Live logs stream\n- [ ] Current SkyDex launch path works\n\n## Notes\n-\n'
      },
      {
        id: 'skydexia-incident-log',
        label: 'Incident log',
        path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/{{TODAY}}-incident-log.md',
        description: 'Create an operator incident log for runtime or lane-shell failures.',
        content: '# {{LANE_TITLE}} Incident Log\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Incident summary\n-\n\n## Runtime id\n-\n\n## Evidence\n- stdout:\n- stderr:\n- reproduction path:\n\n## Recovery action\n-\n'
      }
    ],
    preflightChecks: [
      {
        title: 'Preserved-product check',
        owner: 'Core shell',
        outcome: 'Current SkyDex still opens as the authoritative product surface.',
        steps: [
          'Open the current SkyDex surface from the primary lane action.',
          'Confirm the preserved product remains distinct from the upgrade shell.',
          'Record any drift in the release brief before promotion.'
        ]
      },
      {
        title: 'Runtime readiness check',
        owner: 'Runtime ops',
        outcome: 'The primary lane runtime starts, exposes a launch URL, and returns live logs.',
        steps: [
          'Start the SkyDexia runtime recipe from the runtime panel.',
          'Follow live logs until the service is ready.',
          'Attach the runtime URL and log summary to the smoke report.'
        ]
      }
    ],
    deliveryStreams: [
      {
        name: 'Editor sovereignty',
        status: 'active',
        owner: 'Core shell',
        outcome: 'Keep SkyDex identity while hardening repo, file, and launch workflows into a release-safe coding lane.'
      },
      {
        name: 'Runtime control plane',
        status: 'active',
        owner: 'Runtime ops',
        outcome: 'Treat live runtime start, stop, restart, and logs as operator workflows rather than ad hoc buttons.'
      },
      {
        name: 'Evidence-backed delivery',
        status: 'next',
        owner: 'Release desk',
        outcome: 'Capture smoke, build, and file-change proof for each lane release instead of relying on memory.'
      }
    ],
    releaseGates: [
      {
        gate: 'Workspace control',
        status: 'ready',
        evidence: 'Bridge-backed browse, create, rename, move, and delete flows are in-lane and persistent.',
        nextAction: 'Add curated workspace views for source, docs, and release artifacts.'
      },
      {
        gate: 'File operations',
        status: 'ready',
        evidence: 'Read, write, and save-as flows operate on repo-backed paths with recent action history.',
        nextAction: 'Promote lane-owned templates and review artifacts into quick actions.'
      },
      {
        gate: 'Runtime operations',
        status: 'ready',
        evidence: 'Runtime lifecycle and live log polling are controlled from the lane shell.',
        nextAction: 'Add named runtime health checks per recipe.'
      },
      {
        gate: 'Release governance',
        status: 'in-progress',
        evidence: 'Program board, runbooks, and verification matrix are now visible inside the lane.',
        nextAction: 'Wire release evidence artifacts into a dedicated handoff file set.'
      }
    ],
    riskRegister: [
      {
        severity: 'high',
        title: 'Shell drift from original SkyDex',
        mitigation: 'Every launch action returns to the original product surface and keeps product identity first.'
      },
      {
        severity: 'medium',
        title: 'Runtime breakage hidden behind manual ops',
        mitigation: 'Operators can restart, inspect logs, and re-open live runtimes without leaving SkyDexia.'
      },
      {
        severity: 'medium',
        title: 'Upgrade work loses auditability',
        mitigation: 'Recent action history and verification matrix define the minimum delivery evidence set.'
      }
    ],
    runbooks: [
      {
        title: 'Release candidate verification',
        trigger: 'Before promoting a SkyDexia change set',
        owner: 'Release desk',
        steps: [
          'Open the lane-owned source files from quick hints and inspect the exact modified modules.',
          'Refresh runtimes, start the target runtime recipe, and verify the live launch URL resolves.',
          'Capture file save paths and runtime logs as the evidence pack for the release note.'
        ]
      },
      {
        title: 'Runtime incident triage',
        trigger: 'When a live dev surface fails or hangs',
        owner: 'Runtime ops',
        steps: [
          'Select the runtime from the active list so the lane shell is pointed at the correct process.',
          'Load logs, restart the runtime if safe, and reopen the live surface from the runtime card.',
          'Record the incident summary in the recent actions history and route follow-up into the lane-owned files.'
        ]
      }
    ],
    verificationMatrix: [
      {
        name: 'Workspace bridge proof',
        command: 'Load workspace and inspect SkyDexia-owned entries',
        evidence: 'Navigator returns repo entries and supports direct file loading from the lane shell.'
      },
      {
        name: 'Runtime operations proof',
        command: 'Start SkyDexia static server and follow live logs',
        evidence: 'Runtime card, PID, launch URL, and log stream are visible from one lane.'
      },
      {
        name: 'Product preservation proof',
        command: 'Open current SkyDex from primary action',
        evidence: 'Original product remains the reference surface, with SkyDexia acting as the governed upgrade lane.'
      }
    ]
  };
}