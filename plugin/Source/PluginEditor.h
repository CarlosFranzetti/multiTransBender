#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <memory>
#include <vector>

#include "PluginProcessor.h"

/** Per-band strip: device chooser, the two shaping controls, and timing. */
class BandStrip final : public juce::Component
{
public:
    BandStrip (MultiTransBenderProcessor& processor, int bandIndex);

    void paint (juce::Graphics&) override;
    void resized() override;

    void setGainDb (float db);

private:
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;

    void addRotary (juce::Slider& slider, juce::Label& label, const juce::String& text);

    MultiTransBenderProcessor& proc;
    int index;

    juce::ComboBox deviceBox;
    juce::ToggleButton enabledButton { "On" };
    juce::Slider attack, sustain, attackTime, release, sustainTime, drive, trim;
    juce::Label attackLabel, sustainLabel, attackTimeLabel, releaseLabel, sustainTimeLabel,
        driveLabel, trimLabel, header;

    std::unique_ptr<ComboAttachment> deviceAttachment;
    std::unique_ptr<ButtonAttachment> enabledAttachment;
    std::vector<std::unique_ptr<SliderAttachment>> attachments;

    float gainDb = 0.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BandStrip)
};

class MultiTransBenderEditor final : public juce::AudioProcessorEditor,
                                     private juce::Timer
{
public:
    explicit MultiTransBenderEditor (MultiTransBenderProcessor&);
    ~MultiTransBenderEditor() override = default;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void showBackupMenu();

    MultiTransBenderProcessor& proc;

    juce::Slider bandCount, xover1, xover2, xover3, inputTrim, outputTrim, mix;
    juce::Label bandCountLabel, xover1Label, xover2Label, xover3Label, inputTrimLabel,
        outputTrimLabel, mixLabel, storageLabel;
    juce::ToggleButton bypass { "Bypass" };
    juce::TextButton restoreButton { "Restore backup" };

    std::vector<std::unique_ptr<BandStrip>> strips;

    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;
    std::vector<std::unique_ptr<SliderAttachment>> attachments;
    std::unique_ptr<ButtonAttachment> bypassAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MultiTransBenderEditor)
};
