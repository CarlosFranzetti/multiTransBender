# TRANSBAND — multiTransBender — Technical Design Document

**Version:** 0.1 · July 2026
**Honesty note:** DSP figures marked *(target)* or *(illustrative)* are design goals, not measured results. Anything uncertain is flagged inline.

---

## 1. Stack

- **Language:** C++20
- **Framework:** JUCE 8 (GPL or paid license — decide before commercial release; GPL requires open-sourcing)
- **Build:** CMake + Ninja. CI later via GitHub Actions (macOS + Windows runners).
- **Formats:** VST3, AU, CLAP (via clap-juce-extensions), Standalone. AAX deferred.
- **Targets:** macOS 11+ universal (arm64 + x86_64), Windows 10+ x64.
- **Validation:** pluginval, auval (macOS), custom unit tests (Catch2 or JUCE UnitTest).

## 2. High-level architecture

```
multiTransBenderProcessor (juce::AudioProcessor)
├── ParameterState        APVTS; single source of truth for all views
├── DspGraph
│   ├── InputStage        gain, precision dispatch (float/double)
│   ├── CrossoverBank     1–6 bands; IIR LR4 or linear-phase FIR
│   ├── BandChain × N     per band:
│   │   ├── TransientShaper   (attack / sustain / detail)
│   │   ├── SaturationEngine  (polymorphic; 10 device models)
│   │   │   └── Oversampler   (wraps only the nonlinear core)
│   │   └── BandMixOut        (parallel blend + trim)
│   └── SumStage          band sum, master mix/output, metering taps
├── LatencyManager        computes + reports PDC per mode/band count
└── Editor (juce::AudioProcessorEditor)
    ├── ViewHost          ENGINE | PANEL | RACK3D (one state, three skins)
    ├── SkinRenderer      data-driven: skins defined as JSON
    └── SpectrumComponent analyzer + band editing interactions
```

### 2.1 Precision strategy
- Entire DSP graph templated on `Sample` (float/double): `template <typename Sample> class BandChain { ... }`.
- User pref selects instantiation at prepare-time. 32-bit path is the CPU-economy mode; 64-bit is default.
- Honest note: on modern CPUs the real-world CPU saving of float vs double is workload-dependent (memory bandwidth, SIMD width). We expose the option as requested, and profile to report actual savings — do not promise a specific % up front.

### 2.2 Threading
- Audio thread: lock-free. Parameters via atomics/APVTS. No allocation after `prepareToPlay`.
- Band add/remove/reorder: crossfaded graph swap — build new graph on message thread, atomically swap pointer, crossfade ~30 ms to avoid clicks.
- GUI analyzer: audio thread pushes into a lock-free FIFO; GUI thread FFTs and draws at ~30 fps.

## 3. Crossover design

| Mode | Filter | Added latency | Notes |
|---|---|---|---|
| ZERO | Linkwitz-Riley 4th order (cascaded Butterworth biquads), tree-structured with allpass compensation | 0 samples | Bands sum flat in magnitude *(target ±0.1 dB — verify)*; phase rotation at crossovers is inherent to IIR |
| BALANCED | Same LR4 bank + fixed transient-detector lookahead (~64 samples *(illustrative — tune by ear)*) | small fixed | Better attack detection, tiny PDC |
| HQ LINEAR | Linear-phase FIR bank (windowed-sinc or frequency-sampling design) | (FIR length − 1)/2 | FIR length scales with lowest crossover freq for adequate LF resolution; PDC therefore grows with band count/placement. Exact lengths chosen during development. |

Tree structure for N bands: split lowest crossover first, then recursively split the high branch; apply matching allpasses to already-split branches so all paths share identical phase response before summation.

## 4. Transient engine (per band)

Differential envelope follower design (the classic SPL-style approach, plus a detail path):
- Two envelope followers per band: FAST (attack ~0.1–1 ms, release ~20–50 ms) and SLOW (attack ~10–30 ms). Attack gain = f(fast − slow), applied via a smooth gain curve; range ±15 dB.
- Sustain: compare instantaneous envelope to a long-release follower; boost/cut the tail; range ±24 dB.
- DETAIL: parallel HF-weighted (shelved) transient path blended in — adds click/snap definition without broadband attack boost.
- All time constants program-adaptive (scaled by band center frequency — LF bands need slower detectors).
- Gain application smoothed (~1 ms one-pole) to avoid zipper noise; detector runs at base rate (no OS needed — it's level detection, not waveshaping).

## 5. Saturation engines

### 5.1 Common infrastructure
- `SaturationEngine` interface: `prepare / reset / processBlock / setDrive / setCharacter`.
- Each engine wraps its nonlinear core in `juce::dsp::Oversampling` (polyphase IIR halfband for low modes; FIR equiripple for 8×/16× where linearity matters). OS applies **only around the nonlinearity** — filters/EQ stay at base rate where valid.
- DC blockers after asymmetric stages. Parameter smoothing on drive/bias.

### 5.2 Modeling approach (per honest constraint: no hardware access)
Tier-1 techniques used:
- **Tube stages (VULTURE, HG·II, WIZARD, REVITALIZER tube path):** Koren-style triode/pentode plate-current equations in a simplified stage model (grid conduction, bias shift under drive for "sag"/duty-cycle asymmetry). Where full circuit solving is too costly, use precomputed 2-D waveshaping tables (input × bias) derived from the stage model.
- **Transformers (WIZARD out, M·A·S, P·542 input):** hysteresis via a Jiles-Atherton-inspired model or a pragmatic dynamic-saturation + LF rolloff + resonance approximation; verify by harmonic profile vs published/demo material.
- **Tape (PHATSO, P·542):** soft-knee saturation with playback-EQ-ish pre/de-emphasis, HF compression vs level, optional wow-free simplification (no flutter at v1).
- **FET/diode (M·A·S alt path, BØM dirt):** static + dynamic waveshapers with feedback-dependent knee.
- **Even-harmonic engine (SA²RATE):** asymmetric transfer curve constructed to emphasize 2nd/low-even harmonics with controlled odd content; EVEN/ODD macro morphs symmetry.
- **CARNABY:** per-band drive into a shared saturation core — inside multiTransBender this maps naturally: its CHARACTER macro tilts which internal sub-bands drive hardest.
- Each device's CHARACTER knob maps to the most musically meaningful second dimension of its model (bias, symmetry, emphasis, transformer drive, etc.).

**Accuracy expectation (honest):** without measuring real units, these are *character models*, tuned against circuit topology knowledge, published specs/THD figures where available, and demo recordings by ear. A **calibration layer** (per-device harmonic-profile tables that can be re-fit from swept-sine measurements) is designed in from day one, so any future day with a rented unit directly improves the model.

### 5.3 Aliasing budget
Target: aliasing components below approximately −90 dBFS at 4× OS for typical drive settings *(target — measure with swept sines during development; extreme drive on the heaviest models may need 8×/16×)*.

## 6. GUI

### 6.1 Data-driven skins
- Each device skin = JSON: faceplate texture id, palette, knob variant (chicken/alu/glossy), control layout, meter type, switch defs, top-plate contents (tubes count, transformer, vents) for RACK3D.
- One `SkinRenderer` draws all skins → adding a device panel is data, not code. `gui/transband-v5.jsx` is the canonical visual spec (colors, shading layers, interactions, splash, themes).
- Rendering: JUCE `Graphics` with cached images for static layers; knobs/meters redrawn on change only. Evaluate JUCE 8 Direct2D/Metal backends for the 3D view.
- RACK3D: pseudo-3D (pre-transformed top-plate drawing), not a GL scene — matches the mockup approach, stays cheap and fully interactive.

### 6.2 Engine view interactions (from v4 mockup)
- Click within ~18 px of the analyzer/spectrum curve → add band split at that frequency (max 6).
- Click a band node (numbered circle at band center on the curve) or the region between nodes → select.
- Drag crossover handles horizontally (clamped ±15% against neighbors).
- Band chips: select / solo / bypass / remove (remove merges with neighbor).
- Selected band exposes the full control set; all bands' attack/sustain markers remain visible on the display.

### 6.3 Splash & themes
- About/splash component shown on editor open (per-session flag), reopened via ABOUT button; credits text in a single constants file.
- Theme system: a `Theme` struct (chrome colors only) with dark/light instances; components query the active theme via a shared LookAndFeel. Device faceplate palettes are theme-independent. Theme id stored in plugin state.

### 6.4 State
- All parameters in APVTS with stable IDs from day one (preset compatibility).
- Band count/crossovers stored as parameters (fixed 6-band parameter space; unused bands dormant) so host automation and preset recall stay simple.

## 7. Standalone

- JUCE Standalone target extended with: file loader (JUCE audio format readers), looped transport preview through the device callback, the identical processor instance for preview and render, offline render (process file through the graph faster than realtime, write wav/aiff at chosen depth/rate), A/B bypass.

## 8. Testing

- pluginval strictness 10, auval, Ableton Live 12 manual matrix (SR 44.1–192k, buffers 32–2048).
- Unit tests: crossover magnitude-sum flatness; PDC correctness vs reported latency; null test at neutral settings; denormal safety; state save/recall round-trip.
- DSP measurement harness: swept-sine THD + aliasing analysis per engine (also the future hardware-calibration tool).

## 9. Open technical questions

1. JUCE GPL vs paid license (depends on commercial intent).
2. FIR lengths per HQ mode — trade LF crossover accuracy vs PDC. Decide by measurement.
3. Whether CARNABY's internal sub-band drive duplicates the outer multiband — may simplify its model inside multiTransBender.
4. SIMD strategy (JUCE dsp SIMDRegister vs. plain autovectorization) — profile first.
