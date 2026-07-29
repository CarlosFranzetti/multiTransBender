#pragma once

#include <array>
#include <string_view>

/**
 * The ten TRANSBAND saturation engines.
 *
 * Numerically identical to src/dsp/devices.ts. That table is the contract
 * between the offline renderer and this real-time engine: a chain dialled in the
 * browser and the same chain in the plugin must sound the same, so changing one
 * table without the other silently breaks the product's central claim.
 *
 * Original names and original artwork throughout (prd.md §9). These are
 * character models built from published circuit topology and listening, not
 * measurements of hardware — `calibration` is the hook for fitting a real unit
 * later without disturbing the topology (tdd.md §5.2).
 */
namespace mtb
{

/** The nonlinear core an engine is built on. Mirrors SaturationCore in TypeScript. */
enum class Core
{
    valveTwin,     // triode/pentode pair, bias-shifting
    tapeTranny,    // tape softening plus transformer iron
    pentodeTriode, // parallel pentode and triode paths
    programTube,   // programme EQ into a single tube stage
    tapeSilk,      // tape emulation with a silk shelf
    tubeTransformer,
    warmLpf,
    evenHarmonic,
    bandDrive,
    fetDiode,
};

struct DeviceModel
{
    std::string_view id;
    std::string_view name;
    std::string_view sub;
    Core core;
    /** What CHARACTER controls on this engine. */
    std::string_view characterLabel;
    /** Drive multiplier at DRIVE = 1. */
    float driveDepth;
    /** Static asymmetry before CHARACTER modulates it. */
    float bias;
    /** Corner of the engine's own voicing filter, Hz. */
    float toneHz;
    /** Output trim baked into the voicing, dB. */
    float outputTrimDb;
    /** Harmonic calibration weights: 2nd, 3rd, 4th, 5th. */
    std::array<float, 4> calibration;
};

inline constexpr std::array<DeviceModel, 10> devices { {
    { "vulture", "VULTURE", "TWIN VALVE DISTORTION", Core::valveTwin,
      "Triode to pentode bias", 14.0f, 0.35f, 8000.0f, -1.4f, { 1.0f, 0.85f, 0.5f, 0.42f } },

    { "fatso", "PHATSO 7x", "TAPE SIM / OPTIMIZER", Core::tapeTranny,
      "Tape to transformer", 9.0f, 0.12f, 12000.0f, -0.9f, { 0.8f, 1.0f, 0.35f, 0.3f } },

    { "hg2", "HG-II", "PENTODE + TRIODE SAT", Core::pentodeTriode,
      "Pentode to triode blend", 11.0f, 0.2f, 14000.0f, -1.1f, { 1.0f, 0.7f, 0.55f, 0.35f } },

    { "vitalizer", "REVITALIZER", "PROGRAM EQ - TUBE", Core::programTube,
      "Mid-high tune", 7.0f, 0.28f, 3800.0f, -0.7f, { 1.0f, 0.45f, 0.3f, 0.2f } },

    { "portico", "P-542", "TAPE EMULATION - SILK", Core::tapeSilk,
      "Silk blue to red", 8.0f, 0.15f, 9000.0f, -0.8f, { 0.9f, 0.6f, 0.4f, 0.25f } },

    { "glats1", "WIZARD TS-1", "STEREO TUBE SATURATOR", Core::tubeTransformer,
      "Transformer drive", 12.0f, 0.3f, 220.0f, -1.2f, { 1.0f, 0.75f, 0.45f, 0.4f } },

    { "boum", "BOM", "ANALOG WARMING", Core::warmLpf,
      "Analogue lowpass", 10.0f, -0.18f, 7000.0f, -0.6f, { 0.6f, 1.0f, 0.3f, 0.45f } },

    { "sa2rate", "SA2RATE", "EVEN-HARMONIC SAT", Core::evenHarmonic,
      "Even to odd symmetry", 13.0f, 0.5f, 16000.0f, -1.0f, { 1.0f, 0.3f, 0.6f, 0.2f } },

    { "carnaby", "CARNABY", "HARMONIC EQ", Core::bandDrive,
      "Drive tilt, LF to HF", 9.0f, 0.1f, 1000.0f, -0.7f, { 0.85f, 0.8f, 0.4f, 0.3f } },

    { "overstayer", "M-A-S", "HARMONICS / DENSITY", Core::fetDiode,
      "FET to diode", 12.0f, -0.3f, 60.0f, -1.0f, { 0.7f, 1.0f, 0.35f, 0.55f } },
} };

inline constexpr int numDevices = static_cast<int> (devices.size());

inline const DeviceModel& deviceAt (int index) noexcept
{
    const auto clamped = index < 0 ? 0 : (index >= numDevices ? numDevices - 1 : index);
    return devices[static_cast<size_t> (clamped)];
}

/** Divergence in dB that counts as a fully-formed transient. */
inline constexpr float referenceDb = 18.0f;

/** Soft-knee width on the differential rectifier. */
inline constexpr float kneeDb = 4.0f;

/**
 * Slow-envelope ratios.
 *
 * The release ratio is a correctness requirement, not a voicing choice: two
 * one-pole followers sharing a release coefficient decay at the same rate, so
 * once an onset pushes them apart the difference never returns to zero and the
 * detector degenerates into a fixed gain. See src/dsp/envelope.ts.
 */
inline constexpr float slowAttackRatio = 20.0f;
inline constexpr float attackSlowReleaseRatio = 4.0f;
inline constexpr float sustainSlowReleaseRatio = 8.0f;

/** prd.md §3.1 control ranges. */
inline constexpr float attackRangeDb = 15.0f;
inline constexpr float sustainRangeDb = 24.0f;
inline constexpr float outputRangeDb = 12.0f;

inline constexpr int maxBands = 6;

} // namespace mtb
