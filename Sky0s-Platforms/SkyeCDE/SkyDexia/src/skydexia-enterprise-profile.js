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
      },
      {
        id: 'skydexia-release-ops',
        label: 'SkyDexia release and ops',
        root: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
        recursive: true,
        limit: 120,
        description: 'Open the deployment, operations, and delivery assets that govern SkyDexia rollout and recovery.'
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
        },
        {
          label: 'Deployment systems guide',
          path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/deployment/SKYDEXIA_DEPLOYMENT_SYSTEMS.md',
          description: 'Lane-owned deployment contract for local serving, launcher integration, bridge endpoints, ports, and evidence expectations.'
        },
        {
          label: 'Runtime runbook',
          path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/ops/SKYDEXIA_RUNTIME_RUNBOOK.md',
          description: 'Operator runbook for runtime triage, restart, evidence capture, and rollback discipline.'
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
      },
      {
        id: 'skydexia-deployment-guide-check',
        title: 'Deployment systems guide check',
        owner: 'Release desk',
        description: 'Load the lane-owned deployment systems guide so deployment rules and integration requirements are visible in the lane.',
        successDetail: 'SkyDexia deployment systems guide loaded successfully.',
        summarySteps: [
          'Open the SkyDexia deployment systems guide.',
          'Confirm deployment and bridge rules are visible in the lane.'
        ],
        steps: [
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/deployment/SKYDEXIA_DEPLOYMENT_SYSTEMS.md' }
        ]
      },
      {
        id: 'skydexia-release-ops-pack-check',
        title: 'Release and ops pack check',
        owner: 'Release desk',
        description: 'Open the SkyDexia release and operations scope to verify the lane owns its rollout and recovery artifacts.',
        successDetail: 'SkyDexia release and operations pack opened successfully.',
        summarySteps: [
          'Open the SkyDexia release and ops workspace pack.',
          'Confirm deployment, delivery, and operations files are in scope.'
        ],
        steps: [
          { type: 'workspace-pack', packId: 'skydexia-release-ops' }
        ]
      },
      {
        id: 'skydexia-rollout-plan-check',
        title: 'Rollout artifact check',
        owner: 'Release desk',
        description: 'Generate the rollout plan artifact from inside the lane to prove that release documentation is lane-owned and executable.',
        successDetail: 'SkyDexia rollout plan artifact generated successfully.',
        summarySteps: [
          'Generate the rollout plan artifact.',
          'Confirm the dated artifact path is returned into the lane.'
        ],
        steps: [
          { type: 'artifact-template', templateId: 'skydexia-rollout-plan' }
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
      },
      {
        id: 'skydexia-release-operations-bridge',
        label: 'Release operations bridge',
        description: 'Open the SkyDexia release and operations scope, load the deployment guide, generate the rollout plan, and start the lane runtime.',
        outcome: 'Operators enter rollout work with the deployment contract, rollout artifact, and runtime already in the lane.',
        summarySteps: [
          'Open the SkyDexia release and operations scope.',
          'Load the deployment systems guide.',
          'Generate the rollout plan.',
          'Start the SkyDexia runtime.'
        ],
        steps: [
          { type: 'workspace-pack', packId: 'skydexia-release-ops' },
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/deployment/SKYDEXIA_DEPLOYMENT_SYSTEMS.md' },
          { type: 'artifact-template', templateId: 'skydexia-rollout-plan' },
          { type: 'runtime-recipe', recipeId: 'skydexia' }
        ]
      },
      {
        id: 'skydexia-runtime-incident-desk',
        label: 'Runtime incident desk',
        description: 'Load the runtime runbook, generate the incident log, and reopen the preserved SkyDex product as the comparison surface during triage.',
        outcome: 'Incident handling starts with the exact runbook, evidence file, and preserved product surface ready.',
        summarySteps: [
          'Load the runtime runbook.',
          'Generate the incident log artifact.',
          'Open current SkyDex for continuity comparison.'
        ],
        steps: [
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/ops/SKYDEXIA_RUNTIME_RUNBOOK.md' },
          { type: 'artifact-template', templateId: 'skydexia-incident-log' },
          { type: 'launch-target', targetKey: 'currentSkyDex' }
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
      },
      {
        id: 'skydexia-rollout-plan',
        label: 'Rollout plan',
        path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/{{TODAY}}-rollout-plan.md',
        description: 'Generate a rollout plan for deployment sequence, rollback conditions, and evidence capture.',
        content: '# {{LANE_TITLE}} Rollout Plan\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Rollout sequence\n1.\n2.\n3.\n\n## Required evidence\n- Release brief\n- Smoke report\n- Runtime logs\n- Preserved product continuity proof\n\n## Rollback conditions\n-\n\n## Rollback owner\n-\n'
      },
      {
        id: 'skydexia-environment-audit',
        label: 'Environment audit',
        path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/{{TODAY}}-environment-audit.md',
        description: 'Generate an environment audit sheet for local ports, bridge requirements, and deployment assumptions.',
        content: '# {{LANE_TITLE}} Environment Audit\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Runtime contract\n- Port:\n- Launch URL:\n- Workspace root:\n\n## Bridge dependencies\n- /launcher/skycde/workspace\n- /launcher/skycde/file\n- /launcher/skycde/terminal/*\n\n## Review notes\n-\n'
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
      },
      {
        title: 'Deployment systems review',
        owner: 'Release desk',
        outcome: 'Operators know which runtime, bridge endpoints, local ports, and evidence files are required before rollout.',
        steps: [
          'Load the lane-owned deployment systems guide from SkyDexia quick files.',
          'Confirm local serving, launcher bridge, and evidence expectations are still accurate.',
          'Generate the environment audit before promotion if anything changed.'
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
        status: 'active',
        owner: 'Release desk',
        outcome: 'Capture smoke, rollout, environment, and file-change proof for every SkyDexia release instead of relying on memory.'
      },
      {
        name: 'Deployment command center',
        status: 'active',
        owner: 'Release desk',
        outcome: 'Keep deployment contract, rollback planning, and incident handling inside SkyDexia instead of external notes.'
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
        status: 'ready',
        evidence: 'Program board, runbooks, deployment guide, release artifacts, and handoff generation now live inside the lane.',
        nextAction: 'Keep deployment contract current as launcher or runtime assumptions change.'
      },
      {
        gate: 'Deployment discipline',
        status: 'ready',
        evidence: 'SkyDexia owns a deployment systems guide, rollout plan template, environment audit, and runtime incident runbook.',
        nextAction: 'Validate the guide against the real launcher backend during promotion windows.'
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
      },
      {
        severity: 'medium',
        title: 'Deployment assumptions drift from the lane implementation',
        mitigation: 'SkyDexia now carries a lane-owned deployment systems guide and environment audit template for every release cycle.'
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
        title: 'Deployment command review',
        trigger: 'Before publishing SkyDexia as a release-ready lane',
        owner: 'Release desk',
        steps: [
          'Load the SkyDexia deployment systems guide and confirm launcher bridge assumptions still match the lane.',
          'Generate the rollout plan and environment audit so the promotion packet is lane-owned.',
          'Store the release handoff after validation and runtime proof are complete.'
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
      },
      {
        name: 'Deployment contract proof',
        command: 'Load SKYDEXIA_DEPLOYMENT_SYSTEMS.md and generate rollout/environment artifacts',
        evidence: 'Deployment assumptions, release sequence, and audit expectations are controlled from inside SkyDexia.'
      }
    ]
  };
}