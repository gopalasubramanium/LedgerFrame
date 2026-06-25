#!/usr/bin/env bash
# LedgerFrame benchmark — records API latency, payload size, memory, CPU, disk,
# Hailo latency, and quote-refresh throughput. Read-only.
set -uo pipefail
API_URL="http://127.0.0.1:${LEDGERFRAME_API_PORT:-8321}"
HAILO_URL="${LEDGERFRAME_HAILO_BASE_URL:-http://127.0.0.1:8000}"
DATA_DIR="${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}"

hdr() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }

hdr "API latency & payload size"
for ep in /health /api/v1/dashboard/home /api/v1/portfolio/summary /api/v1/markets/overview; do
  out=$(curl -s -o /tmp/lf_bench_body -w '%{time_total} %{size_download}' "$API_URL$ep" 2>/dev/null) || { echo "  $ep: unreachable"; continue; }
  t=$(echo "$out" | awk '{printf "%.0f", $1*1000}')
  sz=$(echo "$out" | awk '{printf "%.1f", $2/1024}')
  printf '  %-32s %5sms  %6sKB\n' "$ep" "$t" "$sz"
done

hdr "Quote refresh throughput"
start=$(date +%s.%N)
N=20
for _ in $(seq $N); do curl -s "$API_URL/api/v1/markets/search?q=A" >/dev/null 2>&1; done
end=$(date +%s.%N)
echo "  $N market searches in $(echo "$end - $start" | bc)s"

hdr "Application memory & CPU"
ps -eo rss,pcpu,comm 2>/dev/null | grep -E 'uvicorn|python|ledgerframe' | grep -v grep | \
  awk '{rss+=$1; cpu+=$2} END {printf "  RSS: %.0f MB · CPU: %.1f%%\n", rss/1024, cpu}'

hdr "Disk usage (data dir)"
[[ -d "$DATA_DIR" ]] && du -sh "$DATA_DIR" 2>/dev/null | sed 's/^/  /' || echo "  data dir missing"
[[ -d "$DATA_DIR" ]] && df -h "$DATA_DIR" | awk 'NR==2{printf "  Volume: %s used of %s (%s)\n",$3,$2,$5}'

hdr "Hailo response latency"
if curl -fsS "$HAILO_URL/hailo/v1/list" >/dev/null 2>&1; then
  t=$(curl -s -o /dev/null -w '%{time_total}' "$HAILO_URL/hailo/v1/list")
  printf '  list models: %.0fms\n' "$(echo "$t*1000" | bc)"
else
  echo "  hailo-ollama not reachable — skipped"
fi
echo
