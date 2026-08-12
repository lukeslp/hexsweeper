# Water Wheel menu treatments

The menu is one shared interaction and action inventory with three presentation profiles. Query selection never changes the board, save lane, mine-rescue rules, effects, or settings behavior.

| Profile | URL | Treatment |
| --- | --- | --- |
| Base | `?menu=base` | The production Sphere's centered seven-tile flower. This remains the default. |
| Takeover | `?menu=takeover` | The same action arrangement takes over a real seven-face projected patch while the sphere moves closer. |
| Underwater | `?menu=underwater` | The same arrangement is selected below the waterline and rendered with submerged material styling. |

Legacy study aliases remain available: `?dock=faces` selects Takeover and `?dock=faces-water` selects Underwater.

All profiles use Reset in the center, with Appearance / Warning, Undo / Flag,
and Invert / Size around it in the production Sphere order. There is no bottom
menu dock. A short tap outside the sphere exposes the menu; tapping the scrim,
pressing Escape, or pressing C closes it. The Help tile remains in the lower
corner.

The face variants use a temporary renderer-only zoom. Closing returns to the
player's exact prior zoom before gameplay and an armed fuse resume. Reduced
motion snaps the camera and disables face stagger and caustic drift.
Their projected patch is restricted to seven true six-sided faces; pentagonal
topology cells and any other non-hexagonal fill faces are never used as menu
controls.
While either projected menu is open, dragging the surrounding sphere still
rotates it and the controls remain attached to their chosen faces. A stationary
background tap closes the menu; canvas taps, holds, pinch and wheel gestures do
not dig, flag or change the saved zoom until the menu closes.

First launch uses a three-step illustrated tour — Dig, Menu, Quench — in place
of the former introductory modal. Help replays the tour, and its last step
retains the surface-pack selector.
