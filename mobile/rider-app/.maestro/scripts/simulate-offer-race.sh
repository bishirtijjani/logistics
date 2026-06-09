#!/usr/bin/env bash
# Maestro runScript helper - enqueues a staging offer, then immediately
# claims it as a sibling rider, so the test rider sees a 409 OFFER_TAKEN
# when they tap Accept.
set -euo pipefail

: "${ADMIN_TOKEN:?ADMIN_TOKEN required}"
: "${SIBLING_RIDER_TOKEN:?SIBLING_RIDER_TOKEN required - a logged-in test rider's access token}"
: "${API_URL:=https://api.iprime.ng}"

# 1. Seed an offer addressed at both test riders.
SEED_RES=$(curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer ${ADMIN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{"target":"both"}' \
  "${API_URL}/admin/test/seed-offer")
REQUEST_ID=$(echo "$SEED_RES" | grep -oE '"requestId":"[^"]+' | cut -d'"' -f4)
test -n "$REQUEST_ID" || { echo "no requestId returned from seed-offer"; exit 1; }

# 2. Sibling rider grabs it immediately.
curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer ${SIBLING_RIDER_TOKEN}" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: maestro-race-$(date +%s)" \
  --data "{\"requestId\":\"${REQUEST_ID}\"}" \
  "${API_URL}/rider/accept" \
  > /dev/null

echo "race-lost offer claimed by sibling for ${REQUEST_ID}"
