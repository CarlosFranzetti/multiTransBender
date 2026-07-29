# multiTransBend

### *Multiband transient designer with per-band analog-flavored saturation.*

MultiTransBender is a high-precision audio tool designed to shape transients across multiple frequency bands, paired with ten unique, character-driven saturation engines. Whether you are looking for the warmth of a tube or the punch of a tape machine, this tool provides surgical control with analog soul.

---

## ✨ Features

- **🎛️ Multiband Control:** Split your signal into up to 6 bands using exact linear-phase or zero-latency crossovers.
- **💥 Threshold-Free Detection:** A smart differential detector that reacts to the *difference* between fast and slow envelopes, making it program-adaptive and intuitive.
- **🎸 10 Analog-Inspired Engines:** From **VULTURE** (Twin valve distortion) to **PHATSO 7x** (Tape sim), each model is built from published circuit topologies.
- **👁️ Three Immersive Views:** 
    - **ENGINE:** Interactive spectrum analysis and band splitting.
    - **PANEL:** Hardware-style knob and meter interface for deep parameter tweaking.
    - **RACK 3D:** A fully operable 3D visualization of the hardware.
- **💎 High-Fidelity DSP:** 16x oversampling on nonlinear stages, stereo-linked detection, and lossless 32-bit float export.

## 🛠️ Tech Stack

- **Core DSP:** C++ / JUCE 8
- **GUI Framework:** React / TypeScript / Web Engine
- **Build System:** CMake
- **Testing:** Custom numerical verification via `npm test`

## 🚀 Setup & Installation

### Web Standalone (Easiest)
Simply visit the live demo to use the web-based version immediately!

### Plugin Development (Advanced)
1. Clone the repo: `git clone https://github.com/CarlosFranzetti/multi-trans-bend.git`
2. Ensure you have **JUCE 8** and **CMake** installed.
3. Open the project in your preferred IDE (Xcode/Visual Studio).
4. Build the VST3, AU, or CLAP targets.

## 🔗 Demo
Check out the web standalone here: [multi-trans-bender.vercel.app](https://multi-trans-bender.vercel.app/)

## 📸 Screenshots
*Placeholder: [Engine View]*
*Placeholder: [Panel View]*
*Placeholder: [3D Rack View]*

## 🗺️ Roadmap

- [ ] **Phase 5:** Hardening, pluginval testing, and OS notarization.
- [ ] Full JUCE plugin compilation for real-time hardware performance.
- [ ] Expanded skinning options via the JSON schema.
