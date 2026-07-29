#pragma once

#include <array>
#include <string_view>

/**
 * Device voicings, kept numerically identical to src/dsp/devices.ts.
 *
 * The two implementations are separate code because one has to run in a
 * real-time callback and the other does not, but the numbers here are the
 * contract between them: a chain rendered in the browser and the same chain
 * rendered by the plugin must sound the same. Any change to one table has to be
 * made to the other, and tests/dsp.test.ts is the arbiter of what correct
 * sounds like.
 */
namespace mtb
{

enum class DetectorMode { peak, rms, hybrid };
enum class EnvelopeLaw { linear, exponential, program };
enum class Saturation { none, tube, tape, transformer, vca, diode };

struct DeviceModel
{
    std::string_view id;
    std::string_view name;
    std::string_view blurb;
    DetectorMode detector;
    EnvelopeLaw envelopeLaw;
    float attackScaleDb;
    float sustainScaleDb;
    float kneeDb;
    float detectorHpfHz;
    float detectorTiltDb;
    Saturation saturation;
    float saturationDrive;
    float saturationBias;
    int oversample;
    float outputTrimDb;
    float lookaheadMs;
};

inline constexpr std::array<DeviceModel, 6> devices { {
    { "vitrine", "Vitrine",
      "Glass-clear reference. Pure envelope shaping, no colour, nothing added.",
      DetectorMode::hybrid, EnvelopeLaw::linear,
      14.0f, 12.0f, 3.0f, 25.0f, 0.0f,
      Saturation::none, 0.0f, 0.0f, 1, 0.0f, 1.5f },

    { "aureus", "Aureus",
      "Class-A gold. Soft knee, second-harmonic bloom, forgiving on vocals.",
      DetectorMode::rms, EnvelopeLaw::exponential,
      11.0f, 13.0f, 6.0f, 35.0f, 1.5f,
      Saturation::tube, 0.35f, 0.4f, 4, -0.4f, 2.5f },

    { "ferrite", "Ferrite",
      "Iron and oxide. Slow envelope law, compressed peaks, weighty low end.",
      DetectorMode::rms, EnvelopeLaw::program,
      10.0f, 15.0f, 8.0f, 20.0f, -2.0f,
      Saturation::tape, 0.45f, 0.0f, 4, -0.8f, 3.0f },

    { "obsidian", "Obsidian",
      "Hard, fast, unsentimental. Built for drums that need to cut.",
      DetectorMode::peak, EnvelopeLaw::linear,
      16.0f, 10.0f, 1.0f, 60.0f, 3.0f,
      Saturation::vca, 0.3f, -0.2f, 8, -0.6f, 0.8f },

    { "halcyon", "Halcyon",
      "Programme-dependent and unhurried. Sustain work that never pumps.",
      DetectorMode::rms, EnvelopeLaw::program,
      9.0f, 16.0f, 10.0f, 30.0f, 0.0f,
      Saturation::tube, 0.18f, 0.25f, 2, -0.2f, 4.0f },

    { "prism", "Prism",
      "The multi-band specialist. Wide bands, minimal colour, surgical splits.",
      DetectorMode::hybrid, EnvelopeLaw::exponential,
      13.0f, 13.0f, 4.0f, 25.0f, 1.0f,
      Saturation::transformer, 0.22f, 0.0f, 4, -0.3f, 2.0f },
} };

inline constexpr int numDevices = static_cast<int> (devices.size());

inline const DeviceModel& deviceAt (int index) noexcept
{
    return devices[static_cast<size_t> (index < 0 ? 0 : (index >= numDevices ? numDevices - 1 : index))];
}

/** Divergence in dB that counts as a fully-formed transient. Mirrors the engine. */
inline constexpr float referenceDb = 18.0f;

/** Slow-envelope ratios. See src/dsp/envelope.ts for why the release ratio exists. */
inline constexpr float slowAttackRatio = 20.0f;
inline constexpr float attackSlowReleaseRatio = 4.0f;
inline constexpr float sustainSlowReleaseRatio = 8.0f;

inline constexpr int maxBands = 4;

} // namespace mtb
