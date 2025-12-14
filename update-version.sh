#!/bin/bash

# Meteor Observer - Version Update Script
# This script updates the version number across all files
# Finds and replaces any version matching pattern: v1.0.YYYYMMDDHHMM or 1.0.YYYYMMDDHHMM

# Generate new version number using Pacific Timezone
NEW_VERSION="1.0.$(TZ=America/Los_Angeles date +%Y%m%d%H%M)"
echo "Updating to version: $NEW_VERSION"
echo "Using Pacific Timezone: $(TZ=America/Los_Angeles date)"
echo ""

# Define the pattern to match version numbers (1.0. followed by digits)
VERSION_PATTERN='1\.0\.[0-9]\+'

# Find all files that might contain version numbers (excluding .git, node_modules, etc.)
FILES_TO_UPDATE=(
    "index.html"
    "manifest.json"
    "service-worker.js"
    "README.md"
    "app.js"
)

# Counter for changes
total_replacements=0

# Function to update version in a file
update_file() {
    local file=$1
    if [ -f "$file" ]; then
        # Count matches before replacement
        local matches=$(grep -o "$VERSION_PATTERN" "$file" 2>/dev/null | wc -l)

        if [ "$matches" -gt 0 ]; then
            echo "Updating $file... (found $matches occurrence(s))"

            # Replace all occurrences of the version pattern
            # Works with both: v1.0.YYYYMMDDHHMM and 1.0.YYYYMMDDHHMM
            sed -i.bak "s/${VERSION_PATTERN}/${NEW_VERSION}/g" "$file"

            # Verify the replacement worked
            local new_count=$(grep -o "$NEW_VERSION" "$file" 2>/dev/null | wc -l)
            echo "  ✓ Replaced $new_count version number(s)"
            total_replacements=$((total_replacements + new_count))

            # Remove backup file
            rm -f "${file}.bak"
        else
            echo "Skipping $file (no version numbers found)"
        fi
    else
        echo "Warning: $file not found"
    fi
}

# Update all files
for file in "${FILES_TO_UPDATE[@]}"; do
    update_file "$file"
done

# Also search for any other files that might contain the version
echo ""
echo "Searching for any other files with version numbers..."
other_files=$(grep -rl "$VERSION_PATTERN" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude="*.bak" \
    --exclude="update-version.sh" \
    2>/dev/null | grep -v -F "$(printf '%s\n' "${FILES_TO_UPDATE[@]}")")

if [ -n "$other_files" ]; then
    echo "⚠️  Found version numbers in additional files:"
    echo "$other_files"
    echo ""
    echo "These files were not automatically updated. Please review manually."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Version update complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "New version: $NEW_VERSION"
echo "Total replacements: $total_replacements"
echo "Timezone: Pacific ($(TZ=America/Los_Angeles date +%Z))"
echo ""
echo "Files updated:"
for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    fi
done
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test the app locally"
echo "  3. Commit changes: git commit -am 'Update to version $NEW_VERSION'"
echo "  4. Push to repository: git push"
echo ""
