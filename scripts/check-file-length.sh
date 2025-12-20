#!/bin/bash

# Check file length limit
# Default: 500 lines max
# MainScene.ts: 1000 lines max (orchestration file)

DEFAULT_MAX_LINES=500
MAINSCENE_MAX_LINES=1000
EXIT_CODE=0

# Get list of staged TypeScript/JavaScript files
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$FILES" ]; then
    exit 0
fi

echo "Checking file lengths..."

for FILE in $FILES; do
    if [ -f "$FILE" ]; then
        LINES=$(wc -l < "$FILE" | tr -d ' ')
        
        # MainScene.ts gets a higher limit as it's the orchestration file
        if [[ "$FILE" == *"MainScene.ts" ]]; then
            MAX_LINES=$MAINSCENE_MAX_LINES
        else
            MAX_LINES=$DEFAULT_MAX_LINES
        fi
        
        if [ "$LINES" -gt "$MAX_LINES" ]; then
            echo "❌ $FILE has $LINES lines (max: $MAX_LINES)"
            EXIT_CODE=1
        fi
    fi
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All files within line limits"
else
    echo ""
    echo "Please refactor large files into smaller modules."
    echo "Consider extracting:"
    echo "  - Related functions into separate utility files"
    echo "  - Classes into their own files"
    echo "  - Constants/types into dedicated files"
fi

exit $EXIT_CODE
