# FAMILYOS — DESIGN SYSTEM SPECIFICATION
**Version**: 1.0.0 (Stage 0 Baseline)  
**Philosophy**: Warmth, Trust, Calmness, and Elevated Craftsmanship  
**Target**: Material 3 Compose Custom Theme & Responsive Layout Tokens  

---

## 1. Brand Direction & Palette

The visual identity of FamilyOS rejects sterile corporate administration dashboards and cold neon tech themes in favor of an organic, welcoming, and deeply trustworthy environment.

### 1.1 Color Palette Tokens

| Token Name | Hex Code | Compose Color | Purpose & Semantic Role |
|---|---|---|---|
| `PrimaryForestGreen` | `#173D35` | `Color(0xFF173D35)` | Primary brand color, key action buttons, prominent app bars, active tabs |
| `WarmIvory` | `#F7F4EC` | `Color(0xFFF7F4EC)` | Global background surface, card background, warm non-glare foundation |
| `SageGreen` | `#A8BDAA` | `Color(0xFFA8BDAA)` | Secondary container, soft chips, status badges, balanced accent |
| `SecondarySage` | `#6B8A6E` | `Color(0xFF6B8A6E)` | Supporting outline, secondary icons, subtle progress bar tracks |
| `SoftGold` | `#C39A60` | `Color(0xFFC39A60)` | Elevated achievements, financial milestones, reward badges, highlight borders |
| `LightGold` | `#E7D1AA` | `Color(0xFFE7D1AA)` | Subtle gold container, premium banner background, warm highlight fills |
| `SurfaceCard` | `#FFFFFF` | `Color(0xFFFFFFFF)` | Primary elevated card surface with subtle ivory tint |
| `TextPrimary` | `#11231E` | `Color(0xFF11231E)` | Deep green-charcoal for high-contrast, effortless legibility (14:1 contrast) |
| `TextSecondary` | `#4F635D` | `Color(0xFF4F635D)` | Muted botanical tone for timestamps, metadata, and helper text (5.8:1 contrast) |
| `SemanticSuccess` | `#2D6A4F` | `Color(0xFF2D6A4F)` | Task completed, budget surplus, verified sync |
| `SemanticAlert` | `#BC4749` | `Color(0xFFBC4749)` | Over-budget warnings, expiring foods, sync errors |

---

## 2. Typography Scale

Pairing an editorial serif header font (conveying family legacy, warmth, and enduring quality) with a crisp, geometric sans-serif for numerical data and task clarity.

- **Display & Headlines**: `Playfair Display` or `Eczar` / `Georgia` Serif
  - `DisplayLarge`: 57sp / LineHeight 64sp / Weight: SemiBold
  - `HeadlineMedium`: 28sp / LineHeight 36sp / Weight: Medium
  - `HeadlineSmall`: 24sp / LineHeight 32sp / Weight: Medium
- **Title & Section Labels**: `Inter` / Clean Sans
  - `TitleLarge`: 22sp / LineHeight 28sp / Weight: SemiBold
  - `TitleMedium`: 16sp / LineHeight 24sp / Weight: Medium (LetterSpacing +0.15sp)
- **Body & Forms**: `Inter` / Clean Sans
  - `BodyLarge`: 16sp / LineHeight 24sp / Weight: Normal
  - `BodyMedium`: 14sp / LineHeight 20sp / Weight: Normal
- **Financial & Data Labels**: Tabular Figures enabled
  - `LabelLarge`: 14sp / LineHeight 20sp / Weight: SemiBold (Strictly Tabular for Numbers)

---

## 3. Spacing, Geometry & Component Metrics

### 3.1 8dp Spacing Hierarchy
- `space_xxs`: 4dp (Fine element grouping)
- `space_xs`: 8dp (Standard micro-gap between text and icon)
- `space_sm`: 12dp (Internal chip padding)
- `space_md`: 16dp (Standard card internal padding & grid spacing)
- `space_lg`: 20dp (Generous card padding for dashboard hero blocks)
- `space_xl`: 24dp (Screen margin padding on mobile)
- `space_xxl`: 32dp (Section separation)
- `space_xxxl`: 48dp (Major content break & touch-target anchor)

### 3.2 Card & Surface Shape Tokens
- `CardCornerRadius`: `20dp` (Smooth Squircle / Continuous Curve)
- `ButtonCornerRadius`: `12dp` (Refined rectangular-rounded; zero generic pills)
- `DialogCornerRadius`: `24dp`
- `ElevationSubtle`: `2dp` ambient shadow with warm tint (`rgba(23, 61, 53, 0.06)`)

### 3.3 Touch Target & Accessibility Compliance
- **Interactive Targets**: Minimum `48dp x 48dp` bounding box on all buttons, checkboxes, and icons.
- **Accessible Contrast**: All text pairings exceed WCAG AA (4.5:1 for standard text, 3:1 for large display titles).

---

## 4. Adaptive Responsive Layout Strategy

| Window Size Class | Breakpoint Width | Navigation Mode | Content Layout |
|---|---|---|---|
| **Compact** (Phone Portrait) | `< 600dp` | Bottom Navigation Bar (5 core tabs) | Single column scroll, full-width cards with 16dp margins |
| **Medium** (Foldables, Tablet Portrait) | `600dp - 839dp` | NavigationRail (Left column, 72dp) | 2-column balanced grid, master-detail side sheets |
| **Expanded** (Tablet Landscape, Desktop) | `>= 840dp` | Collapsible Permanent Navigation Drawer | 3-column dashboard (Left nav, center feed, right calendar/inspector) |
