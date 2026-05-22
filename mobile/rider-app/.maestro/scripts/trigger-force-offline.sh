#!/usr/bin/env bash
# Maestro runScript helper — fires the admin force-offline endpoint for the
# rider currently signed in on the test device. Requires the env var
# ADMIN_TOKEN to carry an admin bearer token for the staging environment.
set -euo pipefail

: "${ADMIN_TOKEN:?ADMIN_TOKEN is required to trigger force-offline}"
: "${API_URL:=https://api.logistics.codeket.com}"
: "${RIDER_ID:?RIDER_ID is required (rider record id, not the user id)}"

curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer ${ADMIN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "{\"reason\":\"maestro-test\"}" \
  "${API_URL}/admin/riders/${RIDER_ID}/force-offline" \
  > /dev/null

echo "force-offline triggered for ${RIDER_ID}"
