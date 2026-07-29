# TRANSBAND — multiTransBender · planning package

Multiband transient designer + per-band analog saturation suite (VST3/AU/CLAP + standalone). v0.1b planning set.

- prd.md   — product requirements (features, 3 views, splash/themes, devices, prefs, formats, legal note)
- tdd.md   — technical design (JUCE 8 architecture, DSP, data-driven skins, themes, testing)
- plan.md  — phased build plan; Claude Code kickoff prompt at the bottom
- gui/     — React interface mockups
  - transband-v5.jsx            <- CANONICAL SPEC: splash/About, light-dark toggle, ENGINE (click-line-to-add, band nodes, 6-band), PANEL, RACK 3D
  - rackforge-v4-all-views.jsx  <- pre-branding all-views iteration
  - rackforge-v2.jsx            <- most polished panel-skin shading reference
  - rackforge-v3-engine.jsx     <- engine view iteration
  - rackforge-preview.jsx       <- first pass

Start in Claude Code: read the three .md files + gui/transband-v5.jsx, then run the Phase 0 kickoff prompt in plan.md.

Credits: Sergio Dimoff — ideas & inspiration · Carlos "Los" Franzetti — loop engineer, part-time phantom.
