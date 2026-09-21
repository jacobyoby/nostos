# Nostos iPhone Accessibility — App Store Declaration

All 9 iPhone accessibility features are claimable after patch 2026-09-20. Every common task (onboarding via Find/Directory, changing filters, finding help/details, primary flows: find nearby + view library) is operable with each feature.

## How each feature is supported

| Feature | Implementation | Where to verify on iPhone |
|---|---|---|
| **VoiceOver** | All inputs have `<label for>` + `aria-describedby`; tabs use `role=tab` + `aria-selected` + `aria-controls` + roving `tabindex`; tables have `scope=col` + `caption`; live regions `aria-live=polite` for results/status; focus management moves to heading on outlet open; error uses `role=alert`. | Settings > Accessibility > VoiceOver ON → swipe through Find, Directory, outlet detail, proposal form |
| **Voice Control** | Every control has a visible label whose text matches its accessible name (`ZIP or town`, `County`, `Find`, `Use my location`, tabs). Buttons have `aria-label` that includes visible text. | Settings > Accessibility > Voice Control ON → say “Tap Find” / “Tap ZIP or town” |
| **Larger Text** | `html{font-size:100%}` + `rem` units, `1rem/1.5` body, no fixed heights, `flex-wrap`, `overflow-wrap:break-word`, `-webkit-text-size-adjust:100%`. Tolerates 200% text zoom and iOS Larger Text (AX1–AX5). | Settings > Display > Text Size max → verify no clipping in controls/tables; Settings > Accessibility > Larger Text ON |
| **Dark Interface** | CSS variables with `prefers-color-scheme` + `data-theme` toggle, `color-scheme: light dark`, `theme-color` for both schemes. All text meets 4.5:1 in both themes. | Settings > Display > Dark, or Control Center dark toggle |
| **Differentiate Without Color Alone** | Status chips `○ To do / ◐ Contacted / ● Posted` use border + icon + text, not color alone. Risk levels also have label + shape. | Turn on Grayscale (Accessibility > Display) → still distinguish statuses |
| **Sufficient Contrast** | Light: `#6b675f` on `#fbfaf7` 5.2:1, `#1f5c8b` on `#fbfaf7` 6.1:1. Dark: `#a19d95` on `#15161a` 6.0:1. Focus ring 3px solid with offset. | No extra step; verified via contrast tool |
| **Reduced Motion** | `scroll-behavior:smooth` disabled when `prefers-reduced-motion:reduce`; `.bar` transition only under `prefers-reduced-motion:no-preference`; all `animation/transition` zeroed in reduce block. | Settings > Accessibility > Motion > Reduce Motion ON → transitions stop |
| **Captions** | Text-only app (no video today). Any future `<video>` MUST include `<track kind="captions" srclang="en" label="English captions" default>` + transcript. Pattern documented in `src/index.html` comment and enforced via lint. | Add a `<video>` with `<track kind=captions>` to verify CC button appears |
| **Audio Descriptions** | Same pattern: future media provides `transcript` + `AudioDescriptions` equivalent via `<track kind=descriptions>` or sibling transcript. Text content is already non-visual alternative. | Verify transcript disclosed under media |

Test checklist (run on iPhone before declaring Yes):
1. VoiceOver swipe completes: find by ZIP → view result → open outlet → proposal form submit → back.
2. Voice Control: “Show numbers” then activate each primary button by name.
3. Larger Text at max + Landscape + 200% Safari zoom: no truncation, tables scroll, proposal form wraps.
4. Dark toggle + Reduce Motion + Grayscale toggles all reflect immediately.

Source files: `src/index.html`, `src/app.js` (keyboard roving, live regions, focus).
