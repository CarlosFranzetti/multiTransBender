#pragma once

#include <juce_dsp/juce_dsp.h>
#include <algorithm>
#include <cmath>
#include <vector>

#include "Devices.h"

/**
 * Real-time transient engine.
 *
 * This is the same algorithm as the browser engine with the concessions that
 * running inside an audio callback forces:
 *
 *  - Linkwitz-Riley IIR crossover only. The linear-phase FIR split the offline
 *    renderer uses is non-causal; there is no way to have it live.
 *  - Lookahead is a real delay on the audio path with the latency reported to
 *    the host, rather than the offline trick of reading the control signal
 *    ahead. Same sound, but the host has to compensate.
 *  - No allocation, no locks, no denormals in the process block.
 *
 * Everything else — the differential detector, the release-ratio requirement,
 * the soft knee, the saturation curves — is identical, deliberately.
 */
namespace mtb
{

inline float dbToGain (float db) noexcept { return std::pow (10.0f, db * 0.05f); }

inline float gainToDb (float gain) noexcept
{
    return gain > 1.0e-12f ? 20.0f * std::log10 (gain) : -160.0f;
}

/** One-pole follower with independent attack and release. */
class EnvelopeFollower
{
public:
    void prepare (double sampleRate, float attackMs, float releaseMs) noexcept
    {
        sr = sampleRate;
        setAttack (attackMs);
        setRelease (releaseMs);
        env = 0.0f;
    }

    void setAttack (float ms) noexcept { attackCoeff = coeff (ms); }
    void setRelease (float ms) noexcept { releaseCoeff = coeff (ms); }
    void reset() noexcept { env = 0.0f; }

    float process (float x) noexcept
    {
        const auto c = x > env ? attackCoeff : releaseCoeff;
        env = x + c * (env - x);
        if (! std::isfinite (env) || std::abs (env) < 1.0e-30f)
            env = 0.0f;
        return env;
    }

private:
    float coeff (float ms) const noexcept
    {
        const auto t = std::max (ms, 0.001f) * 0.001f;
        return std::exp (-1.0f / static_cast<float> (sr * t));
    }

    double sr = 44100.0;
    float attackCoeff = 0.0f, releaseCoeff = 0.0f, env = 0.0f;
};

/** Soft-knee half-wave rectifier in dB. */
inline float softRectify (float x, float kneeDb) noexcept
{
    if (kneeDb <= 0.0f)
        return x > 0.0f ? x : 0.0f;
    const auto half = kneeDb * 0.5f;
    if (x <= -half) return 0.0f;
    if (x >= half)  return x;
    const auto t = x + half;
    return (t * t) / (2.0f * kneeDb);
}

/** Saturation curves. Unit slope at zero so engaging one changes tone, not level. */
inline float cubicClip (float x) noexcept
{
    if (x >= 1.0f)  return 2.0f / 3.0f;
    if (x <= -1.0f) return -2.0f / 3.0f;
    return x - (x * x * x) / 3.0f;
}

inline float tapeCurve (float x) noexcept
{
    const auto a = std::abs (x);
    return x / std::cbrt (1.0f + a * a * a);
}

inline float tanhNorm (float x, float bias) noexcept
{
    const auto ch = std::cosh (bias);
    const auto sech2 = 1.0f / (ch * ch);
    return (std::tanh (x + bias) - std::tanh (bias)) / sech2;
}

/** Per-band state: crossover filters, detector, envelopes, saturation. */
struct BandState
{
    void prepare (double sampleRate, int numChannels)
    {
        sr = sampleRate;
        channels = numChannels;

        detectorHpf.reset();
        lowSat.assign (static_cast<size_t> (numChannels), juce::dsp::IIR::Filter<float>());

        fast.prepare (sampleRate, 2.0f, 120.0f);
        slow.prepare (sampleRate, 40.0f, 480.0f);
        susFast.prepare (sampleRate, 2.0f, 200.0f);
        susSlow.prepare (sampleRate, 2.0f, 1600.0f);

        smoothCoeff = std::exp (-1.0f / static_cast<float> (sampleRate * 0.0015));
        smoothed = 0.0f;
        rmsState = 0.0f;
        rmsCoeff = std::exp (-1.0f / static_cast<float> (sampleRate * 0.003));

        for (auto& f : lowSat)
        {
            f.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass (sampleRate, 220.0f);
            f.reset();
        }
        dcX1.assign (static_cast<size_t> (numChannels), 0.0f);
        dcY1.assign (static_cast<size_t> (numChannels), 0.0f);
        dcR = 1.0f - (2.0f * juce::MathConstants<float>::pi * 5.0f / static_cast<float> (sampleRate));
    }

    void setTimes (float attackMs, float releaseMs, float sustainMs) noexcept
    {
        fast.setAttack (attackMs);
        fast.setRelease (releaseMs);
        slow.setAttack (attackMs * slowAttackRatio);
        slow.setRelease (releaseMs * attackSlowReleaseRatio);
        susFast.setAttack (attackMs);
        susFast.setRelease (sustainMs);
        susSlow.setAttack (attackMs);
        susSlow.setRelease (sustainMs * sustainSlowReleaseRatio);
    }

    void setDetector (double sampleRate, float hpfHz) noexcept
    {
        detectorHpf.coefficients =
            juce::dsp::IIR::Coefficients<float>::makeHighPass (sampleRate, std::max (hpfHz, 10.0f));
    }

    /** Stereo-linked detector value for this sample. */
    float detect (const float* const* bandData, int channelCount, int sample, DetectorMode mode) noexcept
    {
        float peak = 0.0f;
        for (int c = 0; c < channelCount; ++c)
            peak = std::max (peak, std::abs (bandData[c][sample]));

        auto value = std::abs (detectorHpf.processSample (peak));

        if (mode == DetectorMode::peak)
            return value;

        const auto sq = value * value;
        rmsState = sq + rmsCoeff * (rmsState - sq);
        const auto rms = std::sqrt (std::max (rmsState, 0.0f));

        if (mode == DetectorMode::rms)
            return rms;
        return 0.5f * value + 0.5f * rms;
    }

    float shapeCurve (float t, EnvelopeLaw law) const noexcept
    {
        switch (law)
        {
            case EnvelopeLaw::exponential: return t * t * (3.0f - 2.0f * t);
            case EnvelopeLaw::program:     return std::pow (t, 0.75f);
            default:                       return t;
        }
    }

    /** Gain in dB for this sample. */
    float computeGainDb (float detector, float attack, float sustain,
                         const DeviceModel& device) noexcept
    {
        const auto fastEnv = fast.process (detector);
        const auto slowEnv = slow.process (detector);
        const auto susFastEnv = susFast.process (detector);
        const auto susSlowEnv = susSlow.process (detector);

        float gainDb = 0.0f;

        if (attack != 0.0f)
        {
            const auto divergence = softRectify (gainToDb (fastEnv) - gainToDb (slowEnv), device.kneeDb);
            const auto t = std::min (divergence / referenceDb, 1.0f);
            gainDb += attack * device.attackScaleDb * shapeCurve (t, device.envelopeLaw);
        }

        if (sustain != 0.0f)
        {
            const auto divergence = softRectify (gainToDb (susSlowEnv) - gainToDb (susFastEnv), device.kneeDb);
            const auto t = std::min (divergence / referenceDb, 1.0f);
            gainDb += sustain * device.sustainScaleDb * shapeCurve (t, device.envelopeLaw);
        }

        smoothed = gainDb + smoothCoeff * (smoothed - gainDb);
        return smoothed;
    }

    float saturate (float x, int channel, const DeviceModel& device, float driveMultiplier) noexcept
    {
        const auto drive = std::min (device.saturationDrive * driveMultiplier, 1.0f);
        if (device.saturation == Saturation::none || drive <= 0.001f)
            return x;

        float y = x;
        switch (device.saturation)
        {
            case Saturation::tube:
            {
                const auto g = 1.0f + drive * 6.0f;
                y = tanhNorm (g * x, device.saturationBias * 0.6f) / g;
                break;
            }
            case Saturation::tape:
            {
                const auto g = 1.0f + drive * 8.0f;
                y = tapeCurve (g * x) / g;
                break;
            }
            case Saturation::transformer:
            {
                const auto g = 1.0f + drive * 10.0f;
                const auto low = lowSat[static_cast<size_t> (channel)].processSample (x);
                y = tapeCurve (g * low) / g + (x - low);
                break;
            }
            case Saturation::vca:
            {
                const auto g = 1.0f + drive * 5.0f;
                const auto b = device.saturationBias * 0.35f;
                y = cubicClip (g * x + b) / g - cubicClip (b) / g;
                break;
            }
            case Saturation::diode:
            {
                const auto g = 1.0f + drive * 7.0f;
                const auto k = 1.0f + std::abs (device.saturationBias) * 3.0f;
                auto curve = [k] (float v)
                {
                    return v >= 0.0f ? 1.0f - std::exp (-v)
                                     : -(1.0f - std::exp (v * k)) / k;
                };
                const auto dc = curve (device.saturationBias * 0.5f);
                y = (curve (g * x + device.saturationBias * 0.5f) - dc) / g;
                break;
            }
            default: break;
        }

        if (device.saturationBias != 0.0f)
        {
            auto& x1 = dcX1[static_cast<size_t> (channel)];
            auto& y1 = dcY1[static_cast<size_t> (channel)];
            const auto out = y - x1 + dcR * y1;
            x1 = y;
            y1 = std::abs (out) < 1.0e-30f ? 0.0f : out;
            y = y1;
        }

        return y;
    }

    void reset() noexcept
    {
        fast.reset();
        slow.reset();
        susFast.reset();
        susSlow.reset();
        detectorHpf.reset();
        for (auto& f : lowSat) f.reset();
        std::fill (dcX1.begin(), dcX1.end(), 0.0f);
        std::fill (dcY1.begin(), dcY1.end(), 0.0f);
        smoothed = 0.0f;
        rmsState = 0.0f;
    }

    double sr = 44100.0;
    int channels = 2;

    EnvelopeFollower fast, slow, susFast, susSlow;
    juce::dsp::IIR::Filter<float> detectorHpf;
    std::vector<juce::dsp::IIR::Filter<float>> lowSat;
    std::vector<float> dcX1, dcY1;
    float dcR = 0.999f;
    float smoothCoeff = 0.0f, smoothed = 0.0f;
    float rmsCoeff = 0.0f, rmsState = 0.0f;
};

/**
 * Linkwitz-Riley 4th-order splitter with the allpass correction the offline
 * engine also applies. Without it, a three-band split has a magnitude notch at
 * the upper crossover.
 */
class LinkwitzRileySplitter
{
public:
    void prepare (const juce::dsp::ProcessSpec& spec, int bandCount)
    {
        bands = juce::jlimit (1, maxBands, bandCount);
        splits.clear();

        for (int i = 0; i < bands - 1; ++i)
        {
            Split split;
            for (auto* stage : { &split.lowA, &split.lowB, &split.highA, &split.highB, &split.allpass })
                stage->prepare (spec);
            splits.push_back (std::move (split));
        }

        remainder.setSize (static_cast<int> (spec.numChannels), static_cast<int> (spec.maximumBlockSize));
        sampleRate = spec.sampleRate;
    }

    void setCrossovers (const float* frequencies, int count)
    {
        for (int i = 0; i < juce::jmin (count, static_cast<int> (splits.size())); ++i)
        {
            const auto f = juce::jlimit (20.0f, static_cast<float> (sampleRate * 0.49), frequencies[i]);
            auto& split = splits[static_cast<size_t> (i)];

            // Linkwitz-Riley 4th order is two cascaded Butterworth sections, so
            // each direction needs two stages with independent state.
            const auto low = juce::dsp::IIR::Coefficients<float>::makeLowPass (sampleRate, f);
            const auto high = juce::dsp::IIR::Coefficients<float>::makeHighPass (sampleRate, f);
            *split.lowA.state = *low;
            *split.lowB.state = *low;
            *split.highA.state = *high;
            *split.highB.state = *high;

            // LR4 lowpass + highpass reduces to a single second-order allpass at
            // Q = 1/sqrt(2), so one section is the exact compensator.
            *split.allpass.state = *juce::dsp::IIR::Coefficients<float>::makeAllPass (sampleRate, f);
        }
    }

    void reset()
    {
        for (auto& split : splits)
        {
            split.lowA.reset();
            split.lowB.reset();
            split.highA.reset();
            split.highB.reset();
            split.allpass.reset();
        }
    }

    /**
     * Splits `input` into `output[0..bands-1]`. Each output buffer must already
     * be sized; nothing is allocated here.
     */
    void split (const juce::dsp::AudioBlock<const float>& input,
                std::vector<juce::AudioBuffer<float>>& output)
    {
        const auto numChannels = static_cast<int> (input.getNumChannels());
        const auto numSamples = static_cast<int> (input.getNumSamples());

        remainder.setSize (numChannels, numSamples, false, false, true);
        for (int c = 0; c < numChannels; ++c)
            remainder.copyFrom (c, 0, input.getChannelPointer (static_cast<size_t> (c)), numSamples);

        for (int i = 0; i < bands - 1; ++i)
        {
            auto& split = splits[static_cast<size_t> (i)];
            auto& low = output[static_cast<size_t> (i)];
            low.setSize (numChannels, numSamples, false, false, true);
            for (int c = 0; c < numChannels; ++c)
                low.copyFrom (c, 0, remainder, c, 0, numSamples);

            {
                juce::dsp::AudioBlock<float> block (low);
                juce::dsp::ProcessContextReplacing<float> ctx (block);
                split.lowA.process (ctx);
                split.lowB.process (ctx);
            }
            {
                juce::dsp::AudioBlock<float> block (remainder);
                juce::dsp::ProcessContextReplacing<float> ctx (block);
                split.highA.process (ctx);
                split.highB.process (ctx);
            }

            // Everything already emitted sits below this crossover and needs the
            // matching allpass to stay aligned with the bands still to come.
            for (int j = 0; j < i; ++j)
            {
                juce::dsp::AudioBlock<float> block (output[static_cast<size_t> (j)]);
                juce::dsp::ProcessContextReplacing<float> ctx (block);
                split.allpass.process (ctx);
            }
        }

        auto& top = output[static_cast<size_t> (bands - 1)];
        top.setSize (numChannels, numSamples, false, false, true);
        for (int c = 0; c < numChannels; ++c)
            top.copyFrom (c, 0, remainder, c, 0, numSamples);
    }

    int getBandCount() const noexcept { return bands; }

private:
    using Stage = juce::dsp::ProcessorDuplicator<juce::dsp::IIR::Filter<float>,
                                                 juce::dsp::IIR::Coefficients<float>>;

    struct Split
    {
        Stage lowA, lowB, highA, highB, allpass;
    };

    std::vector<Split> splits;
    juce::AudioBuffer<float> remainder;
    double sampleRate = 44100.0;
    int bands = 3;
};

} // namespace mtb
