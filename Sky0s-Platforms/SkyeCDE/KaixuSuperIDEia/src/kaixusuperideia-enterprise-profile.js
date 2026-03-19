export function getKaixuSuperIDEiaEnterpriseProfile() {
  return {
    title: 'KaixuSuperIDEia enterprise control room',
    description: 'KaixuSuperIDEia now carries a browser-IDE operating model with defined release gates, incident runbooks, and verification proof instead of acting like a thin launcher wrapper.',
    highlights: [
      { value: '1', label: 'browser IDE core preserved' },
      { value: '3', label: 'governance lanes active' },
      { value: '0', label: 'replacement tolerance' }
    ],
    workspacePacks: [
      {
        id: 'kaixusuperideia-lane-root',
        label: 'KaixuSuperIDEia lane root',
        root: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia',
        recursive: true,
        limit: 200,
        description: 'Open the browser-IDE lane shell, launch map, runtime recipes, and generated delivery artifacts.'
      },
      {
        id: 'kaixusuper-product-root',
        label: 'Current KaixuSuper-IDE source',
        root: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
        recursive: false,
        limit: 120,
        description: 'Inspect the preserved browser IDE source while validating continuity.'
      },
      {
        id: 'skycde-shared-shell',
        label: 'SkyeCDE shared shell',
        root: 'Sky0s-Platforms/SkyeCDE/_shared',
        recursive: true,
        limit: 160,
        description: 'Inspect the shared shell and bridge components used by the lane.'
      }
    ],
    missionConsole: {
      title: 'KaixuSuperIDEia command deck',
      description: 'Open preserved browser-IDE surfaces, inspect lane-owned modules, and control browser-focused runtimes from one console.',
      launchDeck: [
        {
          label: 'Current KaixuSuper-IDE',
          targetKey: 'currentKaixuSuperIDE',
          meta: 'Preserved browser IDE surface',
          description: 'Open the current KaixuSuper-IDE product to validate browser continuity.',
          buttonLabel: 'Open current KaixuSuper-IDE'
        },
        {
          label: 'SkyDexia comparison lane',
          targetKey: 'skydexia',
          meta: 'Cross-lane comparison',
          description: 'Open SkyDexia when the browser IDE lane needs side-by-side upgrade comparison.',
          buttonLabel: 'Open SkyDexia'
        }
      ],
      ownershipDeck: [
        {
          label: 'Shell entry',
          path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-shell.js',
          description: 'Primary browser IDE lane shell composition and command wiring.'
        },
        {
          label: 'Launch map',
          path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-launch-map.js',
          description: 'Canonical launch mapping for the preserved browser IDE and upgrade lane.'
        },
        {
          label: 'Runtime recipes',
          path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-terminal-actions.js',
          description: 'Runtime recipe definitions for browser IDE operations and comparison work.'
        }
      ],
      runtimeDeck: [
        {
          label: 'KaixuSuper primary runtime',
          recipeId: 'kaixusuperide',
          meta: 'Primary browser runtime',
          description: 'Start the main KaixuSuper-IDE runtime for continuity and recovery validation.',
          buttonLabel: 'Start KaixuSuper runtime'
        },
        {
          label: 'SkyDexia comparison runtime',
          recipeId: 'skydexia',
          meta: 'Comparison target',
          description: 'Start SkyDexia when browser IDE changes need lane comparison.',
          buttonLabel: 'Start SkyDexia runtime'
        }
      ]
    },
    validationChecks: [
      {
        id: 'kaixusuper-launch-check',
        title: 'Preserved KaixuSuper launch check',
        owner: 'Experience core',
        description: 'Open the preserved KaixuSuper-IDE target and confirm browser continuity still routes correctly.',
        successDetail: 'Current KaixuSuper-IDE launch target opened successfully.',
        summarySteps: [
          'Open current KaixuSuper-IDE from the mission console.',
          'Confirm the preserved browser IDE path remains active.'
        ],
        steps: [
          { type: 'launch-target', targetKey: 'currentKaixuSuperIDE' }
        ]
      },
      {
        id: 'kaixusuper-owned-file-check',
        title: 'Owned shell file check',
        owner: 'Experience core',
        description: 'Load the KaixuSuperIDEia shell file into the editor as a readiness check.',
        successDetail: 'KaixuSuperIDEia shell source loaded successfully.',
        summarySteps: [
          'Open the KaixuSuperIDEia shell entry file.',
          'Confirm the lane file is loaded in the editor surface.'
        ],
        steps: [
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-shell.js' }
        ]
      },
      {
        id: 'kaixusuper-runtime-check',
        title: 'Primary runtime check',
        owner: 'Runtime ops',
        description: 'Start the main KaixuSuper runtime from the lane.',
        successDetail: 'KaixuSuper runtime started successfully.',
        summarySteps: [
          'Start the KaixuSuper runtime recipe.',
          'Confirm runtime state is available in-lane.'
        ],
        steps: [
          { type: 'runtime-recipe', recipeId: 'kaixusuperide' }
        ]
      }
    ],
    workflowActions: [
      {
        id: 'kaixusuperideia-browser-review',
        label: 'Browser continuity review',
        description: 'Open the preserved KaixuSuper-IDE scope, generate the browser regression sheet, and load the lane shell for review.',
        outcome: 'Browser continuity review starts with source scope, review artifact, and shell source in one place.',
        summarySteps: [
          'Open the current KaixuSuper-IDE source pack.',
          'Generate the browser regression sheet.',
          'Load the KaixuSuperIDEia shell file.'
        ],
        steps: [
          { type: 'workspace-pack', packId: 'kaixusuper-product-root' },
          { type: 'artifact-template', templateId: 'kaixusuperideia-browser-regression' },
          { type: 'file-hint', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-shell.js' }
        ]
      },
      {
        id: 'kaixusuperideia-runtime-recovery',
        label: 'Runtime recovery prep',
        description: 'Generate the incident log and start the primary KaixuSuper runtime for recovery validation.',
        outcome: 'Recovery work starts with the incident file ready and the runtime under lane management.',
        summarySteps: [
          'Generate the incident log artifact.',
          'Start the KaixuSuper runtime recipe.'
        ],
        steps: [
          { type: 'artifact-template', templateId: 'kaixusuperideia-incident-log' },
          { type: 'runtime-recipe', recipeId: 'kaixusuperide' }
        ]
      }
    ],
    artifactTemplates: [
      {
        id: 'kaixusuperideia-release-brief',
        label: 'Release brief',
        path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/delivery/{{TODAY}}-release-brief.md',
        description: 'Generate a release brief for browser-IDE continuity, runtime evidence, and approval notes.',
        content: '# {{LANE_TITLE}} Release Brief\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Browser-IDE scope\n-\n\n## Continuity checks\n-\n\n## Runtime evidence\n-\n\n## Approval notes\n-\n'
      },
      {
        id: 'kaixusuperideia-browser-regression',
        label: 'Browser regression sheet',
        path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/delivery/{{TODAY}}-browser-regression.md',
        description: 'Create a browser regression worksheet for shell and launch-path validation.',
        content: '# {{LANE_TITLE}} Browser Regression Sheet\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Checks\n- [ ] Lane shell renders\n- [ ] Current KaixuSuper-IDE opens\n- [ ] Browser launch routes work\n- [ ] Runtime logs available\n\n## Notes\n-\n'
      },
      {
        id: 'kaixusuperideia-incident-log',
        label: 'Incident log',
        path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/delivery/{{TODAY}}-incident-log.md',
        description: 'Generate an incident log for browser IDE runtime or route failures.',
        content: '# {{LANE_TITLE}} Incident Log\n\nDate: {{TODAY}}\nGenerated: {{TIMESTAMP}}\n\n## Incident summary\n-\n\n## Browser impact\n-\n\n## Evidence\n-\n\n## Recovery action\n-\n'
      }
    ],
    preflightChecks: [
      {
        title: 'Browser continuity check',
        owner: 'Experience core',
        outcome: 'The preserved browser IDE remains authoritative and reachable after lane changes.',
        steps: [
          'Open the current KaixuSuper-IDE surface from the lane action bar.',
          'Confirm the browser IDE route and top-level experience still behave correctly.',
          'Record the result in the browser regression sheet.'
        ]
      },
      {
        title: 'Runtime recovery check',
        owner: 'Runtime ops',
        outcome: 'Operators can recover the runtime from inside the lane shell.',
        steps: [
          'Start the KaixuSuper runtime recipe.',
          'Load live logs and validate the runtime URL.',
          'Restart once and confirm the live surface returns.'
        ]
      }
    ],
    deliveryStreams: [
      {
        name: 'Browser IDE preservation',
        status: 'active',
        owner: 'Experience core',
        outcome: 'Keep the browser-IDE model as the product center while adding enterprise operations around it.'
      },
      {
        name: 'Operational resilience',
        status: 'active',
        owner: 'Runtime ops',
        outcome: 'Handle runtime failures, logs, and restarts from the same surface used for day-to-day work.'
      },
      {
        name: 'Governed promotion',
        status: 'next',
        owner: 'Release desk',
        outcome: 'Require explicit readiness checks before browser-IDE upgrades move forward.'
      }
    ],
    releaseGates: [
      {
        gate: 'Browser IDE continuity',
        status: 'ready',
        evidence: 'The lane continues to route users back to the current KaixuSuper-IDE instead of replacing it.',
        nextAction: 'Add browser-specific quality prompts for recovery and regression review.'
      },
      {
        gate: 'Operational shell depth',
        status: 'ready',
        evidence: 'Workspace, file, runtime, and launch workflows are available in one lane shell.',
        nextAction: 'Expand quality evidence packs around browser-focused incidents.'
      },
      {
        gate: 'Release governance',
        status: 'in-progress',
        evidence: 'Enterprise control-room content is embedded in the lane.',
        nextAction: 'Link signoff artifacts into lane-owned release docs.'
      }
    ],
    riskRegister: [
      {
        severity: 'high',
        title: 'Browser IDE behavior regresses under upgrade pressure',
        mitigation: 'Continuity gate and preserved-product launch path stay visible at the top of the lane.'
      },
      {
        severity: 'medium',
        title: 'Browser runtime incidents take too long to isolate',
        mitigation: 'Runtime cards, logs, and restart controls are embedded alongside release guidance.'
      },
      {
        severity: 'medium',
        title: 'Promotion occurs without explicit browser checks',
        mitigation: 'Verification matrix requires launch and readiness proof before promotion.'
      }
    ],
    runbooks: [
      {
        title: 'Browser regression review',
        trigger: 'When the lane shell or launch targets change',
        owner: 'Experience core',
        steps: [
          'Open the preserved KaixuSuper-IDE surface from the action bar and confirm expected browser behavior.',
          'Inspect the lane-owned source files from quick hints to validate the exact edited modules.',
          'Record validation results in the release evidence pack before promotion.'
        ]
      },
      {
        title: 'Live runtime recovery',
        trigger: 'When the browser IDE runtime degrades',
        owner: 'Runtime ops',
        steps: [
          'Refresh runtimes, select the target process, and load logs for immediate triage.',
          'Restart or stop the runtime as needed, then reopen the live URL from the runtime card.',
          'Escalate with captured stdout and stderr if the incident survives one restart cycle.'
        ]
      }
    ],
    verificationMatrix: [
      {
        name: 'Browser continuity proof',
        command: 'Open current KaixuSuper-IDE from the lane action bar',
        evidence: 'Original browser IDE remains reachable and authoritative.'
      },
      {
        name: 'Control-room proof',
        command: 'Review gates, risks, and runbooks in the lane before release',
        evidence: 'Operators can see the delivery posture without leaving the product surface.'
      },
      {
        name: 'Runtime recovery proof',
        command: 'Run lifecycle controls and inspect live logs',
        evidence: 'Browser runtime incidents can be triaged and recovered from the lane shell.'
      }
    ]
  };
}