cmake_minimum_required(VERSION 3.22)

# JUCE compiles C sources of its own (and on Apple platforms, Objective-C++),
# so those languages have to be enabled here even though none of our code uses
# them. Declaring CXX alone fails at generate time with a missing
# CMAKE_C_COMPILE_OBJECT.
project(MultiTransBend VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# JUCE is fetched rather than vendored so the repository stays small and the
# framework version is pinned in one visible place.
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        8.0.4
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(MultiTransBend
    COMPANY_NAME              "Case Audio"
    BUNDLE_ID                 "com.caseaudio.multitransbend"
    # Four-character codes are the plugin's identity to a host. Changing them
    # makes existing sessions fail to find the plugin, so they are being set
    # now, while the only builds in the world are beta ones, and not after.
    PLUGIN_MANUFACTURER_CODE  CsAu
    PLUGIN_CODE               Mtbd
    FORMATS                   VST3 AU Standalone
    PRODUCT_NAME              "MultiTransBend"
    IS_SYNTH                  FALSE
    NEEDS_MIDI_INPUT          FALSE
    NEEDS_MIDI_OUTPUT         FALSE
    IS_MIDI_EFFECT            FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD   TRUE
    VST3_CATEGORIES           Fx Dynamics
    AU_MAIN_TYPE              kAudioUnitType_Effect
)

target_sources(MultiTransBend PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/ProjectStore.cpp
)

target_compile_definitions(MultiTransBend PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_REPORT_APP_USAGE=0
    # Denormals are flushed inside the engine, but this keeps the rest of JUCE
    # from paying for them either.
    JUCE_DONT_DECLARE_PROJECTINFO=0
)

target_include_directories(MultiTransBend PRIVATE Source)

target_link_libraries(MultiTransBend PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

# ---------------------------------------------------------------------------
# Console smoke test for the compiled plugin. Links the shared code and drives
# the real AudioProcessor, so it verifies the binary that actually ships rather
# than a reimplementation of it.
juce_add_console_app(MultiTransBendTests PRODUCT_NAME "MultiTransBendTests")

target_sources(MultiTransBendTests PRIVATE tests/EngineSmokeTest.cpp)
target_include_directories(MultiTransBendTests PRIVATE Source)
target_compile_definitions(MultiTransBendTests PRIVATE
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_STANDALONE_APPLICATION=1
    JUCE_DISPLAY_SPLASH_SCREEN=0
)
target_link_libraries(MultiTransBendTests PRIVATE
    MultiTransBend
    juce::juce_audio_utils
    juce::juce_dsp
)
