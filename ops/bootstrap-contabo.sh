#!/bin/sh
set -eu

release="${1:?release id is required}"
archive="${2:?archive path is required}"
app_origin="${3:?application origin is required}"
root="/opt/release-truth-gate"
release_dir="$root/releases/$release"
shared_dir="$root/shared"
env_file="$shared_dir/.env.production"

case "$release" in
  *[!a-f0-9]* | "") echo "Invalid release id." >&2; exit 2 ;;
esac
case "$app_origin" in
  https://*) ;;
  *) echo "Production origin must use HTTPS." >&2; exit 2 ;;
esac
test -f "$archive"

install -d -m 0755 "$root/releases" "$shared_dir"
if test -e "$release_dir"; then
  echo "Release directory already exists: $release_dir" >&2
  exit 3
fi
install -d -m 0755 "$release_dir"
tar -xzf "$archive" -C "$release_dir"

if ! test -f "$env_file"; then
  umask 077
  database_password="$(openssl rand -hex 24)"
  session_secret="$(openssl rand -hex 32)"
  access_code="$(openssl rand -hex 24)"
  signing_key="$(mktemp)"
  signing_public="$(mktemp)"
  trap 'rm -f "$signing_key" "$signing_public"' EXIT
  openssl genpkey -algorithm Ed25519 -out "$signing_key"
  openssl pkey -in "$signing_key" -pubout -out "$signing_public"
  private_base64="$(base64 -w 0 "$signing_key")"
  public_base64="$(base64 -w 0 "$signing_public")"
  {
    printf '%s\n' \
      "NODE_ENV=production" \
      "APP_ORIGIN=$app_origin" \
      "APP_BIND_PORT=3187" \
      "POSTGRES_DB=release_truth" \
      "POSTGRES_USER=release_truth" \
      "POSTGRES_PASSWORD=$database_password" \
      "DATABASE_URL=postgresql://release_truth:$database_password@postgres:5432/release_truth" \
      "DATABASE_URL_DIRECT=postgresql://release_truth:$database_password@postgres:5432/release_truth" \
      "SESSION_TTL_HOURS=24" \
      "RELEASE_TRUTH_ACCESS_CODE=$access_code" \
      "RELEASE_TRUTH_SESSION_SECRET=$session_secret" \
      "RELEASE_TRUTH_REVIEWER_NAME=Authenticated reviewer" \
      "ALLOW_NOVA_SEED=false" \
      "OPENAI_API_KEY=" \
      "OPENAI_MODEL=gpt-5.6-terra" \
      "GITHUB_APP_ID=" \
      "GITHUB_APP_SLUG=" \
      "GITHUB_APP_CLIENT_ID=" \
      "GITHUB_APP_CLIENT_SECRET=" \
      "GITHUB_APP_PRIVATE_KEY=" \
      "GITHUB_WEBHOOK_SECRET=" \
      "EXPORT_SIGNING_PRIVATE_KEY_BASE64=$private_base64" \
      "EXPORT_SIGNING_PUBLIC_KEY_BASE64=$public_base64" \
      "EXPORT_SIGNING_KEY_ID=contabo-ed25519-2026-07-18"
  } > "$env_file"
  chmod 0600 "$env_file"
fi

if ! grep -q '^EXPORT_SIGNING_PRIVATE_KEY_BASE64=.' "$env_file"; then
  umask 077
  signing_key="$(mktemp)"
  signing_public="$(mktemp)"
  replacement_env="$(mktemp)"
  trap 'rm -f "$signing_key" "$signing_public" "$replacement_env"' EXIT
  openssl genpkey -algorithm Ed25519 -out "$signing_key"
  openssl pkey -in "$signing_key" -pubout -out "$signing_public"
  private_base64="$(base64 -w 0 "$signing_key")"
  public_base64="$(base64 -w 0 "$signing_public")"
  grep -v '^EXPORT_SIGNING_' "$env_file" > "$replacement_env"
  {
    printf '%s\n' \
      "EXPORT_SIGNING_PRIVATE_KEY_BASE64=$private_base64" \
      "EXPORT_SIGNING_PUBLIC_KEY_BASE64=$public_base64" \
      "EXPORT_SIGNING_KEY_ID=contabo-ed25519-2026-07-18"
  } >> "$replacement_env"
  chmod 0600 "$replacement_env"
  mv "$replacement_env" "$env_file"
fi

ln -sfn ../../shared/.env.production "$release_dir/.env.production"
ln -sfn "releases/$release" "$root/current"
cd "$root/current"
docker compose -f compose.production.yaml up -d --build --remove-orphans

install -m 0750 "$release_dir/ops/backup.sh" /usr/local/sbin/release-truth-backup
{
  printf '%s\n' \
    "SHELL=/bin/sh" \
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    "27 3 * * * root RELEASE_TRUTH_DIR=$root/current /usr/local/sbin/release-truth-backup >> /var/log/release-truth-backup.log 2>&1"
} > /etc/cron.d/release-truth-backup
chmod 0644 /etc/cron.d/release-truth-backup

docker compose -f compose.production.yaml ps
