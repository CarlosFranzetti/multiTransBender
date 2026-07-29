#include "PluginEditor.h"

namespace
{
const juce::Colour background { 0xff08090b };
const juce::Colour surface { 0xff14171b };
const juce::Colour line { 0x14ffffff };
const juce::Colour textColour { 0xffe9ebee };
const juce::Colour dimText { 0xff9aa1aa };
// Azure accent, matching the web app's chrome.
const juce::Colour accentColour { 0xff4da3ff };

juce::Colour deviceColour (int index)
{
    static const juce::Colour palette[] = {
        juce::Colour (0xff8ec5ff), juce::Colour (0xffe8b04b), juce::Colour (0xffc2705a),
        juce::Colour (0xffa78bfa), juce::Colour (0xff6ee7b7), juce::Colour (0xfff472b6),
    };
    return palette[juce::jlimit (0, 5, index)];
}
} // namespace

// ---------------------------------------------------------------------------

BandStrip::BandStrip (MultiTransBendProcessor& owner, int bandIndex)
    : proc (owner), index (bandIndex)
{
    auto& state = proc.getState();

    header.setText ("Band " + juce::String (index + 1), juce::dontSendNotification);
    header.setColour (juce::Label::textColourId, textColour);
    header.setFont (juce::FontOptions (13.0f).withStyle ("Bold"));
    addAndMakeVisible (header);

    for (int i = 0; i < mtb::numDevices; ++i)
        deviceBox.addItem (juce::String (std::string (mtb::deviceAt (i).name)), i + 1);
    deviceBox.setColour (juce::ComboBox::backgroundColourId, background);
    deviceBox.setColour (juce::ComboBox::textColourId, textColour);
    deviceBox.setColour (juce::ComboBox::outlineColourId, line);
    addAndMakeVisible (deviceBox);
    deviceAttachment = std::make_unique<ComboAttachment> (
        state, MultiTransBendProcessor::bandParamId (index, "device"), deviceBox);

    enabledButton.setColour (juce::ToggleButton::textColourId, dimText);
    addAndMakeVisible (enabledButton);
    enabledAttachment = std::make_unique<ButtonAttachment> (
        state, MultiTransBendProcessor::bandParamId (index, "enabled"), enabledButton);

    struct Entry { juce::Slider& slider; juce::Label& label; const char* id; const char* text; };
    const Entry entries[] = {
        { attack,      attackLabel,      "attack",      "Attack" },
        { sustain,     sustainLabel,     "sustain",     "Sustain" },
        { attackTime,  attackTimeLabel,  "attackTime",  "Att ms" },
        { release,     releaseLabel,     "release",     "Rel ms" },
        { sustainTime, sustainTimeLabel, "sustainTime", "Sus ms" },
        { drive,       driveLabel,       "drive",       "Drive" },
        { trim,        trimLabel,        "trim",        "Trim" },
    };

    for (const auto& entry : entries)
    {
        addRotary (entry.slider, entry.label, entry.text);
        attachments.push_back (std::make_unique<SliderAttachment> (
            state, MultiTransBendProcessor::bandParamId (index, entry.id), entry.slider));
    }
}

void BandStrip::addRotary (juce::Slider& slider, juce::Label& label, const juce::String& text)
{
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 62, 15);
    slider.setColour (juce::Slider::rotarySliderFillColourId, accentColour);
    slider.setColour (juce::Slider::textBoxTextColourId, textColour);
    slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    slider.setColour (juce::Slider::textBoxBackgroundColourId, juce::Colours::transparentBlack);
    addAndMakeVisible (slider);

    label.setText (text, juce::dontSendNotification);
    label.setJustificationType (juce::Justification::centred);
    label.setColour (juce::Label::textColourId, dimText);
    label.setFont (juce::FontOptions (10.5f));
    addAndMakeVisible (label);
}

void BandStrip::setGainDb (float db)
{
    if (std::abs (db - gainDb) < 0.05f)
        return;
    gainDb = db;
    repaint();
}

void BandStrip::paint (juce::Graphics& g)
{
    auto bounds = getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (surface);
    g.fillRoundedRectangle (bounds, 8.0f);
    g.setColour (line);
    g.drawRoundedRectangle (bounds, 8.0f, 1.0f);

    // Gain meter: a bipolar bar, because this processor both boosts and cuts and
    // a unipolar meter would hide half of what it is doing.
    auto meter = bounds.removeFromRight (8.0f).reduced (2.0f, 10.0f);
    g.setColour (juce::Colour (0xff1a1e23));
    g.fillRoundedRectangle (meter, 3.0f);

    const auto centre = meter.getCentreY();
    const auto extent = juce::jlimit (-1.0f, 1.0f, gainDb / 16.0f) * (meter.getHeight() * 0.5f);
    const auto colour = gainDb >= 0.0f ? juce::Colour (0xff6ee7b7) : juce::Colour (0xffef7a72);
    g.setColour (colour.withAlpha (0.85f));
    g.fillRect (juce::Rectangle<float> (meter.getX(), juce::jmin (centre, centre - extent),
                                        meter.getWidth(), std::abs (extent)));
}

void BandStrip::resized()
{
    auto bounds = getLocalBounds().reduced (8);
    bounds.removeFromRight (10); // meter gutter

    auto top = bounds.removeFromTop (20);
    header.setBounds (top.removeFromLeft (58));
    enabledButton.setBounds (top.removeFromRight (52));

    bounds.removeFromTop (4);
    deviceBox.setBounds (bounds.removeFromTop (24));
    bounds.removeFromTop (6);

    struct Cell { juce::Slider& slider; juce::Label& label; };
    Cell cells[] = {
        { attack, attackLabel },     { sustain, sustainLabel },
        { attackTime, attackTimeLabel }, { release, releaseLabel },
        { sustainTime, sustainTimeLabel }, { drive, driveLabel },
        { trim, trimLabel },
    };

    const int columns = 4;
    const int rows = 2;
    const auto cellWidth = bounds.getWidth() / columns;
    const auto cellHeight = bounds.getHeight() / rows;

    for (int i = 0; i < static_cast<int> (std::size (cells)); ++i)
    {
        const auto row = i / columns;
        const auto column = i % columns;
        juce::Rectangle<int> cell (bounds.getX() + column * cellWidth,
                                   bounds.getY() + row * cellHeight,
                                   cellWidth, cellHeight);
        cells[i].label.setBounds (cell.removeFromTop (13));
        cells[i].slider.setBounds (cell.reduced (2));
    }
}

// ---------------------------------------------------------------------------

MultiTransBendEditor::MultiTransBendEditor (MultiTransBendProcessor& owner)
    : AudioProcessorEditor (&owner), proc (owner)
{
    auto& state = proc.getState();

    struct Entry { juce::Slider& slider; juce::Label& label; const char* id; const char* text; };
    const Entry entries[] = {
        { bandCount,  bandCountLabel,  "bandCount",  "Bands" },
        { xover1,     xover1Label,     "xover1",     "Split 1" },
        { xover2,     xover2Label,     "xover2",     "Split 2" },
        { xover3,     xover3Label,     "xover3",     "Split 3" },
        { inputTrim,  inputTrimLabel,  "inputTrim",  "In" },
        { outputTrim, outputTrimLabel, "outputTrim", "Out" },
        { mix,        mixLabel,        "mix",        "Mix" },
    };

    for (const auto& entry : entries)
    {
        entry.slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        entry.slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 64, 15);
        entry.slider.setColour (juce::Slider::rotarySliderFillColourId, accentColour);
        entry.slider.setColour (juce::Slider::textBoxTextColourId, textColour);
        entry.slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        addAndMakeVisible (entry.slider);

        entry.label.setText (entry.text, juce::dontSendNotification);
        entry.label.setJustificationType (juce::Justification::centred);
        entry.label.setColour (juce::Label::textColourId, dimText);
        entry.label.setFont (juce::FontOptions (10.5f));
        addAndMakeVisible (entry.label);

        attachments.push_back (std::make_unique<SliderAttachment> (state, entry.id, entry.slider));
    }

    bypass.setColour (juce::ToggleButton::textColourId, dimText);
    addAndMakeVisible (bypass);
    bypassAttachment = std::make_unique<ButtonAttachment> (state, "bypass", bypass);

    restoreButton.setColour (juce::TextButton::buttonColourId, surface);
    restoreButton.setColour (juce::TextButton::textColourOffId, textColour);
    restoreButton.onClick = [this] { showBackupMenu(); };
    addAndMakeVisible (restoreButton);

    storageLabel.setColour (juce::Label::textColourId, juce::Colour (0xff666d76));
    storageLabel.setFont (juce::FontOptions (10.5f));
    storageLabel.setText (proc.getStore().describeStorage(), juce::dontSendNotification);
    addAndMakeVisible (storageLabel);

    for (int i = 0; i < mtb::maxBands; ++i)
    {
        auto strip = std::make_unique<BandStrip> (proc, i);
        addAndMakeVisible (*strip);
        strips.push_back (std::move (strip));
    }

    setSize (980, 620);
    setResizable (true, true);
    setResizeLimits (860, 540, 1600, 1000);
    startTimerHz (24);
}

void MultiTransBendEditor::showBackupMenu()
{
    auto& store = proc.getStore();
    const auto backups = store.listBackups();

    juce::PopupMenu menu;
    if (backups.isEmpty())
    {
        menu.addItem (1, "No backups yet", false);
    }
    else
    {
        for (int i = 0; i < backups.size(); ++i)
        {
            const auto time = backups[i].getLastModificationTime();
            menu.addItem (i + 1, time.toString (true, true));
        }
    }

    menu.showMenuAsync (juce::PopupMenu::Options().withTargetComponent (restoreButton),
                        [this, &store, backups] (int choice)
                        {
                            if (choice <= 0 || backups.isEmpty())
                                return;
                            if (auto tree = store.loadBackup (choice - 1); tree.isValid())
                                proc.getState().replaceState (tree);
                        });
}

void MultiTransBendEditor::timerCallback()
{
    for (int i = 0; i < static_cast<int> (strips.size()); ++i)
        strips[static_cast<size_t> (i)]->setGainDb (proc.getBandGainDb (i));
}

void MultiTransBendEditor::paint (juce::Graphics& g)
{
    g.fillAll (background);

    // Product first, maker second — the same hierarchy the web app uses.
    g.setColour (textColour);
    g.setFont (juce::FontOptions (19.0f).withStyle ("Bold"));
    g.drawText ("MULTI", 18, 14, 60, 24, juce::Justification::centredLeft);
    g.setColour (accentColour);
    g.drawText ("TRANSBEND", 74, 14, 240, 24, juce::Justification::centredLeft);

    g.setColour (dimText);
    g.setFont (juce::FontOptions (10.0f));
    g.drawText ("CASE AUDIO", getWidth() - 130, 16, 112, 20, juce::Justification::centredRight);

    g.setColour (dimText);
    g.setFont (juce::FontOptions (11.0f));
    g.drawText ("Multi-band, multi-device transient design  ·  " +
                    juce::String (proc.getLatencySamples()) + " samples latency",
                18, 38, 620, 16, juce::Justification::centredLeft);
}

void MultiTransBendEditor::resized()
{
    auto bounds = getLocalBounds().reduced (14);
    bounds.removeFromTop (46);

    auto globals = bounds.removeFromTop (86);
    auto footer = bounds.removeFromBottom (26);

    struct Cell { juce::Slider& slider; juce::Label& label; };
    Cell cells[] = {
        { bandCount, bandCountLabel }, { xover1, xover1Label }, { xover2, xover2Label },
        { xover3, xover3Label },       { inputTrim, inputTrimLabel },
        { outputTrim, outputTrimLabel }, { mix, mixLabel },
    };

    const auto count = static_cast<int> (std::size (cells));
    const auto cellWidth = juce::jmax (70, (globals.getWidth() - 200) / count);

    for (auto& cell : cells)
    {
        auto area = globals.removeFromLeft (cellWidth);
        cell.label.setBounds (area.removeFromTop (14));
        cell.slider.setBounds (area.reduced (3));
    }

    bypass.setBounds (globals.removeFromTop (24).removeFromRight (94));
    restoreButton.setBounds (globals.removeFromTop (26).removeFromRight (130).reduced (2));

    storageLabel.setBounds (footer);

    bounds.removeFromTop (8);
    const auto stripWidth = bounds.getWidth() / juce::jmax (1, static_cast<int> (strips.size()));
    for (auto& strip : strips)
        strip->setBounds (bounds.removeFromLeft (stripWidth).reduced (4, 0));
}
