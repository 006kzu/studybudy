#!/bin/bash

API_KEY="WY32Ac1QdEj6Tat8zy5fPhyX"
ASSETS_DIR="./public/assets"

# List of new avatars to process
AVATARS=(
  "avatar_cat.png"
  "avatar_lion.png"
  "avatar_tiger.png"
  "avatar_bear.png"
  "avatar_panda.png"
  "avatar_fox.png"
  "avatar_wolf.png"
  "avatar_bunny.png"
  "avatar_hamster.png"
  "avatar_mouse.png"
  "avatar_pig.png"
  "avatar_cow.png"
)

echo "Starting background removal for ${#AVATARS[@]} avatars..."

for avatar in "${AVATARS[@]}"; do
  FILE_PATH="$ASSETS_DIR/$avatar"
  TEMP_OUTPUT="$ASSETS_DIR/temp_$avatar"

  if [ -f "$FILE_PATH" ]; then
    echo "Processing $avatar..."
    
    # Send to remove.bg API
    response=$(curl -s -w "%{http_code}" -H "X-Api-Key: $API_KEY" \
         -F "image_file=@$FILE_PATH" \
         -F "size=auto" \
         -o "$TEMP_OUTPUT" \
         https://api.remove.bg/v1.0/removebg)

    http_code="${response: -3}"
    
    if [ "$http_code" == "200" ]; then
        echo "✅ Success! Overwriting original file."
        mv "$TEMP_OUTPUT" "$FILE_PATH"
    else
        echo "❌ Failed to process $avatar. HTTP Code: $http_code"
        # Print error details if any (saved in output file if not 200 usually contains json error)
        cat "$TEMP_OUTPUT"
        rm "$TEMP_OUTPUT"
    fi
  else
    echo "⚠️ File not found: $avatar"
  fi
  
  echo "-----------------------------------"
done

echo "Batch processing complete."
