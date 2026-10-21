#!/usr/bin/env bash
# Publishes an Instagram story (video, image as fallback). Env: IG_TOKEN, IG_USER, IMAGE_URL, VIDEO_URL (optional)
set -uo pipefail
[ -z "${IG_TOKEN:-}" ] || [ -z "${IG_USER:-}" ] && { echo "::warning::No IG_ACCESS_TOKEN / IG_USER_ID secret: story skipped"; exit 0; }
IG_TOKEN=$(printf %s "$IG_TOKEN" | tr -d "[:space:]\"'")
case "$IG_TOKEN" in IG*) API="https://graph.instagram.com/v21.0";; *) API="https://graph.facebook.com/v21.0";; esac
safe() { sed "s/$IG_TOKEN/***/g"; }
create() {
  local RES
  if [ "$1" = video ]; then RES=$(curl -sS -X POST "$API/$IG_USER/media" --data-urlencode media_type=STORIES --data-urlencode "video_url=$VIDEO_URL" --data-urlencode "access_token=$IG_TOKEN")
  else RES=$(curl -sS -X POST "$API/$IG_USER/media" --data-urlencode media_type=STORIES --data-urlencode "image_url=$IMAGE_URL" --data-urlencode "access_token=$IG_TOKEN"); fi
  ID=$(echo "$RES" | jq -r '.id // empty')
  [ -z "$ID" ] && { echo "::warning::Container not created ($1): $(echo "$RES" | jq -c '.error // .' | safe)"; return 1; }
  for i in $(seq 1 60); do
    ST=$(curl -sS "$API/$ID?fields=status_code&access_token=$IG_TOKEN" | jq -r '.status_code // "?"'); echo "status ($1): $ST"
    [ "$ST" = FINISHED ] && return 0
    [ "$ST" = ERROR ] && return 1
    sleep 5
  done; return 1
}
if [ -n "${VIDEO_URL:-}" ] && create video; then :; elif create image; then :; else echo "::warning::Story could not be prepared"; exit 0; fi
OUT=$(curl -sS -X POST "$API/$IG_USER/media_publish" --data-urlencode "creation_id=$ID" --data-urlencode "access_token=$IG_TOKEN")
echo "$OUT" | jq -e .id >/dev/null && echo "::notice::Story published" || echo "::warning::Story publish failed: $(echo "$OUT" | jq -c '.error // .' | safe)"
