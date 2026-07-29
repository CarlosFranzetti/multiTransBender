# STATE — design decisions, open questions, and what comes next

Working memory for MultiTransBend. Records *why* things are the
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

The same class of bug then appeared *independently* in the C++ engine, which is
the argument for the plugin having its own test suite rather than trusting the
TypeScript one.

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

1. **The plugin compiles and self-tests, but has not been loaded in a DAW.**
   VST3 and Standalone build clean on Linux and all 17 compiled-plugin checks
   pass. macOS (VST3/AU/Standalone universal) and Windows (VST3/Standalone) are
   produced by `.github/workflows/build-plugin.yml`; those binaries have not
   been opened in Live, Logic or any host, and pluginval has not been run.
   Phase 0's "loads in Live, passes pluginval level 5" is still unmet.
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
   binding in the new CASE AUDIO shell.

---

## 3a. The RACK 3D look is settled — keep it

The current RACK 3D treatment is the reference. Do not redesign it; extend it.

What makes it read as hardware:
- **Pseudo-3D, not a GL scene.** A single CSS `perspective(950px) rotateX(58deg)`
  on the top plate, per tdd.md §6.1. Cheap, fully interactive, no renderer.
- **The top plate carries real furniture**: punched vent slots as a repeating
  gradient, a transformer block with its own laminate striping, and glowing
  valves whose count comes from the device definition.
- **Valves glow with two shadows**, a tight warm core and a wide soft halo. One
  shadow looks flat; two reads as emission.
- **Rack ears with screws** on both sides, each screw a radial gradient with an
  offset slot — the detail that sells scale.
- **A serial number** along the plate's lower edge in mono type.
- **Faceplates stay theme-independent.** Chrome changes with the theme; hardware
  does not, because an object that changes colour with the app stops being an
  object.

Future devices get their look from data (face, ink, accent, texture, knob
variant, meter type, valve count), so a new panel is a table entry, not new
drawing code. That is the data-driven skin plan from tdd.md §6.1 and it should
stay that way.

## 3b. Chrome accent is blue, not gold

The mockup's gold accent sat in the same hue family as several faceplates
(VULTURE's cream, SA²RATE's sand, M·A·S's amber), so selected chrome competed
with the hardware it framed. Azure separates app from device at a glance and
stays legible against every faceplate. Four chrome themes ship: Studio Dark
(default), Studio Light, Midnight, Graphite.

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

### 1.4 The plugin shared one delay line across all bands

Every band pushed into the same `juce::dsp::DelayLine`, so with three bands each
sample was pushed three times and every band read back a mixture of its
neighbours. Crest factor on attack-down moved the wrong way by 2.4 dB. Fixed by
prepping the line with `numChannels * maxBands` channels and indexing
`band * numChannels + c`.

### 1.5 Real-time peak alignment is bounded by causality

The offline engine reads its gain curve arbitrarily far ahead at no cost. A
plugin can only look ahead as far as it is willing to delay, so the same
alignment gives a much smaller crest reduction on attack-down — correct
direction, modest magnitude. BALANCED mode therefore sets lookahead from twice
the slowest band's attack time (capped at 12 ms) rather than the fixed 64
samples tdd.md §3 offered as illustrative. Widening past 12 ms measured no
further improvement, so 12 ms is the cap. ZERO mode has no lookahead and
therefore cannot align at all; that is inherent, and it is why BALANCED is the
default.

## 5. Verification status

`npm test` — 68/68 checks passing. Covers: FFT/convolution, FIR invariants,
crossover reconstruction (1e-9) and magnitude flatness (<0.15 dB), oversampling
round-trip (2×/4×/8×), WAV/AIFF round trips, dither, BS.1770 calibration, the
−100 dBFS neutral null, band add/remove/clamp, per-engine unity gain, DETAIL,
solo, A/B loudness matching, and timeline blending.

End-to-end browser check (Playwright): 24-bit 48 kHz stereo source → render →
32-bit float download, with sample rate, frame count and channel count preserved
and integrated loudness matched to 0.01 LU.

`plugin/tests/EngineSmokeTest.cpp` — 17/17 checks passing against the *compiled*
plugin on Linux. Drives the real `AudioProcessor` in host-sized blocks: neutral
transparency, attack up and down, all ten engines rendering finite audio at a
sane level, and state save/recall. CI runs it on macOS and Windows too, and a
red run blocks the download bundle.

Not yet verified: loading in a DAW, pluginval, auval, and the sample-rate and
buffer-size matrix from prd.md §5.
