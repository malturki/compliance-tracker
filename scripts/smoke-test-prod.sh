#!/usr/bin/env bash
# Smoke test the production deployment.
#
# What it verifies:
#   1. Public skill URL serves the markdown without auth
#   2. Unauthenticated API calls return 401
#   3. The NextAuth providers route is up and Google is registered
#   4. If COMPLIANCE_TRACKER_TOKEN is set in the env, the agent auth
#      flow works end-to-end (GET obligations list, check 200 + JSON).
#
# Usage:
#   ./scripts/smoke-test-prod.sh
#   COMPLIANCE_TRACKER_TOKEN=ct_live_... ./scripts/smoke-test-prod.sh
#
# Exit codes: 0 = all pass, non-zero = failure.

set -u
PROD="${COMPLIANCE_TRACKER_URL:-https://compliance-tracker-alturki.vercel.app}"

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
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

echo "=== Production smoke tests against $PROD ==="
echo

echo "[1/5] Public skill URL accessible without auth"
code=$(curl -s -o /tmp/skill.md -w "%{http_code}" "$PROD/.well-known/compliance-tracker-skill" || echo "000")
check "GET /.well-known/compliance-tracker-skill" "$code" "200"
if [[ "$code" == "200" ]]; then
  if grep -q "name: compliance-tracker" /tmp/skill.md; then
    echo "  ${GREEN}PASS${RESET}  skill frontmatter present"
    pass=$((pass + 1))
  else
    echo "  ${RED}FAIL${RESET}  skill content missing frontmatter"
    fail=$((fail + 1))
  fi
fi
echo

echo "[2/5] Unauthenticated API calls return 401"
for path in /api/obligations /api/stats /api/audit /api/analytics /api/users /api/agents; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PROD$path" || echo "000")
  check "GET $path (unauth)" "$code" "401"
done
echo

echo "[3/5] Unauthenticated page requests redirect to sign-in"
code=$(curl -s -o /dev/null -w "%{http_code}" "$PROD/" || echo "000")
check "GET / (unauth)" "$code" "307"
echo

echo "[4/5] NextAuth providers endpoint is live"
code=$(curl -s -o /tmp/providers.json -w "%{http_code}" "$PROD/api/auth/providers" || echo "000")
check "GET /api/auth/providers" "$code" "200"
if [[ "$code" == "200" ]] && grep -q '"google"' /tmp/providers.json; then
  echo "  ${GREEN}PASS${RESET}  Google provider registered"
  pass=$((pass + 1))
else
  echo "  ${RED}FAIL${RESET}  Google provider missing from /api/auth/providers"
  fail=$((fail + 1))
fi
echo

echo "[5/5] Agent token flow (optional — set COMPLIANCE_TRACKER_TOKEN to enable)"
if [[ -n "${COMPLIANCE_TRACKER_TOKEN:-}" ]]; then
  code=$(curl -s -o /tmp/oblig.json -w "%{http_code}" \
    -H "Authorization: Bearer $COMPLIANCE_TRACKER_TOKEN" \
    "$PROD/api/obligations")
  check "GET /api/obligations (with agent token)" "$code" "200"
  if [[ "$code" == "200" ]]; then
    count=$(python3 -c "import sys,json; d=json.load(open('/tmp/oblig.json')); print(len(d) if isinstance(d,list) else 'not-array')" 2>/dev/null)
    if [[ "$count" =~ ^[0-9]+$ ]] && [[ "$count" -gt 0 ]]; then
      echo "  ${GREEN}PASS${RESET}  agent token returned $count obligations"
      pass=$((pass + 1))
    else
      echo "  ${RED}FAIL${RESET}  agent token returned non-array or empty"
      fail=$((fail + 1))
    fi
  fi

  # Invalid token should still 401
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ct_live_definitely_not_valid_deadbeef" \
    "$PROD/api/obligations")
  check "GET /api/obligations (invalid token)" "$code" "401"
else
  echo "  ${YELLOW}SKIP${RESET}  (set COMPLIANCE_TRACKER_TOKEN to exercise the agent API)"
fi
echo

echo "=== $pass passed, $fail failed ==="
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
