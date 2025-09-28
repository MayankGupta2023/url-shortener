#!/bin/bash

# File to store all generated short URLs
OUTPUT_FILE="short_urls.txt"
> "$OUTPUT_FILE"  # Clear the file if it exists

# Loop to create 1000 short URLs
for i in {1..1000}; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/shorten \
       -H "Content-Type: application/json" \
       -d "{\"url\":\"https://example${i}.com\"}")

  # Extract short_url using Bash string manipulation
  SHORT_URL=$(echo "$RESPONSE" | sed -n 's/.*"short_url":"\([^"]*\)".*/\1/p')

  # Append to file
  echo "$SHORT_URL" >> "$OUTPUT_FILE"

  echo "Created: $SHORT_URL"
done

echo "All short URLs saved in $OUTPUT_FILE"

