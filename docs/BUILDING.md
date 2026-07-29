# Building MultiTransBend

Two independent builds live in this repository: the web/standalone TypeScript
engine and the C++ plugin. They share an algorithm, not a compiler.

## The plugin and local standalone (C++ / JUCE)

The CMake project builds VST3, Audio Unit (macOS) and a Standalone application
from the same sources. JUCE is fetched automatically at configure time, so there
is no submodule to initialise.

### Requirements

| Platform | Needs |
| --- | --- |
| macOS | Xcode 14+ command line tools, CMake 3.22+ |
| Windows | Visual Studio 2022 (Desktop C++ workload), CMake 3.22+ |
| Linux | GCC 11+ or Clang 14+, CMake 3.22+, and the JUCE Linux dependencies below |

On Debian/Ubuntu the JUCE dependencies are:

```bash
sudo apt install libasound2-dev libjack-jackd2-dev libcurl4-openssl-dev \
  libfreetype-dev libfontconfig1-dev libx11-dev libxcomposite-dev \
  libxcursor-dev libxext-dev libxinerama-dev libxrandr-dev libxrender-dev \
  libglu1-mesa-dev mesa-common-dev
```

### Build

```bash
cd plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel
```

The first configure clones JUCE and takes a few minutes. Subsequent builds do
not.

Artifacts land in `plugin/build/MultiTransBend_artefacts/Release/`:

- `VST3/MultiTransBend.vst3`
- `AU/MultiTransBend.component` (macOS only)
- `Standalone/MultiTransBend` — the local standalone application

`COPY_PLUGIN_AFTER_BUILD` is on, so on macOS and Windows the plugin is also
installed to the system plugin folder as part of the build.

### Where the standalone keeps things

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/MultiTransBend/` |
| Windows | `%APPDATA%\MultiTransBend\` |
| Linux | `~/.config/MultiTransBend/` |

Inside that folder, `backups/` holds the last three processing states and
`exports/` holds a dated copy of every render together with the settings that
produced it. Both are yours and neither is ever transmitted anywhere.

## The web standalone (TypeScript / Next.js)

```bash
npm install
npm run test       # DSP verification suite — run this before trusting a change
npm run dev        # http://localhost:3000
npm run build
```

`npm run test` is not a smoke test. It checks crossover reconstruction to 1e-9,
oversampling round-trip level to 0.05 dB, WAV round-trip transparency, loudness
calibration against a known tone, and that the transient controls move crest
factor in the direction their labels claim. If you change the engine and these
fail, the engine is wrong.

### Optional database

Accounts and preset syncing need a Postgres connection string in
`DATABASE_URL`. Neon is what the hosted deployment uses. Without it the app runs
normally and simply cannot save presets to the cloud — the processor itself has
no dependency on the database at all.

```bash
export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'
```

The schema in `db/schema.sql` is applied automatically on first use; it is also
checked in so it can be reviewed before anything runs.

## Packaging

```bash
npm run package:zip
```

Writes `public/downloads/MultiTransBend-plugin-source.zip` (served by the
deployed site) and `dist/MultiTransBend-<version>-source.zip` (a snapshot of
the whole project).
