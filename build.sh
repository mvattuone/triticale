#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: build.sh [options] [project-name]

Options:
  -w, --watch   Run esbuild in watch mode.
  -h, --help    Show this help message.

If project-name is omitted, the script uses the current directory name.
EOF
}

watch_mode=0
project_name=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--watch)
      watch_mode=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      project_name="$1"
      shift
      ;;
  esac
done

if [[ -z "${project_name}" ]]; then
  project_name="$(basename "$PWD")"
fi

outfile="${project_name}.bundle.js"

cmd=(
  npx -y esbuild microfrontend.js
  --bundle
  --format=esm
  --target=es2020
  --outfile="${outfile}"
  --loader:.html=text
  --loader:.css=text
  --alias:helpers=./helpers
  --external:https://*
  --external:databender
  --external:pizzicato
)

if [[ ${watch_mode} -eq 1 ]]; then
  cmd+=(--watch)
fi

exec "${cmd[@]}"
