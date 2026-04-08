#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_REPO="${IMAGE_REPO:-kevinchina/deeplearning}"
VERSION=""
IMAGE_ID=""
PUSH=false
RUN_TESTS=true
RUN_BUILDS=true
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
INSTALL_ALIYUNPAN="${INSTALL_ALIYUNPAN:-false}"
SERVICES=(caddy server website admin waline)

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/release-images.sh [options]

Options:
  --version <vX.Y.Z>     Release version. Defaults to the root package.json version prefixed with v.
  --image-id <id>        Release image id. Defaults to the current git short SHA.
  --repo <repo>          Image repository. Default: kevinchina/deeplearning
  --platforms <list>     buildx platforms. Default: linux/amd64,linux/arm64
  --push                 Push images after building.
  --skip-tests           Skip pnpm test:blog-flow.
  --skip-builds          Skip pnpm build:website and pnpm build:admin when tests are skipped.
  --help                 Show this message.

Tag strategy:
  <repo>:vanblog-<service>-<version>-<image-id>  # immutable release tag
  <repo>:vanblog-<service>-<version>             # version alias
  <repo>:vanblog-<service>-latest                # moving alias
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

while [[ $# -gt 0 ]]; do
  case "$1" in
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
    --push)
      PUSH=true
      shift
      ;;
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    --skip-builds)
      RUN_BUILDS=false
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
require_cmd pnpm

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "'v' + require('./package.json').version")"
fi

if [[ -z "$IMAGE_ID" ]]; then
  IMAGE_ID="$(git rev-parse --short=8 HEAD)"
fi

RELEASE_SUFFIX="${VERSION}-${IMAGE_ID}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Warning: git worktree is not clean. Releasing from a dirty tree may reduce traceability." >&2
fi

if $RUN_TESTS; then
  echo ">>> Running full release smoke flow"
  pnpm test:blog-flow
elif $RUN_BUILDS; then
  echo ">>> Building website/admin assets required by release images"
  pnpm build:website
  pnpm build:admin
fi

build_service() {
  local service="$1"
  local image_name="vanblog-${service}"
  local immutable_tag="${IMAGE_REPO}:${image_name}-${RELEASE_SUFFIX}"
  local version_tag="${IMAGE_REPO}:${image_name}-${VERSION}"
  local latest_tag="${IMAGE_REPO}:${image_name}-latest"
  local dockerfile="docker/${service}.Dockerfile"
  local args=(
    --build-arg "VANBLOG_IMAGE_NAME=${image_name}"
    --build-arg "VANBLOG_IMAGE_VERSION=${VERSION}"
    --build-arg "VANBLOG_IMAGE_ID=${IMAGE_ID}"
  )

  if [[ "$service" == "server" ]]; then
    args+=(--build-arg "INSTALL_ALIYUNPAN=${INSTALL_ALIYUNPAN}")
  fi

  echo
  echo ">>> Building ${service}"
  echo "    ${immutable_tag}"
  echo "    ${version_tag}"
  echo "    ${latest_tag}"

  if $PUSH; then
    docker buildx build \
      --platform "$PLATFORMS" \
      --file "$dockerfile" \
      --tag "$immutable_tag" \
      --tag "$version_tag" \
      --tag "$latest_tag" \
      "${args[@]}" \
      --push \
      .
  else
    docker build \
      --file "$dockerfile" \
      --tag "$immutable_tag" \
      --tag "$version_tag" \
      --tag "$latest_tag" \
      "${args[@]}" \
      .
  fi
}

echo "Release repository : ${IMAGE_REPO}"
echo "Release version    : ${VERSION}"
echo "Release image id   : ${IMAGE_ID}"
echo "Release suffix     : ${RELEASE_SUFFIX}"
echo "Push enabled       : ${PUSH}"

for service in "${SERVICES[@]}"; do
  build_service "$service"
done

echo
cat <<SUMMARY
Release completed.

Recommended deploy env:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO}
  VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX}

Example deploy command:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO} VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX} docker compose -f docker-compose.image.yml up -d
SUMMARY
