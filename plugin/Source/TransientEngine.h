#pragma once

#include <juce_dsp/juce_dsp.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

#include "Devices.h"

/**
 * Real-time transient engine.
 *
 * The same algorithm as the browser engine, with the concessions running inside
 * an audio callback forces:
 *
 *  - Linkwitz-Riley IIR crossovers only. The linear-phase FIR split the offline
 *    renderer uses is non-causal, so it cannot exist here.
 *  - Lookahead is a real delay on the audio path with the latency reported to
 *    the host, instead of the offline trick of reading the control signal ahead.
 *  - No allocation, no locks, no denormals in the process block.
 *
 * Everything else — the differential detector, the release-ratio requirement,
 * the soft knee, the ten saturation cores, and the peak alignment below — is
 * deliberately identical.
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

    void setSampleRate (double sampleRate) noexcept { sr = sampleRate; }
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

/**
 * Causal sliding-window extremum over a monotonic deque.
 *
 * This is the real-time counterpart to the offline engine's `forwardExtremum`,
 * and it exists for the same reason. A differential detector reaches maximum
 * divergence roughly one attack time-constant *after* an onset, so a gain
 * reduction applied at face value lands on the body of a hit and misses the peak
 * — turning attack *down* makes a signal more peaky, not less. Because the audio
 * is already delayed by the lookahead, taking the extremum of the control signal
 * over the last W samples puts the shaping in place before the peak it controls
 * arrives at the output. Amortised O(1) per sample, no allocation.
 */
class SlidingExtremum
{
public:
    static constexpr int capacity = 4096;

    void prepare (int windowSamples, bool takeMaximum) noexcept
    {
        window = juce::jlimit (1, capacity - 1, windowSamples);
        maximum = takeMaximum;
        reset();
    }

    void reset() noexcept
    {
        head = tail = 0;
        index = 0;
    }

    float process (float x) noexcept
    {
        // Drop entries that can never win again.
        while (tail != head)
        {
            const auto back = (tail - 1 + capacity) % capacity;
            const auto beaten = maximum ? values[static_cast<size_t> (back)] <= x
                                        : values[static_cast<size_t> (back)] >= x;
            if (! beaten)
                break;
            tail = back;
        }

        values[static_cast<size_t> (tail)] = x;
        stamps[static_cast<size_t> (tail)] = index;
        tail = (tail + 1) % capacity;

        // Retire entries that have fallen out of the window.
        while (head != tail && stamps[static_cast<size_t> (head)] + window < index)
            head = (head + 1) % capacity;

        ++index;
        return values[static_cast<size_t> (head)];
    }

private:
    std::array<float, capacity> values {};
    std::array<long long, capacity> stamps {};
    int head = 0, tail = 0, window = 1;
    long long index = 0;
    bool maximum = true;
};

/** Soft-knee half-wave rectifier in dB. */
inline float softRectify (float x, float knee) noexcept
{
    if (knee <= 0.0f)
        return x > 0.0f ? x : 0.0f;
    const auto half = knee * 0.5f;
    if (x <= -half) return 0.0f;
    if (x >= half)  return x;
    const auto t = x + half;
    return (t * t) / (2.0f * knee);
}

// ---------------------------------------------------------------------------
// Saturation primitives. Every curve has f(0) = 0 and f'(0) = 1, so engaging an
// engine changes tone and density but not level.
// ---------------------------------------------------------------------------

inline float asymTanh (float x, float bias) noexcept
{
    const auto ch = std::cosh (bias);
    const auto sech2 = 1.0f / (ch * ch);
    return (std::tanh (x + bias) - std::tanh (bias)) / sech2;
}

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

inline float diodeCurve (float x, float asym) noexcept
{
    const auto k = 1.0f + std::max (asym, 0.0f) * 3.0f;
    return x >= 0.0f ? 1.0f - std::exp (-x) : -(1.0f - std::exp (x * k)) / k;
}

/**
 * Simplified Koren-style valve stage. A real triode conducts one way and cuts
 * off the other, and that asymmetry is where valve second harmonic comes from,
 * so the model keeps it rather than approximating with a symmetric curve.
 */
inline float valveStage (float x, float bias, float pentode) noexcept
{
    const auto shifted = x + bias;
    const auto soft = asymTanh (shifted, 0.0f) - asymTanh (bias, 0.0f);
    const auto hard = cubicClip (shifted * 1.3f) - cubicClip (bias * 1.3f);
    const auto blended = soft * (1.0f - pentode) + hard * pentode;
    const auto ch = std::cosh (bias);
    const auto slope = (1.0f - pentode) / (ch * ch)
                     + pentode * 1.3f * (1.0f - bias * bias * 1.69f);
    return blended / std::max (slope, 0.05f);
}

/** Per-band state: detector, envelopes, alignment, and the saturation stage. */
struct BandState
{
    /** Stereo is the widest layout the processor accepts. */
    static constexpr int maxChannels = 2;

    void prepare (double sampleRate, int numChannels)
    {
        sr = sampleRate;
        channels = juce::jlimit (1, maxChannels, numChannels);

        detectorHpf.reset();
        fast.prepare (sampleRate, 2.0f, 120.0f);
        slow.prepare (sampleRate, 40.0f, 480.0f);
        susFast.prepare (sampleRate, 2.0f, 200.0f);
        susSlow.prepare (sampleRate, 2.0f, 1600.0f);

        smoothCoeff = std::exp (-1.0f / static_cast<float> (sampleRate * 0.0015));
        smoothed = 0.0f;
        rmsState = 0.0f;
        rmsCoeff = std::exp (-1.0f / static_cast<float> (sampleRate * 0.003));

        for (auto& f : voice)
        {
            f.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass (sampleRate, 220.0f);
            f.reset();
        }
        for (auto& f : voice2)
        {
            f.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass (sampleRate, 2500.0f);
            f.reset();
        }
        dcX1.fill (0.0f);
        dcY1.fill (0.0f);
        dcR = 1.0f - (2.0f * juce::MathConstants<float>::pi * 5.0f / static_cast<float> (sampleRate));
        sag = 0.0f;
        sagCoeff = std::exp (-1.0f / static_cast<float> (sampleRate * 0.05));
        align.prepare (1, true);
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

    /** Configure the peak-alignment window. Must match the audio delay in use. */
    void setAlignment (int windowSamples, bool takeMaximum) noexcept
    {
        if (windowSamples != alignWindow || takeMaximum != alignMax)
        {
            alignWindow = windowSamples;
            alignMax = takeMaximum;
            align.prepare (windowSamples, takeMaximum);
        }
    }

    /** Stereo-linked detector value: hybrid peak/RMS, matching the offline engine. */
    float detect (const float* const* bandData, int channelCount, int sample) noexcept
    {
        float peak = 0.0f;
        for (int c = 0; c < channelCount; ++c)
            peak = std::max (peak, std::abs (bandData[c][sample]));

        const auto value = std::abs (detectorHpf.processSample (peak));
        const auto sq = value * value;
        rmsState = sq + rmsCoeff * (rmsState - sq);
        const auto rms = std::sqrt (std::max (rmsState, 0.0f));
        return 0.5f * value + 0.5f * rms;
    }

    /** Gain in dB for this sample, already peak-aligned. */
    float computeGainDb (float detector, float attackDb, float sustainDb) noexcept
    {
        const auto fastEnv = fast.process (detector);
        const auto slowEnv = slow.process (detector);
        const auto susFastEnv = susFast.process (detector);
        const auto susSlowEnv = susSlow.process (detector);

        float gainDb = 0.0f;

        if (std::abs (attackDb) > 0.0f)
        {
            const auto divergence = softRectify (gainToDb (fastEnv) - gainToDb (slowEnv), kneeDb);
            gainDb += attackDb * std::min (divergence / referenceDb, 1.0f);
        }

        if (std::abs (sustainDb) > 0.0f)
        {
            const auto divergence = softRectify (gainToDb (susSlowEnv) - gainToDb (susFastEnv), kneeDb);
            gainDb += sustainDb * std::min (divergence / referenceDb, 1.0f);
        }

        smoothed = gainDb + smoothCoeff * (smoothed - gainDb);
        return align.process (smoothed);
    }

    /** The ten cores, matching src/dsp/saturation.ts. */
    float saturate (float x, int channel, const DeviceModel& device,
                    float drive, float character) noexcept
    {
        if (drive <= 0.0001f)
            return x;

        const auto ch = static_cast<size_t> (juce::jlimit (0, maxChannels - 1, channel));
        const auto g = 1.0f + drive * device.driveDepth;
        const auto bias = device.bias;
        const auto h2 = device.calibration[0];
        const auto h3 = device.calibration[1];
        float y = x;

        switch (device.core)
        {
            case Core::valveTwin:
            {
                const auto level = std::abs (x);
                sag = level + sagCoeff * (sag - level);
                const auto dynamicBias = bias * h2 * (1.0f - std::min (sag, 1.0f) * 0.55f);
                y = voice[ch].processSample (valveStage (g * x, dynamicBias, character) / g);
                break;
            }
            case Core::tapeTranny:
            {
                const auto low = voice[ch].processSample (x);
                const auto tape = tapeCurve (g * x) / g;
                const auto iron = tapeCurve (g * 1.4f * low) / (g * 1.4f) + (x - low);
                y = tape * (1.0f - character) + iron * character;
                break;
            }
            case Core::pentodeTriode:
            {
                const auto pent = cubicClip (g * x) / g;
                const auto tri = asymTanh (g * x, bias * h2) / g;
                y = pent * (1.0f - character) + tri * character;
                break;
            }
            case Core::programTube:
            {
                // Emphasise, saturate, de-emphasise: only the tuned band is
                // driven hard, so the rest of the spectrum stays clean.
                const auto low = voice2[ch].processSample (x);
                const auto emphasised = x + (x - low) * character * drive * 1.5f;
                y = asymTanh (g * emphasised, bias * h2) / g;
                break;
            }
            case Core::tapeSilk:
            {
                const auto tape = tapeCurve (g * x) / g;
                y = asymTanh (g * 0.6f * tape, bias * h2) / (g * 0.6f);
                break;
            }
            case Core::tubeTransformer:
            {
                const auto tube = asymTanh (g * x, bias * h2) / g;
                const auto low = voice[ch].processSample (tube);
                const auto drivenIron = tapeCurve (g * (1.0f + character * 2.0f) * low)
                                      / (g * (1.0f + character * 2.0f));
                y = drivenIron * character + low * (1.0f - character) + (tube - low);
                break;
            }
            case Core::warmLpf:
            {
                y = voice2[ch].processSample (asymTanh (g * x, bias * h3) / g);
                break;
            }
            case Core::evenHarmonic:
            {
                const auto effectiveBias = bias * h2 * (1.0f - character);
                const auto even = asymTanh (g * x, effectiveBias) / g;
                const auto odd = cubicClip (g * x) / g;
                y = even * (1.0f - character * 0.6f) + odd * character * 0.6f;
                break;
            }
            case Core::bandDrive:
            {
                const auto low = voice[ch].processSample (x);
                const auto lowMid = voice2[ch].processSample (x);
                const auto mid = lowMid - low;
                const auto high = x - lowMid;
                const auto tilt = character * 2.0f - 1.0f;
                const auto gl = g * (1.0f - tilt * 0.6f);
                const auto gh = g * (1.0f + tilt * 0.6f);
                y = asymTanh (gl * low, bias) / gl
                  + asymTanh (g * mid, bias) / g
                  + asymTanh (gh * high, bias) / gh;
                break;
            }
            case Core::fetDiode:
            {
                const auto asym = std::abs (bias);
                const auto dc = diodeCurve (bias * 0.5f, asym);
                const auto fet = cubicClip (g * x + bias * 0.3f) / g - cubicClip (bias * 0.3f) / g;
                const auto dio = (diodeCurve (g * x + bias * 0.5f, asym) - dc) / g;
                y = fet * (1.0f - character) + dio * character;
                break;
            }
        }

        if (std::abs (bias) > 0.0f)
        {
            auto& x1 = dcX1[ch];
            auto& y1 = dcY1[ch];
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
        for (auto& f : voice) f.reset();
        for (auto& f : voice2) f.reset();
        dcX1.fill (0.0f);
        dcY1.fill (0.0f);
        smoothed = 0.0f;
        rmsState = 0.0f;
        sag = 0.0f;
        align.reset();
    }

    double sr = 44100.0;
    int channels = 2;

    EnvelopeFollower fast, slow, susFast, susSlow;
    juce::dsp::IIR::Filter<float> detectorHpf;

    // juce::dsp::IIR::Filter owns a HeapBlock and is non-copyable, so these
    // cannot live in a std::vector that gets assign()ed. Fixed arrays also keep
    // the audio thread away from an allocator.
    std::array<juce::dsp::IIR::Filter<float>, maxChannels> voice;
    std::array<juce::dsp::IIR::Filter<float>, maxChannels> voice2;
    std::array<float, maxChannels> dcX1 {}, dcY1 {};

    SlidingExtremum align;
    int alignWindow = -1;
    bool alignMax = true;

    float dcR = 0.999f;
    float smoothCoeff = 0.0f, smoothed = 0.0f;
    float rmsCoeff = 0.0f, rmsState = 0.0f;
    float sag = 0.0f, sagCoeff = 0.0f;
};

/**
 * Linkwitz-Riley 4th-order splitter with the allpass correction a three-or-more
 * band split requires. Without it the bands sum with a magnitude notch at the
 * upper crossover.
 */
class LinkwitzRileySplitter
{
public:
    void prepare (const juce::dsp::ProcessSpec& spec, int bandCount)
    {
        bands = juce::jlimit (1, maxBands, bandCount);

        for (auto& split : splits)
            for (auto* stage : { &split.lowA, &split.lowB, &split.highA, &split.highB, &split.allpass })
                stage->prepare (spec);

        remainder.setSize (static_cast<int> (spec.numChannels),
                           static_cast<int> (spec.maximumBlockSize));
        sampleRate = spec.sampleRate;
    }

    void setCrossovers (const float* frequencies, int count)
    {
        for (int i = 0; i < juce::jmin (count, static_cast<int> (splits.size())); ++i)
        {
            const auto f = juce::jlimit (20.0f, static_cast<float> (sampleRate * 0.49), frequencies[i]);
            auto& split = splits[static_cast<size_t> (i)];

            // LR4 is two cascaded Butterworth sections, so each direction needs
            // two stages with independent state.
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

    void split (const juce::dsp::AudioBlock<const float>& input,
                std::array<juce::AudioBuffer<float>, maxBands>& output)
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

            // Bands already emitted sit below this crossover and need the
            // matching allpass to stay aligned with the ones still to come.
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

    // Fixed at the maximum so nothing allocates when the band count changes.
    std::array<Split, maxBands - 1> splits;
    juce::AudioBuffer<float> remainder;
    double sampleRate = 44100.0;
    int bands = 3;
};

} // namespace mtb
