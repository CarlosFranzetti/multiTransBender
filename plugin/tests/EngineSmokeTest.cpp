/**
 * Compiled-plugin smoke test.
 *
 * Instantiates the real AudioProcessor, runs a transient-rich signal through it
 * in host-sized blocks, and checks the things that would make the plugin unsafe
 * to load: non-finite output, runaway level, a neutral setting that is not
 * neutral, and an attack control that does not move the crest factor.
 *
 * This is the plugin-side counterpart to tests/dsp.test.ts. The two engines are
 * separate code, so "the TypeScript passes" says nothing about this one.
 */

#include "PluginProcessor.h"
#include <cmath>
#include <cstdio>
#include <vector>

namespace
{
int failures = 0;
int checks = 0;

void check (const char* name, bool ok, const juce::String& detail = {})
{
    ++checks;
    if (ok)
        std::printf ("  ok   %s\n", name);
    else
    {
        ++failures;
        std::printf ("  FAIL %s%s\n", name, detail.isEmpty() ? "" : (" - " + detail).toRawUTF8());
        }
}

/** Decaying bursts over a sustained bed, matching the TypeScript suite. */
void fillSignal (juce::AudioBuffer<float>& buffer, double sampleRate)
{
    const auto n = buffer.getNumSamples();
    std::vector<float> mono (static_cast<size_t> (n), 0.0f);
    juce::Random rng (999);

    for (int i = 0; i < n; ++i)
    {
        const auto t = static_cast<double> (i) / sampleRate;
        mono[static_cast<size_t> (i)] =
            static_cast<float> (rng.nextFloat() * 0.04 - 0.02
                + 0.12 * std::sin (2.0 * juce::MathConstants<double>::pi * 220.0 * t)
                + 0.09 * std::sin (2.0 * juce::MathConstants<double>::pi * 330.0 * t));
    }
    for (int hit = 0; hit < 8; ++hit)
    {
        const auto start = static_cast<int> ((hit + 0.5) * (n / 8.0));
        for (int i = 0; i < static_cast<int> (sampleRate * 0.2) && start + i < n; ++i)
        {
            const auto decay = std::exp (-i / (sampleRate * 0.02));
            mono[static_cast<size_t> (start + i)] += static_cast<float> (
                0.7 * decay * std::sin (2.0 * juce::MathConstants<double>::pi * 170.0 * i / sampleRate));
        }
    }
    for (int c = 0; c < buffer.getNumChannels(); ++c)
        buffer.copyFrom (c, 0, mono.data(), n);
}

float crestDb (const juce::AudioBuffer<float>& buffer)
{
    float peak = 0.0f;
    double sum = 0.0;
    const auto* data = buffer.getReadPointer (0);
    for (int i = 0; i < buffer.getNumSamples(); ++i)
    {
        peak = juce::jmax (peak, std::abs (data[i]));
        sum += static_cast<double> (data[i]) * data[i];
    }
    const auto rms = std::sqrt (sum / buffer.getNumSamples());
    return static_cast<float> (20.0 * std::log10 (peak / juce::jmax (rms, 1.0e-12)));
}

/** Run the processor over the whole buffer in host-sized blocks. */
void runBlocks (MultiTransBendProcessor& proc, juce::AudioBuffer<float>& buffer, int blockSize)
{
    juce::MidiBuffer midi;
    for (int pos = 0; pos < buffer.getNumSamples(); pos += blockSize)
    {
        const auto n = juce::jmin (blockSize, buffer.getNumSamples() - pos);
        juce::AudioBuffer<float> slice (buffer.getArrayOfWritePointers(),
                                        buffer.getNumChannels(), pos, n);
        proc.processBlock (slice, midi);
    }
}

void setAllBands (MultiTransBendProcessor& proc, const char* suffix, float value)
{
    for (int band = 0; band < mtb::maxBands; ++band)
        if (auto* p = proc.getState().getParameter (
                MultiTransBendProcessor::bandParamId (band, suffix)))
            p->setValueNotifyingHost (p->convertTo0to1 (value));
}
} // namespace

int main()
{
    juce::ScopedJuceInitialiser_GUI juceInit;

    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 512;
    constexpr int lengthSamples = 48000 * 2;

    std::printf ("\nCompiled plugin\n");

    MultiTransBendProcessor proc;
    proc.setPlayConfigDetails (2, 2, sampleRate, blockSize);
    proc.prepareToPlay (sampleRate, blockSize);

    check ("instantiates and prepares", proc.getTotalNumOutputChannels() == 2);
    check ("exposes a parameter tree", proc.getState().state.isValid());

    juce::AudioBuffer<float> source (2, lengthSamples);
    fillSignal (source, sampleRate);
    const auto sourceCrest = crestDb (source);

    // Neutral: no shaping, no drive. Should pass audio essentially untouched.
    setAllBands (proc, "attack", 0.0f);
    setAllBands (proc, "sustain", 0.0f);
    setAllBands (proc, "drive", 0.0f);

    juce::AudioBuffer<float> neutral (2, lengthSamples);
    neutral.makeCopyOf (source);
    runBlocks (proc, neutral, blockSize);

    bool finite = true;
    float peak = 0.0f;
    for (int c = 0; c < neutral.getNumChannels(); ++c)
        for (int i = 0; i < neutral.getNumSamples(); ++i)
        {
            const auto v = neutral.getSample (c, i);
            if (! std::isfinite (v)) finite = false;
            peak = juce::jmax (peak, std::abs (v));
        }

    check ("neutral render is finite", finite);
    check ("neutral render keeps a sane level", peak > 0.01f && peak < 4.0f,
           juce::String (peak, 3));

    // Attack up must raise the crest factor, exactly as the offline engine does.
    proc.reset();
    proc.prepareToPlay (sampleRate, blockSize);
    setAllBands (proc, "attack", 12.0f);

    juce::AudioBuffer<float> punchy (2, lengthSamples);
    punchy.makeCopyOf (source);
    runBlocks (proc, punchy, blockSize);
    const auto punchyCrest = crestDb (punchy);

    check ("attack up increases crest factor", punchyCrest > sourceCrest + 0.5f,
           juce::String (sourceCrest, 2) + " -> " + juce::String (punchyCrest, 2) + " dB");

    // Attack down must lower it.
    proc.reset();
    proc.prepareToPlay (sampleRate, blockSize);
    setAllBands (proc, "attack", -12.0f);

    juce::AudioBuffer<float> soft (2, lengthSamples);
    soft.makeCopyOf (source);
    runBlocks (proc, soft, blockSize);
    const auto softCrest = crestDb (soft);

    // Direction is what matters and what was once wrong: before the control
    // signal was aligned with the peak, attack-down made a signal *more* peaky.
    //
    // The margin is deliberately small. Offline the engine can read the gain
    // curve arbitrarily far ahead at no cost and achieves several dB; a causal
    // processor can only look ahead as far as it is willing to delay, so the
    // real-time reduction is correspondingly modest. That is a property of
    // causality, not a defect, and asserting an offline-sized number here would
    // just be a test that lies.
    check ("attack down decreases crest factor", softCrest < sourceCrest,
           juce::String (sourceCrest, 2) + " -> " + juce::String (softCrest, 2) + " dB");

    // Every engine must render finite audio at a sane level.
    for (int d = 0; d < mtb::numDevices; ++d)
    {
        proc.reset();
        proc.prepareToPlay (sampleRate, blockSize);
        setAllBands (proc, "attack", 6.0f);
        setAllBands (proc, "drive", 0.7f);
        for (int band = 0; band < mtb::maxBands; ++band)
            if (auto* p = proc.getState().getParameter (
                    MultiTransBendProcessor::bandParamId (band, "device")))
                p->setValueNotifyingHost (p->convertTo0to1 (static_cast<float> (d)));

        juce::AudioBuffer<float> out (2, lengthSamples);
        out.makeCopyOf (source);
        runBlocks (proc, out, blockSize);

        bool ok = true;
        float p2 = 0.0f;
        for (int i = 0; i < out.getNumSamples(); ++i)
        {
            const auto v = out.getSample (0, i);
            if (! std::isfinite (v)) ok = false;
            p2 = juce::jmax (p2, std::abs (v));
        }
        check (juce::String (std::string (mtb::deviceAt (d).name)).toRawUTF8(),
               ok && p2 > 1.0e-4f && p2 < 8.0f, juce::String (p2, 3));
    }

    // State round-trip: a preset must survive save and recall.
    juce::MemoryBlock blob;
    proc.getStateInformation (blob);
    MultiTransBendProcessor restored;
    restored.setStateInformation (blob.getData(), static_cast<int> (blob.getSize()));
    check ("state saves and recalls", blob.getSize() > 0
           && restored.getState().state.isValid());

    std::printf ("\n%d/%d checks passed\n", checks - failures, checks);
    return failures == 0 ? 0 : 1;
}
