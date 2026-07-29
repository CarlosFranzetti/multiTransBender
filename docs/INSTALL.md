# Installing MultiTransBend

**by Case Audio** · v0.1b beta

The download contains one folder per platform. Take the one for your machine.

| Platform | Formats |
| --- | --- |
| macOS (universal: Apple Silicon + Intel) | VST3, Audio Unit, Standalone |
| Windows x64 | VST3, Standalone |
| Linux x64 | VST3, Standalone |

## macOS

```
VST3         → ~/Library/Audio/Plug-Ins/VST3/
Audio Unit   → ~/Library/Audio/Plug-Ins/Components/
Standalone   → /Applications/  (or anywhere)
```

These builds are **not signed or notarised**, so Gatekeeper will refuse them on
first launch. That is expected for an unsigned beta, not a sign of a problem.
Clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/MultiTransBend.vst3
xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/Components/MultiTransBend.component
```

Logic and GarageBand cache their plugin scan, so if the Audio Unit does not
appear, reset the cache and rescan:

```bash
killall -9 AudioComponentRegistrar
auval -a | grep -i transbender
```

## Windows

```
VST3         → C:\Program Files\Common Files\VST3\
Standalone   → anywhere
```

SmartScreen will warn about an unrecognised publisher on first run for the same
reason: no code-signing certificate. Choose **More info → Run anyway** if you
are satisfied with where the file came from.

## Linux

```
VST3         → ~/.vst3/
Standalone   → anywhere
```

## Where it keeps your work

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Case Audio/MultiTransBend/` |
| Windows | `%APPDATA%\Case Audio\MultiTransBend\` |
| Linux | `~/.config/Case Audio/MultiTransBend/` |

`backups/` holds the last three processing states, restorable from the editor.
`exports/` holds a dated copy of every render alongside the settings that
produced it. Nothing in either folder is ever transmitted.

## Verifying the build

Every binary in this bundle was produced by the `Build plugin` GitHub Actions
workflow, and each platform ran the compiled-plugin smoke test before packaging.
That test drives the real `AudioProcessor` — it checks that neutral settings pass
audio cleanly, that attack up and down move the crest factor in the right
directions, that all ten saturation engines render finite audio at a sane level,
and that state saves and recalls. A red run does not produce a bundle.

## Building it yourself

If you would rather not run an unsigned binary — a reasonable position for
something that sits on your master bus — the source builds in one command:

```bash
cd plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel
```

See [BUILDING.md](BUILDING.md) for prerequisites.
