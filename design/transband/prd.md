# TRANSBAND — multiTransBender — Product Requirements Document

**Version:** 0.1 · July 2026
**Owner:** Los (Carlos Franzetti)
**Status:** Pre-development. GUI previews v0.1–v0.4 exist as React mockups (see `gui/`).

---

## 1. Product summary

multiTransBender is a multiband transient designer with per-band analog saturation engines, delivered as an audio plugin (VST3, AU, CLAP; AAX later) for macOS and Windows, plus a standalone app for file processing. The saturation engines are original DSP models *inspired by* the character of well-known hardware processors. Panel artwork is original ("inspired-by" skins) — see §9 Legal.

**One-liner:** Split the spectrum into up to 6 bands; give every band its own transient shaping AND its own analog-flavored saturation engine, with three interchangeable views of the same state.

## 2. Target user

Producers, DJs, and mix engineers working in Ableton Live and similar DAWs who want hardware-flavored saturation and per-band transient control without owning racks of hardware. Primary persona: electronic music producer/DJ processing drums, buses, and full mixes.

## 3. Core features

### 3.1 Multiband transient engine
- 1–6 bands. Default 3 bands.
- Interactive spectrum display: click ON the spectrum line to create a band split at that frequency (max 6 bands); click between band nodes (or on a node) to select a band; drag crossover handles to move splits.
- Each band is a **fully independent chain** with its own:
  - ATTACK (±15 dB), SUSTAIN (±24 dB), DETAIL (HF-weighted transient emphasis)
  - Saturation engine selector (any of the 10 device models)
  - DRIVE, CHARACTER (device-specific macro), SAT MIX
  - Band MIX (parallel blend) and OUTPUT trim
  - Solo, bypass, remove
- Spectrum display overlays per-band attack (solid) and sustain (dashed) markers, band tint regions, numbered band nodes on the curve, and a live analyzer.

### 3.2 Saturation device models (10 at launch)
Original DSP engines inspired by (in-product names are original):

| In-product name | Inspired by | Core character |
|---|---|---|
| VULTURE | Thermionic Culture Vulture | Triode/pentode valve distortion |
| PHATSO 7x | Empirical Labs EL7x FATSO | Tape sim, "tranny", warmth |
| HG·II | Black Box Analog Design HG-2 | Parallel pentode + triode saturation |
| REVITALIZER | SPL Stereo Vitalizer Mk3-T | Program EQ + tube stage |
| P·542 | Rupert Neve Designs Portico 542 | Tape emulation, Silk red/blue |
| WIZARD TS·1 | Gainlab Audio GLA-TS1 Wizard | Stereo tube saturation, transformer out |
| BØM | OTO Machines BOUM | Warming, drive, analog LPF, glue |
| SA²RATE | Looptrotter SA2RATE 2 | Even-harmonic saturation |
| CARNABY | Cranborne Audio Carnaby | Harmonic EQ (saturate by band) |
| M·A·S | Overstayer M-A-S / NT-02A | Modular harmonics, density |

Authenticity target: component/topology-level modeling from published circuit topologies, specs, and demo material (no hardware measurement at launch — see TDD §6 for the honest accuracy expectations and the calibration-layer plan).

### 3.3 Three views (same state, different skins)
1. **ENGINE** — uniform interface: large interactive spectrum + selected-band control panel + band chips. Never changes regardless of device selection.
2. **PANEL** — front faceplate of the selected device as a distinct hardware skin (per-device textures, knob styles, VU/LED meters, toggles).
3. **RACK 3D** — front + overhead perspective of the unit (visible top plate: vents, glowing tubes, transformer block) that remains fully operable.

All views manipulate the same parameter state (single source of truth).

### 3.4 Branding, splash & themes
- Product name: **TRANSBAND — multiTransBender**. Version string v0.1b at first beta.
- **Splash / About screen** on first open per session (and via an ABOUT button): TRANSBAND wordmark, "multiTransBender v0.1b BETA" badge, credits (Sergio Dimoff — Ideas & Inspiration; Carlos "Los" Franzetti — Loop Engineer / Part-Time Phantom), dismiss button. Copy lives in one place in code for easy edits.
- **Light / Dark theme toggle** (☀/☾): themes affect app chrome (background, panels, prefs bar, chips, spectrum display). Hardware faceplate skins keep their own device colors in both themes. Theme choice persists with plugin state.

### 3.5 Quality / performance preferences
- Internal precision: 32-bit or 64-bit float (user switchable; 32-bit as the CPU-economy path).
- Oversampling: Off / 2× / 4× / 8× / 16× around nonlinear stages.
- Latency mode:
  - ZERO — minimum-phase IIR (Linkwitz-Riley) crossovers, 0 added latency at any band count.
  - BALANCED — small fixed lookahead for better transient detection.
  - HQ LINEAR — linear-phase FIR crossovers; PDC grows with band count and lowest crossover frequency.
- Latency always reported to host via PDC.

### 3.6 Standalone app
- Open any audio file (wav/aiff/flac/mp3), real-time preview through the audio device with live parameter changes, A/B bypass, and offline render to file (wav/aiff, selectable bit depth/sample rate).
- Batch processing of multiple files with one settings snapshot (v1.1 target).

### 3.7 Formats & platforms
- Plugin: VST3 (macOS + Windows), AU (macOS), CLAP (both). AAX deferred (requires Avid developer program + PACE signing).
- Standalone: macOS (Apple Silicon + Intel universal binary), Windows 10+.
- Primary validation DAW: Ableton Live 12.

## 4. Non-goals (v1)
- No hardware-measured model validation at launch (no unit access).
- No exact reproduction of hardware front panels or use of real brand names/logos.
- No AAX at launch. No Linux at launch. No mid/side per band at launch (v1.1 candidate).

## 5. Success criteria
- Passes pluginval at strictness level 10 on macOS and Windows.
- Null test: with all processing at unity/neutral, output nulls against input to below approximately -100 dBFS (verify exact achievable figure during development).
- Crossover reconstruction: bands summed with no processing are flat within a small tolerance (target ±0.1 dB for IIR mode; verify during development).
- Stable in Ableton Live 12 across sample rates 44.1–192 kHz and buffer sizes 32–2048.
- 6-band, 4× OS, 64-bit runs comfortably on an Apple Silicon laptop (define a concrete CPU budget during profiling; no verified figure exists yet).

## 6. UX requirements
- Resizable GUI, saved per-instance.
- All knobs: vertical drag, shift for fine, double-click to reset, host automation for every parameter.
- Preset system with factory bank organized by source (drums, bus, mix) and by device.
- Undo/redo for band add/remove/move.

## 7. Risks (product-level)
- Scope: 10 device models × 6 bands is a large DSP surface. Mitigation: ship order defined in plan.md; v1 can ship with a subset if needed.
- Trademark/trade-dress risk if names/panels drift toward real products. Mitigation: §9.
- Solo developer bandwidth: plan assumes AI-assisted development via Claude Code.

## 8. GUI reference implementations
**Canonical spec: `gui/transband-v5.jsx`** — all three views, band nodes, click-line-to-add, splash/About screen, light/dark themes.
Earlier iterations kept for reference: `gui/rackforge-v4-all-views.jsx` (pre-branding all-views), `gui/rackforge-v2.jsx` (most polished panel-skin shading), `gui/rackforge-v3-engine.jsx`, `gui/rackforge-preview.jsx`.

## 9. Legal note (not legal advice)
Selling or distributing exact replicas of hardware front panels and real product names risks trademark/trade-dress claims. This PRD specifies original names and original panel artwork throughout. "Inspired by" comparisons stay out of the product UI and marketing unless reviewed. For strictly personal use this constraint can be relaxed, but the codebase defaults to the safe naming. Verify with a lawyer before any commercial release.
