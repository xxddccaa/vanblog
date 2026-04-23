#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_REPO="${IMAGE_REPO:-kevinchina/deeplearning}"
VERSION=""
IMAGE_ID=""
PLATFORMS="${PLATFORMS:-linux/amd64}"
RUN_TESTS=true
RUN_BUILDS=true
INSTALL_ALIYUNPAN="${INSTALL_ALIYUNPAN:-false}"
ALPINE_MIRROR_HOST="${ALPINE_MIRROR_HOST:-}"
DRY_RUN=false
MODE="publish"
SERVICES=(caddy server website admin waline)

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/release-publish.sh [options]
  bash scripts/release-publish.sh sync-latest [options]

Modes:
  publish       Build/push release tags through scripts/release-images.sh, then force-sync latest tags.
  sync-latest   Only sync and verify the latest tags from an existing version tag.

Options:
  --version <vX.Y.Z>     Release version. Defaults to the root package.json version prefixed with v.
  --image-id <id>        Release image id. Defaults to the current git short SHA.
  --repo <repo>          Image repository. Default: kevinchina/deeplearning
  --platforms <list>     buildx platforms passed to scripts/release-images.sh. Default: linux/amd64
  --skip-tests           Skip pnpm test:blog-flow during publish.
  --skip-builds          Skip pnpm build:website and pnpm build:admin when tests are skipped.
  --dry-run              Print commands without executing them.
  --latest-only          Alias of sync-latest mode.
  --help                 Show this message.

Environment passthrough:
  IMAGE_REPO, PLATFORMS, INSTALL_ALIYUNPAN, ALPINE_MIRROR_HOST

Validation strategy:
  For each service, the script verifies that the immutable tag, version alias, and latest alias
  all resolve to images whose labels match the expected release version and image id.
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

normalize_version() {
  local raw="$1"
  if [[ "$raw" == v* ]]; then
    printf '%s' "$raw"
  else
    printf 'v%s' "$raw"
  fi
}

run_cmd() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'

  if ! $DRY_RUN; then
    "$@"
  fi
}

image_name() {
  local service="$1"
  printf 'vanblog-%s' "$service"
}

immutable_tag() {
  local service="$1"
  printf '%s:%s-%s-%s' "$IMAGE_REPO" "$(image_name "$service")" "$VERSION" "$IMAGE_ID"
}

version_tag() {
  local service="$1"
  printf '%s:%s-%s' "$IMAGE_REPO" "$(image_name "$service")" "$VERSION"
}

latest_tag() {
  local service="$1"
  printf '%s:%s-latest' "$IMAGE_REPO" "$(image_name "$service")"
}

verify_tag_labels() {
  local tag="$1"

  if $DRY_RUN; then
    echo "    verify ${tag} -> version=${VERSION}, image-id=${IMAGE_ID}"
    return 0
  fi

  run_cmd docker pull "$tag"

  local version_label=""
  local image_id_label=""
  version_label="$(docker image inspect "$tag" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
  image_id_label="$(docker image inspect "$tag" --format '{{index .Config.Labels "io.vanblog.image.id"}}')"

  if [[ "$version_label" != "$VERSION" ]]; then
    echo "Verification failed for ${tag}: expected version ${VERSION}, got ${version_label}" >&2
    exit 1
  fi

  if [[ "$image_id_label" != "$IMAGE_ID" ]]; then
    echo "Verification failed for ${tag}: expected image id ${IMAGE_ID}, got ${image_id_label}" >&2
    exit 1
  fi
}

sync_latest_for_service() {
  local service="$1"
  local source_tag
  local moving_tag
  source_tag="$(version_tag "$service")"
  moving_tag="$(latest_tag "$service")"

  echo
  echo ">>> Sync latest alias for ${service}"
  echo "    source: ${source_tag}"
  echo "    target: ${moving_tag}"

  run_cmd docker pull "$source_tag"
  run_cmd docker tag "$source_tag" "$moving_tag"
  run_cmd docker push "$moving_tag"
}

verify_service_release() {
  local service="$1"
  local immutable
  local version_alias
  local latest_alias
  immutable="$(immutable_tag "$service")"
  version_alias="$(version_tag "$service")"
  latest_alias="$(latest_tag "$service")"

  echo
  echo ">>> Verify ${service}"
  verify_tag_labels "$immutable"
  verify_tag_labels "$version_alias"
  verify_tag_labels "$latest_alias"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    publish)
      MODE="publish"
      shift
      ;;
    sync-latest)
      MODE="sync-latest"
      shift
      ;;
    --latest-only)
      MODE="sync-latest"
      shift
      ;;
    --version)
      VERSION="$(normalize_version "$2")"
      shift 2
      ;;
    --image-id)
      IMAGE_ID="$2"
      shift 2
      ;;
    --repo)
      IMAGE_REPO="$2"
      shift 2
      ;;
    --platforms)
      PLATFORMS="$2"
      shift 2
      ;;
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    --skip-builds)
      RUN_BUILDS=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd git
require_cmd docker
require_cmd node

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "'v' + require('./package.json').version")"
fi

if [[ -z "$IMAGE_ID" ]]; then
  IMAGE_ID="$(git rev-parse --short=8 HEAD)"
fi

RELEASE_SUFFIX="${VERSION}-${IMAGE_ID}"

echo "Release repository : ${IMAGE_REPO}"
echo "Release version    : ${VERSION}"
echo "Release image id   : ${IMAGE_ID}"
echo "Release suffix     : ${RELEASE_SUFFIX}"
echo "Mode               : ${MODE}"
echo "Dry run            : ${DRY_RUN}"
if [[ -n "$ALPINE_MIRROR_HOST" ]]; then
  echo "Alpine mirror host : ${ALPINE_MIRROR_HOST}"
fi

if [[ "$MODE" == "publish" ]]; then
  require_cmd pnpm

  release_args=(
    bash
    scripts/release-images.sh
    --version "$VERSION"
    --image-id "$IMAGE_ID"
    --repo "$IMAGE_REPO"
    --platforms "$PLATFORMS"
    --push
  )

  if ! $RUN_TESTS; then
    release_args+=(--skip-tests)
  fi

  if ! $RUN_BUILDS; then
    release_args+=(--skip-builds)
  fi

  echo
  echo ">>> Publish release tags through scripts/release-images.sh"
  run_cmd "${release_args[@]}"
fi

for service in "${SERVICES[@]}"; do
  sync_latest_for_service "$service"
done

for service in "${SERVICES[@]}"; do
  verify_service_release "$service"
done

echo
cat <<SUMMARY
Release publish completed.

Recommended deploy env:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO}
  VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX}

Latest aliases verified for:
  ${SERVICES[*]}

Example deploy command:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO} VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX} docker compose -f docker-compose.image.yml up -d
SUMMARY
