#!/usr/bin/env bash
# Idempotent VPS setup (Ubuntu 24.04). Run as root/sudo from the repo root on the laptop:
#   tar czf - scripts/setup-server.sh scripts/backup.sh deploy \
#     | ssh <initial-login> 'rm -rf /tmp/nusuk-setup && mkdir /tmp/nusuk-setup && tar xzf - -C /tmp/nusuk-setup && sudo bash /tmp/nusuk-setup/scripts/setup-server.sh'
# (use `ssh nusuk-vps` as the login until the deploy user works)
# Lock SSH (root + password login off) only after `ssh deploy@<host>` key login is confirmed:
#   ... sudo LOCK_SSH=1 bash /tmp/nusuk-setup/scripts/setup-server.sh
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root (sudo)" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE=/srv/nusuk-keys
INVOKER="${SUDO_USER:-root}"
INVOKER_HOME="$(getent passwd "$INVOKER" | cut -d: -f6)"

echo "==> packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg sqlite3 rclone ufw fail2ban unattended-upgrades rsync

echo "==> docker engine + compose plugin"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> deploy user"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [ -s "$INVOKER_HOME/.ssh/authorized_keys" ]; then
  touch /home/deploy/.ssh/authorized_keys
  while IFS= read -r line; do
    [ -n "$line" ] && ! grep -qxF "$line" /home/deploy/.ssh/authorized_keys && echo "$line" >> /home/deploy/.ssh/authorized_keys
  done < "$INVOKER_HOME/.ssh/authorized_keys"
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
else
  echo "WARNING: no authorized_keys for $INVOKER; add a key to /home/deploy/.ssh/authorized_keys before locking SSH." >&2
fi

echo "==> firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> fail2ban, unattended-upgrades"
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "==> swap (1 GB)"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "==> directories"
install -d -o deploy -g deploy "$BASE" "$BASE/app" "$BASE/data" "$BASE/backups"

echo "==> compose .env (uid for the app container)"
ENVF="$BASE/app/.env"
touch "$ENVF"
grep -q '^APP_UID=' "$ENVF" || echo "APP_UID=$(id -u deploy)" >> "$ENVF"
grep -q '^APP_GID=' "$ENVF" || echo "APP_GID=$(id -g deploy)" >> "$ENVF"
chown deploy:deploy "$ENVF"

echo "==> backup timer"
if [ -f "$SRC/deploy/nusuk-backup.service" ] && [ -f "$SRC/scripts/backup.sh" ]; then
  install -d -o deploy -g deploy "$BASE/app/scripts"
  install -m 755 -o deploy -g deploy "$SRC/scripts/backup.sh" "$BASE/app/scripts/backup.sh"
  install -m 644 "$SRC/deploy/nusuk-backup.service" "$SRC/deploy/nusuk-backup.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now nusuk-backup.timer
else
  echo "WARNING: deploy/ units or scripts/backup.sh not found next to this script; backup timer NOT installed." >&2
fi

if [ "${LOCK_SSH:-0}" = 1 ]; then
  echo "==> locking SSH (no root, no passwords)"
  [ -s /home/deploy/.ssh/authorized_keys ] || { echo "refusing: deploy has no authorized key" >&2; exit 1; }
  cat > /etc/ssh/sshd_config.d/00-nusuk-hardening.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
  sshd -t
  systemctl reload ssh
  echo "SSH locked. Keep your current session open and test a new one: ssh deploy@<host>"
else
  cat <<'MSG'

SSH is NOT locked yet. Next:
  1. Point your ssh config alias `nusuk-vps` at User deploy (same host/key).
  2. Confirm `ssh nusuk-vps true` works as deploy, and `ssh nusuk-vps docker ps` too.
  3. Re-run this script with LOCK_SSH=1 (see header) to disable root and password login.
  4. On the VPS as deploy: `rclone config` (remote named r2) and chmod 600 ~/.config/rclone/rclone.conf.
MSG
fi
echo "setup complete."
