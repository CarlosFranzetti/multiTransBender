#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
constexpr int defaultBandCount = 3;

const char* const bandSuffixes[] = { "attack", "sustain", "attackTime", "release",
                                     "sustainTime", "drive", "trim", "device", "enabled" };
} // namespace

juce::String MultiTransBendProcessor::bandParamId (int band, const char* suffix)
{
    return juce::String ("band") + juce::String (band + 1) + "_" + suffix;
}

MultiTransBendProcessor::MultiTransBendProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "MultiTransBend", createLayout())
{
    juce::ignoreUnused (bandSuffixes);
    for (auto& value : bandGainDb)
        value.store (0.0f);
}

juce::AudioProcessorValueTreeState::ParameterLayout MultiTransBendProcessor::createLayout()
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout layout;

    StringArray deviceNames;
    for (const auto& device : mtb::devices)
        deviceNames.add (String (std::string (device.name)));

    layout.add (std::make_unique<AudioParameterInt> (
        ParameterID { "bandCount", 1 }, "Bands", 1, mtb::maxBands, defaultBandCount));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "xover1", 1 }, "Crossover 1",
        NormalisableRange<float> (30.0f, 2000.0f, 1.0f, 0.35f), 140.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "xover2", 1 }, "Crossover 2",
        NormalisableRange<float> (200.0f, 8000.0f, 1.0f, 0.35f), 1400.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "xover3", 1 }, "Crossover 3",
        NormalisableRange<float> (1000.0f, 16000.0f, 1.0f, 0.35f), 6000.0f));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "inputTrim", 1 }, "Input Trim",
        NormalisableRange<float> (-24.0f, 24.0f, 0.1f), 0.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "outputTrim", 1 }, "Output Trim",
        NormalisableRange<float> (-24.0f, 24.0f, 0.1f), 0.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "mix", 1 }, "Mix", NormalisableRange<float> (0.0f, 1.0f, 0.001f), 1.0f));
    layout.add (std::make_unique<AudioParameterBool> (
        ParameterID { "bypass", 1 }, "Bypass", false));

    // prd.md 3.5. HQ LINEAR is offline-only — a linear-phase crossover is
    // non-causal — so the real-time build offers the two causal modes.
    //
    // BALANCED is the default even though ZERO adds no latency, because the
    // 64-sample lookahead is what lets the control signal be aligned with the
    // peak it acts on. Without it, turning attack down makes a signal peakier
    // rather than flatter: the detector's maximum divergence arrives after the
    // onset, so an unaligned cut lands on the body of a hit and misses its peak.
    // 1.3 ms of reported latency is a better default than a control that does
    // not do what its label says.
    layout.add (std::make_unique<AudioParameterChoice> (
        ParameterID { "latencyMode", 1 }, "Latency Mode",
        StringArray { "ZERO", "BALANCED" }, 1));

    for (int band = 0; band < mtb::maxBands; ++band)
    {
        const auto label = "Band " + juce::String (band + 1) + " ";

        layout.add (std::make_unique<AudioParameterChoice> (
            ParameterID { bandParamId (band, "device"), 1 }, label + "Device", deviceNames, 0));
        layout.add (std::make_unique<AudioParameterBool> (
            ParameterID { bandParamId (band, "enabled"), 1 }, label + "Enabled", true));
        // Real units, matching prd.md 3.1 and the offline engine: +-15 dB attack,
        // +-24 dB sustain. Automation lanes then read in dB rather than in an
        // abstract 0-1 that means something different per band.
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "attack"), 1 }, label + "Attack",
            NormalisableRange<float> (-mtb::attackRangeDb, mtb::attackRangeDb, 0.01f), 0.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "sustain"), 1 }, label + "Sustain",
            NormalisableRange<float> (-mtb::sustainRangeDb, mtb::sustainRangeDb, 0.01f), 0.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "detail"), 1 }, label + "Detail",
            NormalisableRange<float> (0.0f, 1.0f, 0.001f), 0.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "character"), 1 }, label + "Character",
            NormalisableRange<float> (0.0f, 1.0f, 0.001f), 0.5f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "satMix"), 1 }, label + "Sat Mix",
            NormalisableRange<float> (0.0f, 1.0f, 0.001f), 0.7f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "bandMix"), 1 }, label + "Band Mix",
            NormalisableRange<float> (0.0f, 1.0f, 0.001f), 1.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "attackTime"), 1 }, label + "Attack Time",
            NormalisableRange<float> (0.2f, 30.0f, 0.01f, 0.4f), band == 0 ? 6.0f : (band == 1 ? 2.5f : 1.2f)));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "release"), 1 }, label + "Release",
            NormalisableRange<float> (10.0f, 600.0f, 1.0f, 0.5f), band == 0 ? 180.0f : 120.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "sustainTime"), 1 }, label + "Sustain Time",
            NormalisableRange<float> (20.0f, 1200.0f, 1.0f, 0.5f), 200.0f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "drive"), 1 }, label + "Drive",
            NormalisableRange<float> (0.0f, 1.0f, 0.001f), 0.4f));
        layout.add (std::make_unique<AudioParameterFloat> (
            ParameterID { bandParamId (band, "trim"), 1 }, label + "Output",
            NormalisableRange<float> (-mtb::outputRangeDb, mtb::outputRangeDb, 0.1f), 0.0f));
    }

    return layout;
}

void MultiTransBendProcessor::prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock)
{
    currentSampleRate = sampleRate;

    juce::dsp::ProcessSpec spec {};
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = static_cast<juce::uint32> (maximumExpectedSamplesPerBlock);
    spec.numChannels = static_cast<juce::uint32> (juce::jmax (1, getTotalNumOutputChannels()));

    splitter.prepare (spec, mtb::maxBands);

    for (auto& state : bandStates)
    {
        state.prepare (sampleRate, static_cast<int> (spec.numChannels));
        state.setDetector (sampleRate, 25.0f);
    }

    for (auto& buffer : bandBuffers)
        buffer.setSize (static_cast<int> (spec.numChannels), maximumExpectedSamplesPerBlock);

    summed.setSize (static_cast<int> (spec.numChannels), maximumExpectedSamplesPerBlock);
    dryDelayed.setSize (static_cast<int> (spec.numChannels), maximumExpectedSamplesPerBlock);

    const auto maxDelay = static_cast<int> (sampleRate * 0.02) + 4;

    // Every band needs its own delay line. They all delay by the same amount,
    // but they carry different audio — sharing one line means each band's pushes
    // displace the others' and every band reads back the wrong signal.
    auto bandSpec = spec;
    bandSpec.numChannels = static_cast<juce::uint32> (spec.numChannels * mtb::maxBands);
    lookaheadDelay.setMaximumDelayInSamples (maxDelay);
    lookaheadDelay.prepare (bandSpec);

    dryDelay.setMaximumDelayInSamples (maxDelay);
    dryDelay.prepare (spec);

    updateLatency();
}

void MultiTransBendProcessor::releaseResources()
{
    splitter.reset();
    for (auto& state : bandStates)
        state.reset();
    lookaheadDelay.reset();
    dryDelay.reset();
}

bool MultiTransBendProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainInputChannelSet() == out;
}

void MultiTransBendProcessor::updateLatency()
{
    // One delay line is shared by every band, so they stay time-aligned with
    // each other and the host compensates once.
    //
    // The lookahead tracks the slowest band's attack time rather than sitting at
    // a fixed 64 samples. A differential detector reaches full divergence about
    // one attack time-constant after an onset, so the window has to be at least
    // that long or the alignment cannot reach the peak it is meant to control —
    // which is precisely the case where "attack down" stops working. tdd.md 3
    // gives 64 samples as illustrative and asks for it to be tuned; this is that
    // tuning, expressed as a rule instead of a constant.
    const auto balanced = parameters.getRawParameterValue ("latencyMode")->load() > 0.5f;

    float longestAttackMs = 0.0f;
    for (int band = 0; band < mtb::maxBands; ++band)
        longestAttackMs = juce::jmax (
            longestAttackMs,
            parameters.getRawParameterValue (bandParamId (band, "attackTime"))->load());

    // Two time-constants: the fast envelope is still pulling away from the slow
    // one at 1 tau, so a window of exactly tau clips the divergence before it
    // peaks and the alignment lands short.
    const auto lookaheadMs = juce::jlimit (1.0f, maxLookaheadMs, longestAttackMs * 2.0f);
    const auto samples = balanced
        ? static_cast<int> (std::round (lookaheadMs * 0.001 * currentSampleRate))
        : 0;

    if (samples != reportedLatency)
    {
        reportedLatency = samples;
        setLatencySamples (samples);
    }
}

void MultiTransBendProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const auto numChannels = juce::jmin (getTotalNumInputChannels(), getTotalNumOutputChannels());
    const auto numSamples = buffer.getNumSamples();

    for (int c = numChannels; c < buffer.getNumChannels(); ++c)
        buffer.clear (c, 0, numSamples);

    if (numChannels == 0 || numSamples == 0)
        return;

    if (parameters.getRawParameterValue ("bypass")->load() > 0.5f)
        return;

    updateLatency();

    const auto bandCount = juce::jlimit (
        1, mtb::maxBands,
        static_cast<int> (parameters.getRawParameterValue ("bandCount")->load()));

    const float crossovers[3] = {
        parameters.getRawParameterValue ("xover1")->load(),
        parameters.getRawParameterValue ("xover2")->load(),
        parameters.getRawParameterValue ("xover3")->load(),
    };

    splitter.prepare ({ currentSampleRate,
                        static_cast<juce::uint32> (numSamples),
                        static_cast<juce::uint32> (numChannels) },
                      bandCount);
    splitter.setCrossovers (crossovers, bandCount - 1);

    // Keep an aligned dry copy for the mix control.
    dryDelayed.setSize (numChannels, numSamples, false, false, true);
    for (int c = 0; c < numChannels; ++c)
        dryDelayed.copyFrom (c, 0, buffer, c, 0, numSamples);

    const auto inputGain = mtb::dbToGain (parameters.getRawParameterValue ("inputTrim")->load());
    buffer.applyGain (inputGain);

    juce::dsp::AudioBlock<const float> inputBlock (buffer);
    splitter.split (inputBlock, bandBuffers);

    summed.setSize (numChannels, numSamples, false, false, true);
    summed.clear();

    const auto lookaheadSamples = static_cast<float> (reportedLatency);

    for (int band = 0; band < bandCount; ++band)
    {
        auto& state = bandStates[static_cast<size_t> (band)];
        auto& bandBuffer = bandBuffers[static_cast<size_t> (band)];

        const auto enabled = parameters.getRawParameterValue (bandParamId (band, "enabled"))->load() > 0.5f;
        if (! enabled)
            continue;

        const auto deviceIndex = static_cast<int> (
            parameters.getRawParameterValue (bandParamId (band, "device"))->load());
        const auto& device = mtb::deviceAt (deviceIndex);

        const auto attackDb = parameters.getRawParameterValue (bandParamId (band, "attack"))->load();
        const auto sustainDb = parameters.getRawParameterValue (bandParamId (band, "sustain"))->load();
        const auto attackTime = parameters.getRawParameterValue (bandParamId (band, "attackTime"))->load();
        const auto release = parameters.getRawParameterValue (bandParamId (band, "release"))->load();
        const auto sustainTime = parameters.getRawParameterValue (bandParamId (band, "sustainTime"))->load();
        const auto drive = parameters.getRawParameterValue (bandParamId (band, "drive"))->load();
        const auto character = parameters.getRawParameterValue (bandParamId (band, "character"))->load();
        const auto satMix = parameters.getRawParameterValue (bandParamId (band, "satMix"))->load();
        const auto bandMix = parameters.getRawParameterValue (bandParamId (band, "bandMix"))->load();
        const auto trim = mtb::dbToGain (parameters.getRawParameterValue (bandParamId (band, "trim"))->load());

        state.setTimes (attackTime, release, sustainTime);
        state.setDetector (currentSampleRate, 25.0f);

        // Align the control signal with the peak it acts on. The window matches
        // the audio delay, so the shaping is in place by the time the peak
        // reaches the output. Direction follows the sign of the attack control:
        // a boost wants the maximum over the window, a cut wants the minimum.
        state.setAlignment (juce::jmax (1, reportedLatency), attackDb >= 0.0f);

        auto* const* readPointers = bandBuffer.getArrayOfReadPointers();
        auto* const* writePointers = bandBuffer.getArrayOfWritePointers();

        float peakGain = 0.0f;

        for (int i = 0; i < numSamples; ++i)
        {
            const auto detector = state.detect (readPointers, numChannels, i);
            const auto gainDb = state.computeGainDb (detector, attackDb, sustainDb);
            if (std::abs (gainDb) > std::abs (peakGain))
                peakGain = gainDb;

            const auto gain = mtb::dbToGain (gainDb);

            for (int c = 0; c < numChannels; ++c)
            {
                // Delay the audio so the control signal, derived from the
                // undelayed stream, is already in place when the peak arrives.
                const auto line = band * numChannels + c;
                lookaheadDelay.pushSample (line, writePointers[c][i]);
                const auto delayed = lookaheadDelay.popSample (line, lookaheadSamples, true);

                const auto shaped = delayed * gain;
                const auto saturated =
                    state.saturate (shaped, c, device, drive, character) * satMix
                    + shaped * (1.0f - satMix);
                writePointers[c][i] = (saturated * trim) * bandMix + delayed * (1.0f - bandMix);
            }
        }

        bandGainDb[static_cast<size_t> (band)].store (peakGain);

        for (int c = 0; c < numChannels; ++c)
            summed.addFrom (c, 0, bandBuffer, c, 0, numSamples);
    }

    const auto outputGain = mtb::dbToGain (parameters.getRawParameterValue ("outputTrim")->load());
    const auto mix = juce::jlimit (0.0f, 1.0f, parameters.getRawParameterValue ("mix")->load());

    for (int c = 0; c < numChannels; ++c)
    {
        auto* out = buffer.getWritePointer (c);
        const auto* wet = summed.getReadPointer (c);
        const auto* dry = dryDelayed.getReadPointer (c);

        for (int i = 0; i < numSamples; ++i)
        {
            // The dry path takes the same delay as the wet one, so the blend
            // stays phase-correct instead of comb-filtering.
            dryDelay.pushSample (c, dry[i]);
            const auto dryDelayedSample = dryDelay.popSample (c, lookaheadSamples, true);
            out[i] = (wet[i] * outputGain) * mix + dryDelayedSample * (1.0f - mix);
        }
    }
}

juce::AudioProcessorEditor* MultiTransBendProcessor::createEditor()
{
    return new MultiTransBendEditor (*this);
}

void MultiTransBendProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto state = parameters.copyState(); state.isValid())
    {
        if (auto xml = state.createXml())
            copyXmlToBinary (*xml, destData);

        // Rolling backup on the local disk. Cheap here, and it means a crash or
        // a mis-click never costs more than the last three states.
        store.writeBackup (state);
    }
}

void MultiTransBendProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        const auto tree = juce::ValueTree::fromXml (*xml);
        if (tree.isValid())
            parameters.replaceState (tree);
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MultiTransBendProcessor();
}
