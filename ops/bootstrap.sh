#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/root/minecraft/nwaxz
[[ $(id -u) = 0 && $(realpath -e "$root") = "$root" ]] || exit 2
[[ $# = 1 && -f $1 ]] || exit 2
key=$(tr -d '\r' < "$1")
[[ $key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+\ nwaxz-actions$ ]] || exit 2
docker network inspect common-net >/dev/null
command -v sudo >/dev/null
if id nwaxz-deploy >/dev/null 2>&1; then echo 'Deploy user already exists; inspect before proceeding'; exit 2; fi
[[ ! -e /etc/sudoers.d/nwaxz-deploy ]] || exit 2
useradd --create-home --shell /bin/bash nwaxz-deploy
install -d -m 700 "$root/.ops"
install -d -m 755 -o root -g root /home/nwaxz-deploy/.ssh
install -m 755 -o root -g root "$root/ops/ssh-command.sh" /home/nwaxz-deploy/deploy-command
printf 'restrict,command="/home/nwaxz-deploy/deploy-command" %s\n' "$key" > /home/nwaxz-deploy/.ssh/authorized_keys
chmod 644 /home/nwaxz-deploy/.ssh/authorized_keys
printf 'nwaxz-deploy ALL=(root) NOPASSWD: /root/minecraft/nwaxz/ops/deploy.sh\n' > /etc/sudoers.d/nwaxz-deploy
chmod 440 /etc/sudoers.d/nwaxz-deploy
visudo -cf /etc/sudoers.d/nwaxz-deploy
chmod 700 "$root/ops/deploy.sh"
echo 'nwaxz restricted deployment user ready'
