#!/bin/bash
KEY="AIzaSyB7gDtdaAo6HcRuy-7pxM4JWku9sTlGbvc"
URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${KEY}"

echo "Testing Gemini API key..."
HTTP_CODE=$(curl -s -o /tmp/gemini_response.json -w "%{http_code}" \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say the word OK"}]}]}')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
cat /tmp/gemini_response.json
