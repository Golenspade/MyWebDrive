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
