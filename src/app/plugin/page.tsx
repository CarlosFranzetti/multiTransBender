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
          The plugin ships as source with a CMake project that fetches JUCE for you. One command
          produces the VST3, the Audio Unit and the local standalone application. Building it
          yourself means the binary loading into your session is one you compiled — which for
          something that sits on your master bus is worth the five minutes.
        </p>
        <div className="btn-row">
          <a
            className="btn btn-primary"
            href="/downloads/multiTransBender-plugin-source.zip"
            download
          >
            Download plugin source
          </a>
          <a className="btn" href="https://github.com/CarlosFranzetti/multiTransBender">
            View on GitHub
          </a>
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
            <li>Zero-latency lookahead, by reading the control signal ahead of the audio</li>
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
