# EasyUI adaptations

The Andheri interface adapts these open-source patterns to Atlas's native HTML/CSS/JavaScript viewer:

- [Glass Navbar](https://easyui.site/components/glass-navbar): floating co-branded navigation, responsive layout and focus states.
- [Animated Tabs](https://easyui.site/components/animated-tabs): a shared sliding active pill, ported to a measured native indicator. The CAD tabs add keyboard/ARIA semantics.
- [Floating Action Dock](https://easyui.site/components/floating-action-dock): grouped model actions, tactile press/hover feedback and an explicit active view. The phone layout uses a fixed three-column grid with 44px targets.

Upstream: [Surajmaurya1/easyui](https://github.com/Surajmaurya1/easyui), MIT, © 2026 Suraj Maurya. The required licence is retained in `LICENSE`. The implementation is in `engine/andheri-ui.js` / `.css`; no React runtime or wholesale app conversion is required.

The architectural opening is a custom SVG/CSS illustration with real property/metro data, real asset readiness, reduced-motion support, keyboard-safe entry, and optional sound. It is not a measured building diagram or an invented loading percentage.
