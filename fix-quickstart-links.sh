#!/bin/bash

# Script to update internal markdown links in quickstart files
# from references/* structure to flat file structure with prefixes

REFERENCES_DIR="/Users/frederikprijck/Development/auth0/agent-skills/.claude/worktrees/single-skill/plugins/auth0/skills/auth0-all/references"

# Define function to extract prefix from filename
# e.g., nextjs-quickstart.md → nextjs-
get_prefix() {
    local filename="$1"
    echo "${filename%-quickstart.md}-"
}

# Process each quickstart file
for filepath in "$REFERENCES_DIR"/*-quickstart.md; do
    filename=$(basename "$filepath")
    prefix=$(get_prefix "$filename")

    echo "Processing: $filename (prefix: $prefix)"

    # First replacement: references/providers/ → {prefix}providers-
    sed -i '' "s|(references/providers/|($prefix""providers-|g" "$filepath"

    # Second replacement: references/ → {prefix}
    sed -i '' "s|(references/|($prefix|g" "$filepath"
done

echo "Done! Verifying..."

# Verify no more references/ in quickstart files (except in URLs or prose)
if grep -l "(references/" "$REFERENCES_DIR"/*-quickstart.md 2>/dev/null; then
    echo "ERROR: Some files still contain (references/ patterns!"
    exit 1
else
    echo "SUCCESS: All (references/ patterns have been replaced!"
fi
