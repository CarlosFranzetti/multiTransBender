export const metadata = {
  title: 'Privacy — multiTransBender',
  description: 'What the web standalone stores, what it does not, and why.',
};

export default function PrivacyPage() {
  return (
    <div className="shell"><div className="stack" style={{ paddingTop: '2.5rem', maxWidth: 760 }}>
      <div>
        <h1 style={{ marginBottom: '0.8rem' }}>Your audio does not leave your browser.</h1>
        <p className="muted">
          This is a design decision enforced by architecture, not a promise in a policy document.
          There is no upload endpoint. There is no audio column in the database. There is nowhere
          for your file to go.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">How the web version handles a file</span>
        </div>
        <ol className="muted" style={{ paddingLeft: '1.2rem', fontSize: '0.92rem' }}>
          <li>You pick a file. The browser reads it into memory in this tab.</li>
          <li>
            It is decoded and processed by a Web Worker running inside the same tab. The engine is
            JavaScript executing on your machine.
          </li>
          <li>The result is played back and written to a download, both locally.</li>
          <li>
            Closing the tab discards everything. &ldquo;Clear audio from memory&rdquo; in the studio
            does it immediately.
          </li>
        </ol>
        <p className="faint" style={{ marginBottom: 0 }}>
          You can verify this. Open your browser&rsquo;s network panel and process a file — you will
          not see the audio go anywhere, because it does not.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">What an account stores</span>
        </div>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          An account is optional and exists so your settings follow you between machines. If you
          make one, the database holds:
        </p>
        <table className="spec">
          <tbody>
            <tr>
              <td>Your email address</td>
              <td>identifies the account</td>
            </tr>
            <tr>
              <td>A scrypt hash of your password</td>
              <td>never the password</td>
            </tr>
            <tr>
              <td>Session tokens, hashed</td>
              <td>SHA-256, so a dump is not a login</td>
            </tr>
            <tr>
              <td>Your presets and region maps</td>
              <td>device ids, band settings, timings</td>
            </tr>
            <tr>
              <td>The last three renders&rsquo; settings</td>
              <td>so you can pick a session back up</td>
            </tr>
            <tr>
              <td>A SHA-256 of the audio you processed</td>
              <td>to match a recipe to a file you bring back</td>
            </tr>
          </tbody>
        </table>
        <p className="faint" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          The fingerprint is a one-way hash of a decimated version of the samples. It can confirm
          two files are the same. It cannot be turned back into audio.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">What it never stores</span>
        </div>
        <ul className="feature-list">
          <li>Audio, in any form, at any point, encoded or otherwise</li>
          <li>Waveform images, spectrograms, or any other rendering of your material</li>
          <li>Analytics, behavioural tracking, or third-party scripts</li>
          <li>Anything at all if you never create an account</li>
        </ul>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">The plugin and local standalone are different on purpose</span>
        </div>
        <p className="muted" style={{ fontSize: '0.92rem', marginBottom: 0 }}>
          They run on your machine, so keeping things is free and safe. They write copies of your
          exports, keep your settings alongside them, and hold rolling backups of your last three
          processings. Redundancy is a virtue when the storage is yours. It is a liability when it
          is someone else&rsquo;s, which is why the web version keeps nothing.
        </p>
      </div>
    </div>
    </div>
  );
}
