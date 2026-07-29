import Link from 'next/link';
import { DEVICES } from '@/dsp/devices';

export default function HomePage() {
  return (
    <div className="shell">
      <section className="hero">
        <h1>
          Six bands. Ten engines. Every band gets its own.
        </h1>
        <p>
          TRANSBAND — multiTransBender is a multiband transient designer with per-band analog
          saturation. Split the spectrum up to six ways, then give every band its own attack,
          sustain and detail shaping <em>and</em> its own saturation engine. Process at full
          resolution in your browser and download a lossless file.
        </p>
        <div className="btn-row" style={{ marginTop: '1.6rem' }}>
          <Link href="/studio" className="btn btn-primary">
            Enter the rack
          </Link>
          <Link href="/plugin" className="btn">
            Get the plugin
          </Link>
        </div>
        <p className="faint" style={{ marginTop: '1.1rem' }}>
          v0.1b beta · no sign-up needed to process audio · nothing you load is uploaded anywhere
        </p>
      </section>

      <section className="stack" style={{ marginBottom: '2.5rem' }}>
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Three views, one state</span>
          </div>
          <div className="grid grid-3">
            <div>
              <h3 style={{ marginBottom: '0.4rem' }}>ENGINE</h3>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                The real averaged spectrum of your file, with the bands drawn over it. Click on the
                curve to add a split, drag the handles to move one, click a numbered node to select
                a band. Attack shows solid, sustain dashed.
              </p>
            </div>
            <div>
              <h3 style={{ marginBottom: '0.4rem' }}>PANEL</h3>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                The selected band&rsquo;s engine as a piece of hardware — its own faceplate, knobs,
                meters and switches. The controls are the same parameters the engine view shows,
                because there is only one state underneath.
              </p>
            </div>
            <div>
              <h3 style={{ marginBottom: '0.4rem' }}>RACK 3D</h3>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Front and overhead together: vents, transformer block, and valves that glow. Fully
                operable, not a picture.
              </p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">The ten engines</span>
            <span className="faint">original models · original artwork</span>
          </div>
          <div className="grid grid-3">
            {DEVICES.map((device) => (
              <div
                key={device.id}
                className="device"
                data-selected="true"
                style={{ ['--device-accent' as string]: device.accent }}
              >
                <div className="stack-sm">
                  <span className="device-name">
                    <span className="device-dot" />
                    {device.name}
                  </span>
                  <span className="device-blurb">{device.sub}</span>
                  <span className="faint" style={{ fontSize: '0.75rem' }}>
                    CHARACTER → {device.characterLabel.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="faint" style={{ marginTop: '1rem', marginBottom: 0 }}>
            These are original DSP models inspired by the character of classic hardware, with
            original names and original panel artwork. No units were measured; each is a character
            model built from published circuit topology and listening, with a calibration layer
            designed in so a future measurement can be fitted without rewriting the topology.
          </p>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">What the engine guarantees</span>
            </div>
            <ul className="feature-list">
              <li>64-bit float throughout, with a genuine 32-bit mode for plugin parity</li>
              <li>Sample rate and channel count preserved exactly, never resampled</li>
              <li>Neutral settings null against the input below &minus;100 dBFS</li>
              <li>Linear-phase crossover sums back to the input sample-for-sample</li>
              <li>Zero-latency crossover flat within 0.15 dB across the spectrum</li>
              <li>Lookahead read-ahead offline — renders align sample-for-sample with the source</li>
              <li>Nonlinear stages oversampled up to 16&times; with 120 dB halfband filters</li>
              <li>Every engine passes small signals at unity — tone, not level</li>
              <li>32-bit float export is the engine output verbatim, unclipped and undithered</li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Web, plugin, or standalone</span>
            </div>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              The web version is the quick one: drop a file in, work, download, done. It keeps
              nothing, by design — there is no upload endpoint and no audio column in the database.
            </p>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              The plugin and local standalone run inside your DAW at real-time latency, automate
              every parameter, keep copies of your exports, and hold rolling backups of your last
              three processings.
            </p>
            <div className="btn-row" style={{ marginTop: '0.9rem' }}>
              <Link href="/plugin" className="btn">
                Download the plugin
              </Link>
              <Link href="/privacy" className="btn btn-ghost">
                What is stored
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
