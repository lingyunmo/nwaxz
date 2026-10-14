#!/usr/bin/env bash
set -euo pipefail
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([a-f0-9]{40})\ (sha256:[a-f0-9]{64})$ ]]; then
  exec sudo -n /root/minecraft/nwaxz/ops/deploy.sh "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
echo 'This key can only deploy nwaxz releases' >&2
exit 2
