#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include <array>

#include "Devices.h"
#include "ProjectStore.h"
#include "TransientEngine.h"

/**
 * MultiTransBend — plugin processor.
 *
 * The plugin's answer to "multi-device" is per-band device assignment: each
 * transient band runs its own device, so the low end can be shaped by one
 * voicing while the top end gets another, all in one instance and all
 * automatable. The offline renderer's other axis — a different device at a
 * different *point* in the file — is the host's job here: automate the band's
 * device parameter and the same thing happens on the timeline.
 */
class MultiTransBendProcessor final : public juce::AudioProcessor
{
public:
    MultiTransBendProcessor();
    ~MultiTransBendProcessor() override = default;

    void prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    // Keeps the double-precision overload visible rather than hidden by the
    // float one, which -Woverloaded-virtual correctly flags.
    using juce::AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MultiTransBend"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return "Default"; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    juce::AudioProcessorValueTreeState& getState() noexcept { return parameters; }
    ProjectStore& getStore() noexcept { return store; }

    /** Gain reduction/boost per band in dB, for the meters. Written by audio, read by UI. */
    float getBandGainDb (int band) const noexcept
    {
        return bandGainDb[static_cast<size_t> (juce::jlimit (0, mtb::maxBands - 1, band))].load();
    }

    static juce::String bandParamId (int band, const char* suffix);

private:
    juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void updateLatency();

    juce::AudioProcessorValueTreeState parameters;

    mtb::LinkwitzRileySplitter splitter;
    std::array<mtb::BandState, mtb::maxBands> bandStates;
    std::array<juce::AudioBuffer<float>, mtb::maxBands> bandBuffers;
    juce::AudioBuffer<float> summed;
    juce::AudioBuffer<float> dryDelayed;

    /**
     * Lookahead as a real delay. Offline the engine reads the control signal
     * ahead instead, which has no latency at all — that option does not exist
     * in a real-time callback, so the audio is delayed and the host is told.
     */
    juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::None> lookaheadDelay { 8192 };
    juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::None> dryDelay { 8192 };

    std::array<std::atomic<float>, mtb::maxBands> bandGainDb {};
    /** Ceiling on BALANCED-mode lookahead, in ms. Keeps reported PDC bounded. */
    static constexpr float maxLookaheadMs = 12.0f;
    int reportedLatency = 0;
    double currentSampleRate = 44100.0;

    ProjectStore store;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MultiTransBendProcessor)
};
