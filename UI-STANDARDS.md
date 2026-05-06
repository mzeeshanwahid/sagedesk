# sagedesk, UI Standards Document

## Design Philosophy

The sagedesk widget supports three distinct themes — Classic, Light, and Dark — each with a coherent visual language. Rather than a single flat aesthetic, each theme expresses a specific personality: Classic is polished and assertive with gradient surfaces; Light is editorial and content-led with a warm white base; Dark is immersive with glassmorphism and ambient accent glows.

The widget has two states: collapsed (the floating trigger button) and expanded (the full chat panel). Both states are per-theme and differ meaningfully across themes.

The default accent color is `#534AB7`. Every accent-dependent color is derived from a single `accentColor` config value at render time using `color-mix(in oklab, ...)`.

---

## Themes

Three themes are available via `agent.theme`:

- `classic` — gradient header and trigger, distinguished speech-bubble layout.
- `light` — editorial layout, pill trigger with label, text-style bot messages.
- `dark` — glassmorphism panel, ambient glow, gradient user bubbles, full-width prompt chips.

---

## Widget Anatomy

Both the trigger and panel are rendered at `z-index: 9999`. The vanilla adapter mounts them inside a Shadow DOM; the React and Next adapters render into `document.body` via a portal.

---

## Trigger Button

### Classic
- Shape: circle, 56px by 56px.
- Background: gradient — `linear-gradient(135deg, accentColor 0%, color-mix(in oklab, accent 78%, #1a1340) 100%)`.
- Icon: chat bubble SVG, white, 22px.
- Box shadow: layered accent-tinted shadow.
- On hover: `transform: scale(1.06)`, transition 150ms ease.
- Position: fixed, bottom 28px, right 24px (or left 24px when `position: bottom-left`).

### Light
- Shape: pill, height 52px, border-radius `999px`.
- Background: `#fdfcf9` (warm off-white), border `rgba(20,20,40,0.08)`.
- Contents: text label group on the left ("Chat with us" at 14px weight 600, "We typically reply in 1m" at 11px muted) + accent-colored circle with chat icon on the right.
- No scale transform on hover — box shadow deepens instead.
- Position: fixed, bottom 28px, right 28px.

### Dark
- Shape: circle, 60px by 60px.
- Background: `linear-gradient(135deg, color-mix(in oklab, accent 70%, #1a1340), #1a1a2e)`.
- Border: `1px solid rgba(255,255,255,0.12)`.
- Icon: bot SVG, white, 22px.
- Ambient glow div (`sd-trigger-glow`): a 80px circle placed behind the trigger using a radial gradient at blur 10px, `z-index: 9998`.
- On hover: `transform: scale(1.04)`.
- Position: fixed, bottom 28px, right 24px.

---

## Panel

### Dimensions

| Theme   | Width  | Height  | Border radius |
|---------|--------|---------|---------------|
| Classic | 380px  | 580px   | 20px          |
| Light   | 400px  | 580px   | 22px          |
| Dark    | 380px  | 580px   | 22px          |

Panel is positioned above the trigger: `bottom: 96px` (Classic), `bottom: 92px` (Light), `bottom: 100px` (Dark).

### Panel Open/Close Animation

All themes share the same keyframes:
- **Opening:** `scale(0.94) translateY(6px)` → `scale(1) translateY(0)`, opacity 0 → 1, 200ms `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring-like overshoot).
- **Closing:** reverse, 150ms `ease-in`.
- Transform origin: bottom right (or bottom left when position is `bottom-left`).

The vanilla adapter controls animation via `data-open` and `data-closing` attributes. The React adapter applies `sd-r-opening` / `sd-r-closing` CSS classes.

### Panel Background

- Classic: `#ffffff`, box shadow with accent-tinted layers.
- Light: `#fdfcf9`, box shadow with neutral purple-tinted layers.
- Dark: `rgba(18, 16, 32, 0.86)` with `backdrop-filter: blur(40px) saturate(180%)` (glassmorphism). An ambient top-glow overlay (`sd-panel-glow`) sits at `z-index: 0` inside the panel — a radial gradient using the accent color.

---

## Section 1, Header

### Classic
- Padding: 18px 20px.
- Background: same gradient as trigger button.
- Avatar: 40px circle, `rgba(255,255,255,0.18)` background.
- Online dot: 12px, `#22c55e`, outline ring matches accent.
- Agent name: 15px, weight 600, white.
- Status: 12px, `rgba(255,255,255,0.85)`, green dot `#4ade80` with glow ring. Text: "Typically replies in under a minute".
- Close button: 30px by 30px, border-radius 8px, `rgba(255,255,255,0.14)` background.

### Light
- Padding: 18px 20px 14px.
- Background: `#fdfcf9` (matches panel — no accent color in header).
- Border bottom: `1px solid rgba(20,20,40,0.05)`.
- Avatar: 36px circle, gradient `accent → color-mix(accent 55%, #fff)`.
- No online dot on avatar.
- Agent name: 14.5px, weight 600, `#1a1a2e`.
- Status: 12px, `#7a7a82`, green dot `#22c55e`. Text: "Online · replies in under a minute".
- Close button: 30px by 30px, transparent background, `#9b9aa3` icon.

### Dark
- Padding: 20px 20px 16px.
- Background: transparent (inherits panel's dark glassmorphism surface), `z-index: 1`.
- Avatar: 38px circle, gradient with accent glow shadow.
- Online dot: 12px, `#22c55e`, outline matches panel background `rgba(18,16,32,1)`.
- Agent name: 15px, weight 600, white.
- Status: 12px, `rgba(255,255,255,0.55)`, 5px green dot with `box-shadow: 0 0 6px #4ade80`. Text: "Trained on this site · always on".
- Close button: 30px by 30px, `rgba(255,255,255,0.06)` background, `1px solid rgba(255,255,255,0.08)` border.

---

## Section 2, Message Thread

All themes share the same structural behavior:
- `flex: 1`, `overflow-y: auto`, `overscroll-behavior: contain`.
- Thin scrollbar (4px webkit, thin Firefox).
- Auto-scrolls to bottom on new messages or typing indicator appearance.
- `role="log"`, `aria-live="polite"`, `aria-label="Chat messages"`.

Thread-specific padding and gap:

| Theme   | Padding           | Gap   | Background |
|---------|-------------------|-------|------------|
| Classic | 22px 18px 18px    | 18px  | `#fbfbfa`  |
| Light   | 22px 20px 16px    | 22px  | transparent (panel bg) |
| Dark    | 8px 20px 16px     | 14px  | transparent (panel bg) |

### Message Bubbles — Classic

Bot messages:
- Background: `#fff`, border `1px solid rgba(20,20,40,0.06)`, box shadow.
- Border radius: `16px 16px 16px 6px` (speech tail bottom-left).
- Max width: 82%, padding 10px 14px, font-size 14px, line-height 1.5, color `#1a1a2e`.

User messages:
- Background: accent color, color `#fff`.
- Border radius: `16px 16px 6px 16px` (speech tail bottom-right).
- Box shadow: accent-tinted.

Timestamps: 11px, `#a8a8b0`, below bubble, `margin-top: 4px`.

### Message Bubbles — Light

Bot messages use a side-by-side layout (not bubble): a 28px gradient avatar circle on the left, then a column with the agent name (13px, weight 600, `#1a1a2e`) + timestamp baseline-aligned, then the message text below (14px, line-height 1.55, color `#2a2a36`). No bubble background or border.

User messages:
- Background: `color-mix(in oklab, accent 10%, white)` (pale accent tint).
- Color: accent itself.
- Border: `1px solid color-mix(in oklab, accent 22%, transparent)`.
- Border radius: `16px 16px 4px 16px`, max width 78%, weight 500.

### Message Bubbles — Dark

Both roles use the same bubble component, differentiated by `alignSelf`:
- Bot: `rgba(255,255,255,0.05)` background, `rgba(255,255,255,0.06)` border, `border-radius: 14px 14px 14px 6px`, color `rgba(255,255,255,0.92)`, align flex-start.
- User: gradient `linear-gradient(135deg, accent, color-mix(in oklab, accent 75%, #1a1340))`, white text, `border-radius: 14px 14px 6px 14px`, accent-tinted box shadow, align flex-end.
- Max width: 85%, padding 12px 14px, font-size 14px.

Timestamps: 11px, `rgba(255,255,255,0.3)`.

### Fallback Label

All themes show a label above the fallback answer text:
- Text: "Not sure about that one".
- Classic/Light: 11px, weight 500, muted color, `margin-bottom: 4px`.
- Dark: 11px, `rgba(255,255,255,0.5)`, `display: block`, `margin-bottom: 4px`.

### Typing Indicator

Three animated dots, each 6px circle, staggered 0.2s bounce animation (`sd-bounce` keyframe — 5px vertical, 1.2s loop).

- Classic: bubble wrapper with `#fff` background and border, same shape as bot bubble.
- Light: side-by-side layout with a 28px gradient avatar circle + dots in a separate bubble `#fff` background.
- Dark: styled exactly like a bot bubble — `rgba(255,255,255,0.05)` glass surface, dots `rgba(255,255,255,0.4)`.

---

## Section 3, Suggested Question Chips

Chips are filtered to exclude questions the user has already asked. After the user sends a first message (`hasSentMessage`), the chip container switches to a horizontal scrolling row (scrollable, `flex-wrap: nowrap`, hidden scrollbar).

### Classic
- Container background: `#fbfbfa` (matches thread). Padding: 0 18px 16px.
- Label above chips: "Suggested", 11px, uppercase, `#9b9aa3`, spaced.
- Chip style: pill shape (`border-radius: 999px`), 12.5px, weight 500, accent-colored text, `background: #fff`, accent-tinted border. On hover: opacity 0.8.
- Layout: `flex-wrap: wrap`, gap 6px. After first message: scrollable row, padding shifts to 0 0 16px with inner padding 0 18px.

### Light
- No label. Padding: 0 20px 14px.
- Chip style: `border-radius: 6px` (rectangular, not pill), 12px, weight 500, `#5a5a64` text, `#f4f3ee` background, no border. On hover: opacity 0.75.
- Layout: `flex-wrap: wrap`, gap 6px. After first message: scrollable row.

### Dark
- Label: "Try asking", 11px, uppercase, `rgba(255,255,255,0.4)`, only shown before first message.
- Chip style: full-width (`width: 100%`), `border-radius: 10px`, 13px, `rgba(255,255,255,0.85)` text, `rgba(255,255,255,0.04)` background, faint border. Includes a chevron icon on the left. On hover: background `rgba(255,255,255,0.07)`.
- Layout: `flex-direction: column` before first message, then scrollable horizontal row.

---

## Section 4, Composer (Input Row)

All themes use a focus ring effect on the input wrapper when focused.

### Classic
- Outer composer: `padding: 14px 14px 16px`, background `#fff`, border-top `1px solid rgba(20,20,40,0.06)`.
- Input wrapper: `background: #f5f4f0`, `border-radius: 12px`, `padding: 5px 6px 5px 14px`. On focus-within: accent border + accent-tinted glow.
- Input: 14px, transparent background, placeholder `#a8a8b0`. `aria-label="Type your question"`. Placeholder text: "Write a message…"
- Send button: 32px by 32px, `border-radius: 8px`. Inactive: `color-mix(in oklab, accent 22%, #e5e3dc)`. Active (has text): accent background, white icon.

### Light
- Outer composer: `padding: 14px`, background `#fdfcf9`, border-top `1px solid rgba(20,20,40,0.05)`.
- Input wrapper: `background: #fff`, `border-radius: 14px`, `padding: 10px 12px`. On focus-within: accent border + glow.
- Input: `width: 100%`, block display. Placeholder text: "Write a message…"
- Send button: 28px by 28px, `border-radius: 7px`. Inactive: `#e8e7e0` background, `#a8a89e` icon. Active: accent background, white icon.
- Actions row below input: `margin-top: 8px`, send button floated right with `margin-left: auto`.

### Dark
- Outer composer: `padding: 14px`, border-top `1px solid rgba(255,255,255,0.06)`, `z-index: 1`.
- Input wrapper: `background: rgba(255,255,255,0.05)`, `border-radius: 12px`, `padding: 4px 4px 4px 14px`. On focus-within: accent-tinted border only (no outer glow).
- Input: 14px, white text, placeholder `rgba(255,255,255,0.35)`. Placeholder text: "Write a message…"
- Send button: 32px by 32px, `border-radius: 9px`. Inactive: `rgba(255,255,255,0.08)` background. Active: gradient `linear-gradient(135deg, accent, color-mix(accent 60%, #fff))` + accent glow box-shadow.

All themes: send button has `aria-label="Send message"`. Input submits on Enter (without Shift).

---

## Section 5, Powered By Footer

- Height: 34px (all themes).
- Text: "Powered by sagedesk" with a link to the GitHub repo.
- Classic / Light: `#a8a8b0` text, `#5a5a64` link, `#fff` / `#fdfcf9` background, border-top `1px solid rgba(20,20,40,0.04)`.
- Dark: `rgba(255,255,255,0.35)` text, `rgba(255,255,255,0.7)` link, no separate background (inherits panel).
- Hidden via `[hidden]` attribute or `poweredBy: false` in config.

---

## Color System

All accent-dependent surfaces derive from the single `accentColor` config value at render time. No CSS variable indirection — values are inlined into styles.

Accent-derived surfaces:
- Classic trigger, header, user bubble: gradient using accent.
- Light trigger circle, avatar, user bubble tint: accent.
- Dark trigger, avatar, user bubble, send button active: gradient using accent.
- All themes: send button active state, chip accent styling, focus rings.

Theme-specific neutral surfaces are hardcoded per theme:

| Surface                  | Classic     | Light       | Dark                           |
|--------------------------|-------------|-------------|--------------------------------|
| Panel background         | `#ffffff`   | `#fdfcf9`   | `rgba(18,16,32,0.86)` + blur   |
| Thread background        | `#fbfbfa`   | transparent | transparent                    |
| Bot bubble background    | `#ffffff`   | none        | `rgba(255,255,255,0.05)`       |
| Input wrapper background | `#f5f4f0`   | `#ffffff`   | `rgba(255,255,255,0.05)`       |
| Primary text             | `#1a1a2e`   | `#1a1a2e`   | `#fff`                         |

---

## Typography

Font family: `inherit` on all elements — the widget matches the host page font.

| Location                   | Size    | Weight |
|----------------------------|---------|--------|
| Agent name (Classic, Dark) | 15px    | 600    |
| Agent name (Light)         | 14.5px  | 600    |
| Status line                | 12px    | 400    |
| Message text               | 14px    | 400    |
| Light bot name (in thread) | 13px    | 600    |
| Fallback label             | 11px    | 500    |
| Timestamp                  | 11px    | 400    |
| Classic/Dark chip          | 12.5–13px | 500  |
| Light chip                 | 12px    | 500    |
| Chip label ("Suggested")   | 11px    | 500    |
| Input placeholder and text | 14px    | 400    |
| Powered by footer          | 11px    | 400    |

No font below 11px is used anywhere in the widget.

---

## Responsive Behaviour

Desktop, viewport wider than 420px:
- Panel is its theme-defined width (380px Classic/Dark, 400px Light).
- Panel is anchored to the same corner as the trigger.
- Maximum panel height is 580px with internal scroll on the thread.

Mobile, viewport 420px or narrower (`@media (max-width: 420px)`):
- Panel expands to full viewport width: `right: 0; left: 0; width: auto`.
- Panel height becomes `auto; max-height: 85vh`.
- Bottom corners lose border-radius (Classic: `20px 20px 0 0`, Light/Dark: `22px 22px 0 0`).
- Transform origin shifts to `bottom center`.
- Trigger button stays at its configured corner.

---

## Accessibility

- Trigger: `aria-label="Open support chat"`, `aria-expanded` toggled on open/close.
- Panel: `role="dialog"`, `aria-label` set to agent name.
- Thread: `role="log"`, `aria-live="polite"`, `aria-label="Chat messages"`.
- Input: `aria-label="Type your question"`.
- Send button: `aria-label="Send message"`.
- Close button: `aria-label="Close chat"`.
- Escape key closes the panel.
- Focus is trapped inside the panel when open (Tab and Shift+Tab wrap within focusable elements).
- Focus returns to the trigger button on close.
- All interactive elements are keyboard reachable in visual order.

---

## Style Isolation

The vanilla adapter uses Shadow DOM (`mode: 'open'`). All CSS is injected as a `<style>` tag inside the shadow root. Host page CSS cannot leak in; widget CSS cannot leak out.

The React and Next adapters inject a `<style>` tag into `document.head` at mount time (once per theme, guarded by ID check). Class names use the `sd-r-` prefix for runtime-variant rules and `sd-r-panel`, `sd-r-trigger` etc. for component roots. Inline styles handle all accent-color-dependent and layout properties. No CSS Modules are used.

Both adapters use `font-family: inherit` so widget text still matches the host page font despite style isolation.

---

## What the Widget Must Never Do

- Never inject global CSS that could affect the host page (vanilla uses Shadow DOM; React scopes to `sd-r-` prefixed classes with inline overrides).
- Never use z-index above 9999.
- Never show a loading spinner that lasts more than 3 seconds without fallback feedback.
- Never display a raw error object or stack trace to the visitor.
- Never use font sizes below 11px.
- Never show "I do not know" or similar blunt failure language — use the configured `fallback` message or pool.
- Never call an external LLM API at runtime — all retrieval is local.
