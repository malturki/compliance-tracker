#!/usr/bin/env bash
# Smoke test a local dev server.
#
# Assumes `npm run dev` is running on http://localhost:3000.
# Unlike the production script, this only hits the endpoints that
# don't require a real session — useful for quick "is the server up?"
# verification after editing middleware, routes, or env config.
#
# Usage:
#   ./scripts/smoke-test-local.sh
#   COMPLIANCE_TRACKER_URL=http://localhost:3001 ./scripts/smoke-test-local.sh

set -u
URL="${COMPLIANCE_TRACKER_URL:-http://localhost:3000}"

RED=$'\033[31m'
GREEN=$'\033[32m'
RESET=$'\033[0m'

pass=0
fail=0

check() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ${GREEN}PASS${RESET}  $name → HTTP $actual"
    pass=$((pass + 1))
  else
    echo "  ${RED}FAIL${RESET}  $name → HTTP $actual (expected $expected)"
    fail=$((fail + 1))
  fi
}

echo "=== Local smoke tests against $URL ==="
echo

echo "[1/3] Skill URL accessible"
code=$(curl -s -o /tmp/skill.md -w "%{http_code}" "$URL/.well-known/compliance-tracker-skill" || echo "000")
check "GET /.well-known/compliance-tracker-skill" "$code" "200"
echo

echo "[2/3] API routes return 401 when unauthenticated"
for path in /api/obligations /api/stats /api/audit; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$path" || echo "000")
  check "GET $path (unauth)" "$code" "401"
done
echo

echo "[3/3] Pages redirect to sign-in"
code=$(curl -s -o /dev/null -w "%{http_code}" "$URL/" || echo "000")
check "GET / (unauth)" "$code" "307"
echo

echo "=== $pass passed, $fail failed ==="
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
