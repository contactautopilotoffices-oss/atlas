# EasyUI adaptations

The Andheri interface adapts these open-source patterns to Atlas's native HTML/CSS/JavaScript viewer:

- [Glass Navbar](https://easyui.site/components/glass-navbar): floating co-branded navigation, responsive layout and focus states.
- [Animated Tabs](https://easyui.site/components/animated-tabs): a shared sliding active pill, ported to a measured native indicator. The CAD tabs add keyboard/ARIA semantics.
- [Floating Action Dock](https://easyui.site/components/floating-action-dock): grouped model actions, tactile press/hover feedback and an explicit active view. The phone layout uses a fixed three-column grid with 44px targets.
- [Animated Number](https://easyui.site/components/animated-number), [source](https://github.com/Surajmaurya1/easyui/blob/main/src/components/ui/AnimatedNumber.tsx): one rolling column per digit. Here each column is a three-cycle reel spun with the Web Animations API and settled with a small overshoot, with a picker-wheel edge fade while it moves (`odometer()` and `rollIn()` in `engine/andheri-experience.js`).
- [Button](https://easyui.site/components/button) and its motion tokens: the light primary button on a near-black surface, 14px radius controls, the `easeSoft` curve (0.22, 1, 0.36, 1).
- [Sheet](https://easyui.site/components/sheet): the explorer's property card becomes a bottom sheet on phones.

Upstream: [Surajmaurya1/easyui](https://github.com/Surajmaurya1/easyui), MIT, © 2026 Suraj Maurya. The required licence is retained in `LICENSE`. The implementation is in `engine/andheri-ui.js` / `.css` and `engine/andheri-experience.js` / `.css`; no React runtime or wholesale app conversion is required.

The opening is a full-bleed render with the co-brand lockup, one primary action and a sound control; it plays the Andheri film, then shows the three properties as cards with real figures. Reduced motion, keyboard use (Escape skips the film, arrow keys move between cards) and sound preferences are respected.
