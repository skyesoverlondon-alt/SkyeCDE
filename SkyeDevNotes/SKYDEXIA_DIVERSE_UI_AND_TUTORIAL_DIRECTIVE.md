# SKYDEXIA DIVERSE UI AND TUTORIAL DIRECTIVE

## Goal

Create a version of SkyDexia where users can choose the visual identity that fits them best instead of being stuck with one look.

This directive covers three linked outcomes:

1. add switchable UI themes in settings
2. add three named colorways for SkyDexia
3. update the tutorial so a beginner can learn the product using plain-language explanations

## Required theme families

SkyDexia should ship with at least these selectable looks:

1. Pink and gold
2. Pink and blue
3. Yellow and neon pink

These should not be one-off hacks. They should be first-class themes.

## Product requirement

Users must be able to swap UI themes from settings without editing code.

That means the final product should include:

- a settings surface for theme choice
- persistent saved preference so the chosen theme comes back on reload
- a clean token-based theme system instead of hardcoded scattered colors
- enough contrast and accessibility checks that the UI stays readable

## Design direction

The intent is not just recoloring buttons.

The intent is to let SkyDexia express multiple identities while still feeling like the same product.

Each theme should define:

- background colors
- panel colors
- text colors
- accent colors
- border/glow colors
- button states
- tutorial card styling
- dock styling
- terminal/workbench highlight styling
- focus ring styling

## Settings requirement

SkyDexia needs a dedicated settings area or settings panel that includes at minimum:

- theme selector
- theme preview label
- reset to default option
- remember my choice toggle if needed

Preferred implementation shape:

- store theme name in local storage or the existing user preference lane
- apply a theme attribute on the document root, such as a data-theme value
- define CSS custom properties for each supported theme
- keep component styling driven by variables rather than one-off overrides

## Required themes

### Theme 1: Pink and gold

This version should feel rich, confident, and premium.

Suggested palette direction:

- blush pink or hot pink accent
- warm gold highlight
- cream, deep plum, or soft charcoal support tones if needed

### Theme 2: Pink and blue

This version should feel bright, fluid, and energetic.

Suggested palette direction:

- vivid pink accent
- sky blue or electric blue accent
- balanced neutral background so the interface stays readable

### Theme 3: Yellow and neon pink

This version should feel loud, futuristic, and playful.

Suggested palette direction:

- electric yellow base accents
- neon pink highlight accents
- darker grounding surfaces so the neon colors stay legible

## Tutorial requirement

The tutorial should be rewritten or expanded so a person with almost no technical background can understand what SkyDexia does.

The tutorial should be based on the plain-language capability file:

- [What She Can Do](/workspaces/SkyeCDE/Skye0s-s0l26/Sky0s-Platforms/SkyeCDE/SkyDexia-2.6/What%20She%20Can%20Do)

The tutorial should explain, in beginner terms:

- what a workspace is
- what AI is doing inside SkyDexia
- what templates and presets are
- how to run a project
- what the terminal means
- how to save and restore work
- what SkyeDrive does
- how GitHub push works
- how Netlify deploy works
- what a deferred release means
- how theme settings work

## Tutorial experience changes

The tutorial should become a guided first-run experience, not just a static info block.

Preferred behavior:

- first screen introduces SkyDexia in plain language
- next screens walk the user through import, AI build, run, save, backup, and ship
- one step specifically explains theme switching in settings
- one step explains that SkyDexia can help create sellable products but still needs clear instructions
- include a beginner-safe example prompt for building a simple app

## Beginner-centered copy standard

All tutorial and settings copy for this work should follow these rules:

- no jargon unless immediately explained
- short sentences
- explain why a feature matters, not just what it is called
- never assume the user knows what runtime, port, env, repo, or deploy means
- make the product feel powerful without making the user feel stupid

## Implementation checklist

Use this as the actual execution plan when the UI work starts.

### Theme system

- create theme tokens for the current default UI
- move existing hardcoded color usage toward CSS variables
- add three named selectable theme definitions
- apply theme tokens across main shell, tutorial, dock, workbench, forms, status cards, and terminal surfaces
- persist selected theme between sessions

### Settings surface

- add a visible settings entry point
- add theme selector control
- add preview text showing current theme name
- wire theme changes live without full reload if possible

### Tutorial refresh

- rewrite tutorial copy from the beginner perspective
- align tutorial steps with the real current feature set
- add a theme-selection tutorial step
- add a simple “idea to shipped product” walkthrough
- make sure tutorial language matches the plain-language capability file

### Validation

- test desktop and mobile layout for each theme
- test readability and contrast in each theme
- test persistence of theme choice on reload
- test tutorial flow after first load and after reopening manually
- test that no theme breaks buttons, overlays, or workbench panels

## Outcome standard

When this directive is complete, a new user should be able to:

- open SkyDexia
- pick the visual identity they want
- understand what the product does in plain language
- follow a tutorial from import to run to save to ship
- feel like SkyDexia is powerful and welcoming instead of technical and confusing

## Non-negotiable rule

This work should improve both identity and usability at the same time.

If the themes look different but the product is still confusing to a beginner, the work is not finished.