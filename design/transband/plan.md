# TRANSBAND — multiTransBender — Development Plan

**Version:** 0.1 · July 2026
**Priority order (owner-confirmed):** 1) GUI framework → 2) Transient engine → 3) Saturation models → 4) Standalone.
**Honesty note:** all durations are rough guesses for an AI-assisted solo developer, not commitments. DSP phases in particular tend to run long.

---

## Phase 0 — Scaffold (first sessions in Claude Code)
- [ ] CMake + JUCE 8 project, formats: VST3/AU/CLAP/Standalone; targets macOS universal + Windows.
- [ ] Fixed 6-band APVTS parameter layout with stable IDs (all bands allocated; dormant when unused).
- [ ] Passthrough processor builds, loads in Ableton Live 12, passes pluginval level 5.
- [ ] Repo hygiene: .gitignore, README, GitHub Actions build check (can defer signing/notarization).

**Exit:** empty plugin runs in Live on your Mac.

## Phase 1 — GUI framework (~2–4 weeks, guess)
- [ ] SkinRenderer + JSON skin schema; port knob variants (chicken/alu/glossy), toggles, VU + LED meters, textures from the React mockups (`gui/transband-v5.jsx` is the canonical spec).
- [ ] ViewHost with ENGINE / PANEL / RACK3D switching over one parameter state.
- [ ] SpectrumComponent: FFT analyzer (lock-free FIFO), band tint regions, attack/sustain markers, numbered band nodes, click-on-line-to-add, node/region select, draggable crossover handles, band chips.
- [ ] Selected-band control panel; prefs bar (precision/OS/latency) wired to (stub) engine flags.
- [ ] Resizable UI, per-instance size persistence; double-click reset, shift-fine-drag, full host automation.
- [ ] Splash/About screen (TRANSBAND wordmark, v0.1b badge, credits, ABOUT button) per prd.md §3.4.
- [ ] Light/dark theme system (chrome-only Theme struct + LookAndFeel; persists in state).
- [ ] All 10 device skins as JSON (front + top-plate defs).

**Exit:** the whole v0.4 mockup works in Live, controlling stub DSP parameters.

## Phase 2 — Transient engine (~2–3 weeks, guess)
- [ ] LR4 IIR crossover bank (ZERO mode), 1–6 bands with click-free graph swap on band changes.
- [ ] Crossover unit tests: magnitude-sum flatness, null at neutral.
- [ ] Per-band differential envelope transient shaper (attack/sustain), program-adaptive time constants, DETAIL HF path.
- [ ] BALANCED mode (fixed lookahead detector) + PDC reporting.
- [ ] HQ LINEAR FIR bank + dynamic PDC.
- [ ] Precision templating (float/double instantiation from pref).

**Exit:** a genuinely good 6-band transient designer, no saturation yet. Beta-test it on your own drums.

## Phase 3 — Saturation engines (~6–12+ weeks, guess — the long pole)
Build order (simplest topology → hardest), each with the swept-sine measurement harness pass:
1. SA²RATE (asymmetric even-harmonic core) — also establishes the Oversampler wrapper + calibration-table format.
2. BØM (warm/drive/LPF/glue)
3. P·542 (tape + Silk shelves)
4. PHATSO 7x (tape sim + tranny + warmth)
5. M·A·S (FET/diode harmonics/density)
6. CARNABY (per-band drive core)
7. REVITALIZER (program EQ + tube stage)
8. WIZARD TS·1 (tube + output transformer)
9. HG·II (parallel pentode + triode)
10. VULTURE (triode/pentode with bias control — hardest)
- [ ] CHARACTER macro mapping per device; per-band engine hot-swap without clicks.
- [ ] Aliasing measurements at each OS mode; CPU profiling (define the real 32 vs 64-bit savings here).

**Ship checkpoint:** v1.0 can ship after engine #5 or #6 if quality bar is met; remaining engines become free updates.

## Phase 4 — Standalone (~1–2 weeks, guess)
- [ ] File open (wav/aiff/flac/mp3), looped realtime preview, A/B bypass.
- [ ] Offline render to wav/aiff with depth/rate selection.
- [ ] (v1.1) batch processing.

## Phase 5 — Hardening & release
- [ ] pluginval strictness 10 both OSes; auval; Live matrix test (SR 44.1–192k, buffers 32–2048).
- [ ] Preset system + factory bank (drums / bus / mix / per-device).
- [ ] macOS codesign + notarization; Windows installer. (Apple Developer ID ~$99/yr — verify current price.)
- [ ] Legal pass on names/artwork if releasing commercially (see prd.md §9).

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Saturation phase blows up | Ship-at-#5 checkpoint; calibration layer lets models improve post-launch |
| No hardware for validation | Tune vs published specs/demos; rent-a-unit calibration workflow built in |
| JUCE licensing | Decide GPL vs paid before selling |
| Solo bandwidth | Claude Code drives implementation; this doc set is its context |

## Claude Code kickoff prompt (suggested)
"Read prd.md, tdd.md, plan.md, and the gui/*.jsx mockups. Start Phase 0: scaffold the JUCE 8 CMake project per tdd.md §1–2 with the fixed 6-band APVTS layout, building VST3/AU/CLAP/Standalone on macOS. Then begin Phase 1 with the SkinRenderer JSON schema derived from gui/transband-v5.jsx."
