#!/bin/bash

# Meteor Observer - Version Update Script
# This script updates the version number across all files

# Generate new version number
NEW_VERSION="1.0.$(date +%Y%m%d%H%M)"
echo "Updating to version: $NEW_VERSION"

# Define old version to replace (current version)
OLD_VERSION="1.0.202512140725"

# Function to update version in a file
update_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "Updating $file..."
        sed -i.bak "s/$OLD_VERSION/$NEW_VERSION/g" "$file"
        rm "${file}.bak"
    else
        echo "Warning: $file not found"
    fi
}

# Update all files
update_file "index.html"
update_file "manifest.json"
update_file "service-worker.js"
update_file "README.md"

echo ""
echo "✅ Version updated to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - index.html (version indicator + query parameters)"
echo "  - manifest.json (version field)"
echo "  - service-worker.js (cache name + URLs)"
echo "  - README.md (header version)"
echo ""
echo "Next steps:"
echo "  1. Test the app locally"
echo "  2. Commit changes: git commit -am 'Update to version $NEW_VERSION'"
echo "  3. Deploy to hosting platform"
