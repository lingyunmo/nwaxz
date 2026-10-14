#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=/root/minecraft/nwaxz
image=ghcr.io/lingyunmo/nwaxz
[[ $# = 2 && $1 =~ ^[a-f0-9]{40}$ && $2 =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid release'; exit 2; }
revision=$1
digest=$2
[[ $(id -u) = 0 && $(realpath -e "$root") = "$root" ]] || exit 2
cd "$root"
exec 9>.ops/deploy.lock
flock -w 180 9
candidate=nwaxz-preflight-${revision:0:12}-$$
registry=$(mktemp -d "$root/.ops/registry.XXXXXX")
cleanup() {
  if [[ $(docker inspect -f '{{index .Config.Labels "cn.bzlom.project"}}' "$candidate" 2>/dev/null || true) = nwaxz ]]; then
    docker rm -f "$candidate" >/dev/null 2>&1 || true
  fi
  docker --config "$registry" logout ghcr.io >/dev/null 2>&1 || true
  rm -f -- "$registry/config.json"
  rmdir -- "$registry" 2>/dev/null || true
}
trap cleanup EXIT
IFS= read -r token || [[ -n ${token:-} ]]
[[ ${#token} -ge 20 && ${#token} -le 4096 ]] || { echo 'Registry credential missing'; exit 2; }
printf '%s' "$token" | docker --config "$registry" login ghcr.io -u lingyunmo --password-stdin >/dev/null
unset token
docker --config "$registry" pull "$image@$digest"
docker run -d --name "$candidate" --label cn.bzlom.project=nwaxz --network none \
  --read-only --tmpfs /tmp:rw,size=16m --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 128m --cpus 0.25 --pids-limit 64 "$image@$digest" >/dev/null
healthy=false
for attempt in $(seq 1 20); do
  if docker exec "$candidate" node ops/smoke.mjs "$revision"; then healthy=true; break; fi
  sleep 1
done
[[ $healthy = true ]] || { echo 'Candidate failed; current release untouched'; exit 1; }
previous_image=$(docker inspect -f '{{.Config.Image}}' nwaxz-app 2>/dev/null || true)
previous_revision=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' nwaxz-app 2>/dev/null | sed -n 's/^APP_REVISION=//p' || true)
if [[ -n $previous_image ]]; then
  [[ $(docker inspect -f '{{index .Config.Labels "cn.bzlom.project"}}' nwaxz-app) = nwaxz ]] || { echo 'Container ownership mismatch'; exit 2; }
fi
printf 'APP_IMAGE=%s@%s\nAPP_REVISION=%s\n' "$image" "$digest" "$revision" > .ops/runtime.env
compose=(docker compose -p nwaxz --env-file .ops/runtime.env -f compose.prod.yml)
started=false
if "${compose[@]}" up -d --no-deps nwaxz-app; then started=true; fi
healthy=false
if [[ $started = true ]]; then
  for attempt in $(seq 1 20); do
    if docker exec nwaxz-app node ops/smoke.mjs "$revision"; then healthy=true; break; fi
    sleep 2
  done
fi
if [[ $healthy != true ]]; then
  if [[ $previous_image =~ ^ghcr.io/lingyunmo/nwaxz@sha256:[a-f0-9]{64}$ && $previous_revision =~ ^[a-f0-9]{40}$ ]]; then
    printf 'APP_IMAGE=%s\nAPP_REVISION=%s\n' "$previous_image" "$previous_revision" > .ops/runtime.env
    "${compose[@]}" up -d --no-deps nwaxz-app
    recovered=false
    for attempt in $(seq 1 15); do
      if docker exec nwaxz-app node ops/smoke.mjs "$previous_revision"; then recovered=true; break; fi
      sleep 2
    done
    [[ $recovered = true ]] || { echo 'Rollback health check failed'; exit 1; }
    echo 'Release failed; previous release restored'
  else echo 'Initial release failed; no previous release available'; fi
  exit 1
fi
printf '%s\n' "$revision" > .ops/current-revision
printf 'nwaxz deployed: %s\n' "$revision"
