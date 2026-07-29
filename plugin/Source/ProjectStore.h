#pragma once

#include <juce_core/juce_core.h>
#include <juce_data_structures/juce_data_structures.h>

/**
 * Local persistence for the plugin and the standalone build.
 *
 * This is the deliberate opposite of the web version's policy. The web
 * standalone keeps nothing because the storage would be someone else's; here
 * the storage is yours, so the sensible thing is redundancy:
 *
 *  - every export is copied into a dated folder alongside the settings that
 *    produced it, so a render can always be traced back to its recipe;
 *  - the last three processings are kept as rolling backups and can be
 *    restored, which covers the two ways work actually gets lost — a crash, and
 *    a change you cannot undo your way out of.
 *
 * Three is a considered number, not an arbitrary one. It covers "I broke it",
 * "I broke it twice", and "the last one that definitely worked", which is the
 * span people actually reach back through. Keeping more turns a safety net into
 * an archive nobody prunes.
 */
class ProjectStore
{
public:
    static constexpr int backupDepth = 3;

    ProjectStore();

    /** Root of everything this class writes. */
    juce::File getRootDirectory() const { return root; }
    juce::File getBackupDirectory() const { return root.getChildFile ("backups"); }
    juce::File getExportDirectory() const { return root.getChildFile ("exports"); }

    /** Write a rolling backup, pruning to `backupDepth`. Silent on failure. */
    void writeBackup (const juce::ValueTree& state);

    /** Newest first. */
    juce::Array<juce::File> listBackups() const;

    /** Restore a backup by index; returns an invalid tree if unavailable. */
    juce::ValueTree loadBackup (int index) const;

    /**
     * Copy a rendered file into the export folder together with a sidecar
     * describing the settings. Returns the copy, or an invalid file.
     */
    juce::File archiveExport (const juce::File& renderedFile, const juce::ValueTree& state);

    /** Human-readable summary for the editor. */
    juce::String describeStorage() const;

private:
    void prune (const juce::File& directory, const juce::String& wildcard, int keep) const;

    juce::File root;
};
