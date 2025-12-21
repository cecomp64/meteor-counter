#!/bin/bash

# Install git hooks from the hooks/ directory into .git/hooks/

echo "Installing git hooks..."

# Get the directory where this script is located
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR=".git/hooks"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "Error: Not a git repository"
    exit 1
fi

# Copy pre-commit hook
cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
chmod +x "$GIT_HOOKS_DIR/pre-commit"

echo "✓ Pre-commit hook installed"
echo ""
echo "The following hooks are now active:"
echo "  - pre-commit: Automatically updates version before each commit"
echo ""
