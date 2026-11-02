# WORLD//PATCH landing refinement

Open [landing-final.html](landing-final.html) beside [landing-final.css](landing-final.css). The HTML contains its standalone foundation, authored SVG geometry, and a small illustrative script. No installation or server is needed to view the design.

## Apply to the existing React landing

1. Copy only landing-final.css into src/client and import it immediately after the existing landing.css import. It is a scoped enhancement, not a replacement for landing.css or global styles.
2. In Landing.tsx, move the complete existing .lp-law-choices block and .lp-sandbox-verdict block together, immediately after .lp-sandbox-heading. Keep their current handlers, disabled conditions, verdict class interpolation, and role="status". The resulting sibling order is:

   ~~~text
   .lp-sandbox-top
   .lp-sandbox-heading
   .lp-law-choices
   .lp-sandbox-verdict
   .lp-chamber-window
   .lp-sandbox-laws
   .lp-witness-row
   .lp-sandbox-disclosure
   existing accessible live-region text
   ~~~

3. Keep the complete .lp-chamber-window subtree, including Suspense and Board, intact. Do not transplant the illustrated SVG, hard-coded maps, frame counter, or script.
4. In .lp-hero-actions, use the existing secondary .lp-text-action for a visible sandbox jump:

   ~~~jsx
   <a className="lp-text-action" href="#sandbox">
     Try a patch <span aria-hidden="true">↓</span>
   </a>
   ~~~

   Keep id="sandbox", tabIndex={-1}, the skip link, and header navigation to the mechanism section. Keep the exact marketing headline.
5. Keep product links as /play and /overlay in React. This standalone HTML links directly to http://localhost:3119/play and http://localhost:3119/overlay, as requested. Those destinations require the local product to be running; no proxy, route replacement, or navigation interception is included.

## What the stylesheet changes

The hero stays top-aligned; a 64–72px header, restrained headline size, and smaller top spacing prioritize the main CTA. Controls and their verdict precede the board in both DOM and visual order. The board wrapper is at most 400px wide, or 320px on desktop viewports at most 800px tall; its intrinsic ratio and Phaser sizing logic remain intact.

Commands and key utility labels are approximately 12px; result copy and witness buttons are 14px. Proof and source disclosure remain visible in normal document flow. At narrow widths the page stacks, controls retain at least 44px height, and command text wraps. Full witness information may continue below the first viewport. No overflow masking is used to meet the width target.

The palette, system fonts, restrained corners, and orbital geometry follow the supplied visual system. Compact utility sizes are intentional; they are not a claim of universal 16px body sizing.

## State and motion boundaries

Keep freshSandbox, tryLaw, stepWitness, solve, replayWitness, transition, and all Board props unchanged. Preserve rejection without mutation and derive witness counts from sandbox.witness.length. The brief describes a real 24-move accepted checkpoint; this design neither reproduces nor verifies it, and that number must not become a hard-coded UI claim.

The illustrative page starts with gravity off and wall A open. Closing A changes its drawn tile, leaves the amber player fixed, and enables manual steps of an authored cyan route. Gravity down shows illustrative rejection without changing the displayed laws. Reset clears the example. Every example remains labeled DESIGN PREVIEW; no solver, engine, Twitch, chat, votes, or receipt service runs here.

Hover feedback uses 120ms, state feedback 220ms, and the optional accepted seam 650ms with cubic-bezier(.2,0,0,1). Only transform and opacity animate. Reduced motion removes travel. There is no autoplay or continuous loop. The optional .lp-state-cue and .lp-law-merge hooks are presentation hooks: use an existing authoritative state-change signal if adopting them. Do not introduce a second receipt timer or restart cues on unrelated renders. The game's receipt lifecycle remains untouched.

## Retain the real product story

Preserve the proposal → checked escape → audience vote → streamer attempt/reveal sequence, actual CHAMBERS data, four native rule disclosures, and real portal pairings. The three miniatures in this file are explicitly illustrative studies, not substitutes for the game's maps. Keep the real sandbox's truthful engine disclosure in React; do not copy the preview-only disclaimer into a functioning engine. Continue to state that live Twitch needs account/app setup and authorization.

## Verification and limits

This handoff calls for local file/reference and anchor checks only. Browser rendering, target-viewport fit, keyboard journeys, Phaser resizing, engine outcomes, the local product links, and live Twitch were not exercised here. Parent integration should check 1440×900, 1280×720, and 390×844; visible CTA/law controls/verdict; no horizontal overflow; focus; reduced motion; accepted/rejected/reset; and real witness stepping.

Earlier chamber and landing files are preserved. No original game source is edited.
