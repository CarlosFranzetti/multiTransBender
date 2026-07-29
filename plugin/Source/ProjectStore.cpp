#include "ProjectStore.h"

namespace
{
juce::String timestamp()
{
    return juce::Time::getCurrentTime().formatted ("%Y%m%d-%H%M%S");
}
} // namespace

ProjectStore::ProjectStore()
{
    root = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
               .getChildFile ("MultiTransBend");

    getBackupDirectory().createDirectory();
    getExportDirectory().createDirectory();
}

void ProjectStore::writeBackup (const juce::ValueTree& state)
{
    if (! state.isValid())
        return;

    const auto directory = getBackupDirectory();
    if (! directory.exists() && ! directory.createDirectory().wasOk())
        return;

    const auto file = directory.getChildFile ("state-" + timestamp() + ".xml");

    if (auto xml = state.createXml())
    {
        // Write to a temporary and move into place, so a backup interrupted
        // half-way never overwrites a good one with a truncated file.
        juce::TemporaryFile temp (file);
        if (xml->writeTo (temp.getFile()))
            temp.overwriteTargetFileWithTemporary();
    }

    prune (directory, "state-*.xml", backupDepth);
}

juce::Array<juce::File> ProjectStore::listBackups() const
{
    juce::Array<juce::File> files;
    getBackupDirectory().findChildFiles (files, juce::File::findFiles, false, "state-*.xml");

    // Newest first: the names are timestamped, so lexical order is time order.
    files.sort();
    juce::Array<juce::File> reversed;
    for (int i = files.size(); --i >= 0;)
        reversed.add (files[i]);
    return reversed;
}

juce::ValueTree ProjectStore::loadBackup (int index) const
{
    const auto files = listBackups();
    if (! juce::isPositiveAndBelow (index, files.size()))
        return {};

    if (auto xml = juce::XmlDocument::parse (files[index]))
        return juce::ValueTree::fromXml (*xml);
    return {};
}

juce::File ProjectStore::archiveExport (const juce::File& renderedFile, const juce::ValueTree& state)
{
    if (! renderedFile.existsAsFile())
        return {};

    const auto stamp = timestamp();
    const auto directory = getExportDirectory().getChildFile (stamp);
    if (! directory.createDirectory().wasOk())
        return {};

    const auto copy = directory.getChildFile (renderedFile.getFileName());
    if (! renderedFile.copyFileTo (copy))
        return {};

    if (state.isValid())
    {
        if (auto xml = state.createXml())
            xml->writeTo (directory.getChildFile ("settings.xml"));
    }

    return copy;
}

juce::String ProjectStore::describeStorage() const
{
    const auto backups = listBackups().size();
    return "Backups: " + juce::String (backups) + "/" + juce::String (backupDepth)
           + "  ·  " + root.getFullPathName();
}

void ProjectStore::prune (const juce::File& directory, const juce::String& wildcard, int keep) const
{
    juce::Array<juce::File> files;
    directory.findChildFiles (files, juce::File::findFiles, false, wildcard);
    if (files.size() <= keep)
        return;

    files.sort(); // oldest first
    for (int i = 0; i < files.size() - keep; ++i)
        files[i].deleteFile();
}
