# STATE — design decisions, open questions, and what comes next

Working memory for TRANSBAND — multiTransBender. Records *why* things are the
way they are, so the reasoning survives even when the code changes.

---

## 1. Bugs found by the test suite (keep these tests)

### 1.1 The differential detector degenerated into a fixed gain

Both envelope followers shared one release coefficient. Two one-pole followers
releasing at the same rate preserve their ratio, so once an onset pushed them
apart the dB difference **never returned to zero** — the shaper applied a
constant +11 dB and the "attack" control was a volume knob. Mean gain across the
file was 11.19 dB out of an 11.2 dB maximum, which is what gave it away.

**Fix:** the slow envelope releases 4× slower than the fast one, so it falls
behind on the way down and drives the difference back through zero. This is a
correctness requirement, not a voicing choice.

**Test that caught it:** crest factor must rise when attack rises.

### 1.2 Attack-down made signals peakier

A differential detector reaches maximum divergence roughly one attack
time-constant *after* the onset. Applied literally, a gain reduction landed on
the body of a hit and missed the peak, so turning attack down *increased* crest
factor.

**Fix:** slide a running extremum (monotonic deque, O(n)) of the control signal
backwards over the lookahead window — max for boosts, min for cuts. Same
construction a lookahead limiter uses. The running extremum of a continuous
signal is continuous, so it needs no extra smoothing.

### 1.3 A test that was measuring the wrong thing (twice)

- The crest-factor test originally used a signal made only of decaying hits —
  ~100% transient energy, so attenuating transients attenuated everything and the
  metric went blind. Fixed by adding a sustained harmonic bed, which is what real
  material has.
- The "unit slope at zero" test probed engines with a single sample. A filter's
  response to one impulse is its first coefficient, not its passband gain, so
  every engine with a voicing filter reported as broken. Fixed by measuring a
  settled 1 kHz sine.

**Lesson worth keeping:** when a test fails, check whether the test or the code
is wrong. Here it was 2 code bugs and 2 test bugs, and telling them apart
required measuring peak and RMS separately rather than trusting the ratio.

---

## 2. Decisions and their reasons

| Decision | Why |
| --- | --- |
| Real units (dB/Hz/ms) in the model, 0–1 only at the knob | Presets stay readable and survive a range change |
| Per-band device, not one global device | It is the product (prd.md §3.1); a global device is a smaller plugin |
| Offline lookahead = read-ahead, not delay | Renders align sample-for-sample; dry/wet stays phase-correct; no PDC |
| Timeline renders full passes then crossfades | Chopping resets every detector exactly where a device change happens |
| Linear crossfade, not equal-power | The two sides are highly correlated; equal-power bulges in the middle |
| Complementary FIR highpass (`δ − lowpass`) | Exact reconstruction rather than approximate |
| One LR4 allpass per already-emitted band | LR4 LP+HP reduces to exactly one 2nd-order allpass at Q=1/√2 |
| Loudness-match A/B to the *source* | Otherwise every comparison picks the loudest option |
| Program-adaptive detector times | A 1 ms detector on a bass band measures the waveform, not the event |
| Stereo-linked detection | Independent per-channel gain moves the stereo image |
| 32-bit mode actually rounds intermediates | Otherwise the control would be decorative |
| Accounts optional, DB failure degrades one feature | A database outage must not take the processor down |
| No audio column anywhere in the schema | The privacy claim is enforced by structure, not by policy text |

---

## 3. Known gaps

1. **The JUCE plugin has not been compiled.** The project, DSP headers, processor,
   editor and backup store are written against the same numbers as the web
   engine, but no compiler has seen them. Phase 0 exit criteria (loads in Live,
   passes pluginval) are unmet. This is the single biggest honesty gap.
2. **Faceplate switches are cosmetic.** The two toggles per device have no DSP
   behaviour yet because the PRD does not define one. They are deliberately not
   pretending to be wired.
3. **Timeline / region editor is in the DSP and tested, but not in the v0.1b UI.**
   `renderTimeline` works and is covered; the interface for placing regions was
   cut to ship the three canonical views first.
4. **No hardware calibration.** Every engine is a character model. The
   `calibration` field exists and is plumbed, but no swept-sine fit has been done.
5. **CLAP format** is specified in tdd.md §1 but the CMake project currently
   builds VST3/AU/Standalone only; CLAP needs `clap-juce-extensions`.
6. **Undo/redo** (prd.md §6) is not implemented.
7. **Preset save/load to the account** has API routes and a schema but no UI
   binding in the new TRANSBAND shell.

---

## 4. Ideas parked for later

**DSP**
- Mid/side per band (prd.md §4 lists it as a v1.1 candidate).
- Transient-triggered device switching: pick the engine per *hit* rather than per
  region, using the detector that already exists.
- Spectral tilt display of what each band's saturation is actually adding —
  render the harmonic delta live rather than describing it in words.
- A true null-test button in the UI: render neutral, subtract, report the depth.
  The number is already in the test suite; users should be able to reproduce it.
- Auto-crossover placement from the spectrum: put splits at spectral valleys
  rather than at round numbers.
- Per-band delta listening ("solo the difference") — the fastest way to hear what
  a control is really doing.
- Oversampling only when a band's drive is non-zero (already partly true; make it
  explicit and report the saving).

**Interface**
- Drag the attack/sustain markers directly on the spectrum instead of via knobs.
- A/B slots A–D with keyboard switching, and blind mode that hides which is which
  until you commit — the honest way to use a level-matched comparison.
- Per-instance UI size persistence (prd.md §6).
- Batch processing for the standalone (prd.md §3.6, v1.1).

**Product**
- Factory bank expansion by source and by device (drums / bus / mix already
  grouped in `FACTORY_PRESETS`).
- Shareable preset links that encode the chain in the URL — no account needed,
  and nothing stored server-side, which fits the privacy stance.

---

## 5. Verification status

`npm test` — 68/68 checks passing. Covers: FFT/convolution, FIR invariants,
crossover reconstruction (1e-9) and magnitude flatness (<0.15 dB), oversampling
round-trip (2×/4×/8×), WAV/AIFF round trips, dither, BS.1770 calibration, the
−100 dBFS neutral null, band add/remove/clamp, per-engine unity gain, DETAIL,
solo, A/B loudness matching, and timeline blending.

End-to-end browser check (Playwright): 24-bit 48 kHz stereo source → render →
32-bit float download, with sample rate, frame count and channel count preserved
and integrated loudness matched to 0.01 LU.
