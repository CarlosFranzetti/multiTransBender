# TRANSBAND — multiTransBender

**v0.1b beta** · A multiband transient designer with per-band analog saturation.

Split the spectrum into up to **six bands**. Give every band its own attack,
sustain and detail shaping **and** its own saturation engine, chosen from **ten**
original analog-flavoured models. Three interchangeable views of one parameter
state.

Built to the specification in [`design/transband/`](design/transband/) — see
`prd.md` (product), `tdd.md` (technical), `plan.md` (phased build), and
`gui/transband-v5.jsx` (the canonical visual spec).

---

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Scaffold, parameter layout | ✅ web engine; JUCE project scaffolded |
| 1 | GUI framework — 3 views, splash, themes | ✅ in the web build |
| 2 | Transient engine — LR4 + FIR, differential shaper, DETAIL | ✅ verified |
| 3 | Ten saturation engines | ✅ character models, calibration layer in place |
| 4 | Standalone file processing | ✅ web standalone; local standalone via JUCE |
| 5 | Hardening, pluginval, notarization | ⏳ |

The **web standalone** is the working product today. The **JUCE plugin** is
scaffolded with the same DSP contract and needs a compile pass on real hardware.

---

## The three views

**ENGINE** — the real averaged spectrum of your file with the bands drawn over
it. Click on the curve to add a split (max 6), drag the handles to move one,
click a numbered node or a region to select a band. Attack shows solid, sustain
dashed, per band.

**PANEL** — the selected band's engine as a piece of hardware: its own faceplate,
knob style, meter and switches. The controls are the same parameters the engine
view shows, because there is only one state underneath.

**RACK 3D** — front and overhead together, with vents, transformer block and
valves that glow. Fully operable, not a picture.

## The ten engines

| Engine | Character | CHARACTER macro |
| --- | --- | --- |
| **VULTURE** | Twin valve distortion | Triode → pentode bias |
| **PHATSO 7x** | Tape sim / optimizer | Tape ↔ transformer |
| **HG·II** | Pentode + triode saturation | Pentode ↔ triode blend |
| **REVITALIZER** | Program EQ · tube | Mid-high tune |
| **P·542** | Tape emulation · silk | Silk blue ↔ red |
| **WIZARD TS·1** | Stereo tube saturator | Transformer drive |
| **BØM** | Analog warming | Analogue lowpass |
| **SA²RATE** | Even-harmonic saturation | Even ↔ odd symmetry |
| **CARNABY** | Harmonic EQ | Drive tilt, LF → HF |
| **M·A·S** | Harmonics / density | FET ↔ diode |

These are **original DSP models inspired by** the character of classic hardware,
with original names and original panel artwork (prd.md §9). No hardware was
measured; each is a character model built from published circuit topology and
listening. A **calibration layer** — per-device harmonic weights — is designed in
from day one, so a future swept-sine measurement of a real unit improves the
model without touching its topology.

---

## Why it sounds the way it does

Everything below is verified numerically by `npm test`, not asserted.

**Neutral nulls.** With no shaping and no drive, the output nulls against the
input below −100 dBFS (prd.md §5). If the transparent case is not transparent,
nothing else can be trusted.

**The detector is threshold-free.** It never looks at absolute level, only at the
*difference* between a fast and a slow envelope follower. A quiet snare and a
loud one get the same treatment, because both produce the same divergence at
their onset. There is no threshold knob because there is nothing to set one to.

**The slow envelope must release more slowly than the fast one.** This is a
correctness requirement, not a voicing choice. Two one-pole followers sharing a
release coefficient decay at the same rate, so once an onset pushes them apart
their ratio is preserved — the dB difference never returns to zero and the
"transient detector" silently degenerates into a fixed gain. This was a real bug,
caught by the crest-factor test.

**The control signal is aligned with the peak it acts on.** A differential
detector reaches full divergence roughly one attack time-constant *after* an
onset, not at it. Applied literally, a gain reduction lands on the body of a hit
and misses the peak — so "attack down" produced a *peakier* signal, not a flatter
one. The engine slides a running extremum of the control signal backwards over
the lookahead window, the same construction a lookahead limiter uses.

**Program-adaptive detector times.** A 60 Hz cycle is 16 ms long, so a 1 ms
detector on a bass band measures the waveform rather than the event. Time
constants scale with band centre frequency automatically (tdd.md §4).

**The linear-phase crossover is exact.** Each split runs a zero-phase
windowed-sinc lowpass and derives the highpass by *subtraction* rather than
designing a second filter, so the bands sum back to the input sample-for-sample.
Verified to 1e-9.

**The zero-latency crossover is flat.** Linkwitz-Riley 4th order with the allpass
correction a 3+ band split requires — LR4 lowpass + highpass reduces to exactly
one second-order allpass at Q=1/√2. Without it the bands sum with a notch at the
upper crossover. Flat within 0.15 dB.

**Lookahead costs nothing offline.** A real-time processor delays the audio and
reports PDC. Offline the engine reads the *gain curve* ahead of the audio
instead, so renders align sample-for-sample with the source and dry/wet mixing
stays phase-correct.

**Every engine passes small signals at unity.** Engaging a saturation model
changes tone and density, not level. Without that normalisation "warmer" is just
"louder", and every A/B picks the loudest option rather than the best one.

**Nonlinear stages are oversampled** up to 16× with 120 dB halfband filters, and
only around the nonlinearity — filters stay at base rate where they are valid.

**Detection is stereo-linked.** One gain curve drives every channel of a band, so
a transient that hits one side harder cannot pull the stereo image.

**Export is genuinely lossless.** 32-bit float WAV is the engine's output
verbatim: no quantisation, no dither, no clipping. Fixed-point exports offer TPDF
dither and second-order noise shaping.

**Files are read natively.** WAV and AIFF are parsed directly so the true sample
rate and bit depth survive. The browser's `decodeAudioData` resamples to the
AudioContext rate, which would destroy the lossless claim before processing
started.

---

## Privacy

The web standalone never uploads your audio, enforced by architecture rather than
by policy: there is no upload endpoint and no audio column in the schema. Your
file is read into the tab, processed by a Web Worker on your machine, played back
locally, and written to a download locally. Closing the tab destroys it.

An optional account stores **settings only** — device choices, band values,
crossover layouts, and the settings of your last three renders — plus a SHA-256
fingerprint so a saved recipe can recognise a file you bring back. A hash cannot
be turned back into audio.

The plugin and local standalone are the deliberate opposite: they run on your
machine, so every export is copied into a dated folder alongside the settings
that produced it, and the last three processings are kept as restorable backups.
Redundancy is a virtue when the storage is yours and a liability when it is
someone else's.

---

## Getting started

```bash
npm install
npm test      # 68 DSP checks — run this before trusting a change
npm run dev   # http://localhost:3000
```

Plugin build, database setup and packaging: [docs/BUILDING.md](docs/BUILDING.md).

### Deploying

Deploys to Vercel with no configuration. Accounts need a Postgres connection
string in `DATABASE_URL` (Neon on the hosted build). Without one the app still
loads, processes and exports audio — it simply cannot sync presets, so a database
outage degrades one feature instead of taking the tool down.

---

## Layout

```
src/dsp/            the engine — pure TypeScript, no DOM, runs in Node and the browser
src/workers/        rendering worker (the only place decoded audio lives)
src/lib/            worker client, gapless A/B playback, auth, database
src/app/            Next.js routes and API endpoints
src/components/
  transband/        the three views, themes, splash, knobs, hardware
plugin/             JUCE C++ — VST3, AU, CLAP, Standalone
design/transband/   the specification package this was built from
tests/dsp.test.ts   the verification suite
db/schema.sql       Postgres schema (note the absence of an audio column)
dist/               packaged archives
STATE.md            design decisions, open questions, roadmap
```

`src/dsp/devices.ts` and `plugin/Source/Devices.h` hold the same numbers in two
languages. They are the contract between the offline and real-time engines:
changing one without the other breaks it.

---

## Testing

```bash
npm test
```

68 checks: FFT and convolution correctness, FIR design invariants, crossover
reconstruction and magnitude flatness, oversampling round-trip fidelity, WAV/AIFF
round trips, dither behaviour, BS.1770 loudness calibration, the −100 dBFS null,
band add/remove/clamp behaviour, per-engine unity gain, DETAIL, solo, and — most
importantly — that attack and sustain move crest factor in the direction their
labels claim. That last one caught two real bugs; both are documented in
[STATE.md](STATE.md).

---

## Credits

**Sergio Dimoff** — Ideas & Inspiration · The Plugin He Actually Needed
**Carlos "Los" Franzetti** — Loop Engineer · Part-Time Phantom · Chief Loser of Things

## Licence

MIT — see [LICENSE](LICENSE). JUCE is fetched at build time and licensed
separately.
