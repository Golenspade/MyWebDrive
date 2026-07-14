#!/usr/bin/env bash

smoke_has_exact_availability() {
  local input=$1 expected=$2
  node -e '
const fs = require("node:fs")
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
const expected = process.argv[2]
if (value.availability !== expected) process.exit(1)
' "$input" "$expected"
}

smoke_wait_for_exact_availability() {
  local expected=$1 attempts=$2 interval=$3 fetch_function=$4 output=$5
  local poll_attempt
  for ((poll_attempt = 1; poll_attempt <= attempts; poll_attempt += 1)); do
    if "$fetch_function" "$output" && smoke_has_exact_availability "$output" "$expected"; then
      return 0
    fi
    if [[ $poll_attempt -lt $attempts && $interval != 0 ]]; then sleep "$interval"; fi
  done
  return 1
}

smoke_capture_container_identity() {
  local service=$1 container_id inspection
  local inspected_id inspected_pid inspected_started_at inspected_restart_count extra

  if ! container_id=$(compose ps -q "$service"); then return 1; fi
  [[ -n "$container_id" && "$container_id" != *$'\n'* && "$container_id" != *[[:space:]]* ]] || return 1

  if ! inspection=$(docker inspect --format \
    '{{.Id}}|{{.State.Pid}}|{{.State.StartedAt}}|{{.RestartCount}}' \
    "$container_id"); then
    return 1
  fi
  [[ -n "$inspection" && "$inspection" != *$'\n'* ]] || return 1
  IFS='|' read -r \
    inspected_id inspected_pid inspected_started_at inspected_restart_count extra <<<"$inspection"
  [[ -z "$extra" ]] || return 1
  [[ "$inspected_id" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ "$inspected_pid" =~ ^[1-9][0-9]*$ ]] || return 1
  [[ "$inspected_started_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$ ]] || return 1
  [[ "$inspected_started_at" != 0001-01-01T00:00:00Z ]] || return 1
  [[ "$inspected_restart_count" =~ ^[0-9]+$ ]] || return 1

  printf '%s|%s|%s|%s\n' \
    "$inspected_id" "$inspected_pid" "$inspected_started_at" "$inspected_restart_count"
}

smoke_assert_container_identity_unchanged() {
  local service=$1 expected=$2 actual
  [[ -n "$expected" ]] || return 1
  if ! actual=$(smoke_capture_container_identity "$service"); then return 1; fi
  [[ "$actual" == "$expected" ]]
}
