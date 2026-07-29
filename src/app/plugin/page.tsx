import { DEVICES } from '@/dsp';

export const metadata = {
  title: 'Plugin — multiTransBender',
  description:
    'The VST3, Audio Unit and local standalone build. Real-time, automatable, and it keeps your exports and backups.',
};

export default function PluginPage() {
  return (
    <div className="shell"><div className="stack" style={{ paddingTop: '2.5rem', maxWidth: 860 }}>
      <div>
        <h1 style={{ marginBottom: '0.8rem' }}>The plugin is the flexible one.</h1>
        <p className="muted">
          The web version is deliberately narrow: one file in, one file out, nothing kept. The
          plugin runs inside your session, on every track, in real time, with every parameter
          automatable — and because it runs on your machine, it can afford to keep things.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Download</span>
          <span className="faint mono">VST3 · AU · Standalone</span>
        </div>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          Compiled binaries for macOS, Windows and Linux. Every build is produced by
          CI from the source in this repository, and each platform runs the
          compiled-plugin test suite before it is packaged — a red run ships nothing.
        </p>

        <table className="spec" style={{ marginBottom: '1rem' }}>
          <tbody>
            <tr>
              <td>macOS — universal (Apple Silicon + Intel)</td>
              <td>VST3 · Audio Unit · Standalone</td>
            </tr>
            <tr>
              <td>Windows x64</td>
              <td>VST3 · Standalone</td>
            </tr>
            <tr>
              <td>Linux x64</td>
              <td>VST3 · Standalone</td>
            </tr>
          </tbody>
        </table>

        <div className="btn-row">
          <a
            className="btn btn-primary"
            href="https://github.com/CarlosFranzetti/multiTransBender/releases/download/latest-beta/multiTransBender-plugins.zip"
          >
            Download compiled plugins
          </a>
          <a
            className="btn"
            href="https://github.com/CarlosFranzetti/multiTransBender/releases"
          >
            All releases
          </a>
          <a
            className="btn"
            href="https://github.com/CarlosFranzetti/multiTransBender/actions/workflows/build-plugin.yml"
          >
            Latest CI builds
          </a>
          <a className="btn btn-ghost" href="https://github.com/CarlosFranzetti/multiTransBender">
            Source on GitHub
          </a>
        </div>

        <div className="notice notice-warn" style={{ marginTop: '1rem' }}>
          These builds are not code-signed or notarised, so Gatekeeper and SmartScreen
          will object on first launch. That is what an unsigned beta looks like, not a
          sign of a problem — <code>INSTALL.md</code> in the download explains how to
          clear the quarantine flag. If you would rather not run an unsigned binary on
          your master bus, which is a reasonable position, the source builds in one
          command:
        </div>

        <pre
          className="mono"
          style={{
            marginTop: '1rem',
            marginBottom: 0,
            padding: '0.85rem',
            background: 'var(--bg-raised)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            overflowX: 'auto',
          }}
        >
          {`cd plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel`}
        </pre>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">What the plugin adds</span>
          </div>
          <ul className="feature-list">
            <li>Runs live on any track, at real-time latency, on unlimited instances</li>
            <li>Six bands, each with its own engine, all host-automatable</li>
            <li>A different device per band — low end on one voicing, top end on another</li>
            <li>Every parameter automatable, including the per-band device choice</li>
            <li>Your DAW&rsquo;s timeline replaces the web version&rsquo;s region editor</li>
            <li>Copies of every export, filed with the settings that made it</li>
            <li>Rolling backups of your last three processings, restorable from the editor</li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">What the web version does better</span>
          </div>
          <ul className="feature-list">
            <li>Linear-phase crossovers — non-causal, so only possible offline</li>
            <li>
              Deeper transient control: reading the gain curve arbitrarily far ahead costs
              nothing offline, where a plugin can only look ahead as far as it delays
            </li>
            <li>True A/B: several devices rendered at once and switched sample-aligned</li>
            <li>Automatic loudness matching across every version you are comparing</li>
            <li>Nothing to install, and nothing kept afterwards</li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Same devices, same numbers</span>
        </div>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          The device table in the plugin is a transcription of the one the web engine uses, value
          for value. A chain you dial in here sounds like the same chain there — the differences
          between the two are the ones real-time forces, and they are listed above rather than
          hidden.
        </p>
        <div className="readout">
          {DEVICES.map((device) => (
            <span className="readout-item" key={device.id}>
              <span className="device-dot" style={{ ['--device-accent' as string]: device.accent }} />
              <strong>{device.name}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Where it keeps your work</span>
        </div>
        <table className="spec">
          <tbody>
            <tr>
              <td>macOS</td>
              <td>~/Library/Application Support/multiTransBender/</td>
            </tr>
            <tr>
              <td>Windows</td>
              <td>%APPDATA%\multiTransBender\</td>
            </tr>
            <tr>
              <td>Linux</td>
              <td>~/.config/multiTransBender/</td>
            </tr>
          </tbody>
        </table>
        <p className="faint" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          <code>backups/</code> holds the last three states. <code>exports/</code> holds a dated
          copy of each render next to the settings that produced it. Nothing in either folder is
          ever transmitted.
        </p>
      </div>
    </div>
    </div>
  );
}
