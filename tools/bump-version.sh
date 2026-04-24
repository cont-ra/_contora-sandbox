#!/bin/bash
# Auto-increment build number in index.html before each deploy
# Format: vX.Y.ZZZZ where ZZZZ auto-increments, X.Y is manual
FILE="index.html"
CURRENT=$(grep -oE 'v[0-9]+\.[0-9]+\.[0-9]{4}' "$FILE" | head -1)
if [ -z "$CURRENT" ]; then echo "Version not found"; exit 1; fi
MAJOR_MINOR=$(echo "$CURRENT" | sed 's/v\([0-9]*\.[0-9]*\)\..*/\1/')
BUILD=$(echo "$CURRENT" | sed 's/v[0-9]*\.[0-9]*\.\([0-9]*\)/\1/')
NEXT=$((10#$BUILD + 1))
NEXT_PAD=$(printf "%04d" $NEXT)
NEW="v${MAJOR_MINOR}.${NEXT_PAD}"
sed -i '' "s/$CURRENT/$NEW/" "$FILE"
echo "$CURRENT → $NEW"
