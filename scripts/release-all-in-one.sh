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
PLATFORMS="${PLATFORMS:-linux/amd64}"
ALPINE_MIRROR_HOST="${ALPINE_MIRROR_HOST:-}"
IMAGE_NAME="vanblog-all-in-one"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/release-all-in-one.sh [options]

Options:
  --version <vX.Y.Z>     Release version. Defaults to the root package.json version prefixed with v.
  --image-id <id>        Release image id. Defaults to the current git short SHA.
  --repo <repo>          Image repository. Default: kevinchina/deeplearning
  --platforms <list>     buildx platforms. Default: linux/amd64
  --push                 Push images after building.
  --skip-tests           Skip pnpm test:blog-flow:all-in-one.
  --skip-builds          Skip any extra prebuild work when tests are skipped.
  --help                 Show this message.

Tag strategy:
  <repo>:vanblog-all-in-one-<version>-<image-id>  # immutable release tag
  <repo>:vanblog-all-in-one-<version>             # version alias
  <repo>:vanblog-all-in-one-latest                # moving alias
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
IMMUTABLE_TAG="${IMAGE_REPO}:${IMAGE_NAME}-${RELEASE_SUFFIX}"
VERSION_TAG="${IMAGE_REPO}:${IMAGE_NAME}-${VERSION}"
LATEST_TAG="${IMAGE_REPO}:${IMAGE_NAME}-latest"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Warning: git worktree is not clean. Releasing from a dirty tree may reduce traceability." >&2
fi

if $RUN_TESTS; then
  echo ">>> Running all-in-one release smoke flow"
  pnpm test:blog-flow:all-in-one
elif $RUN_BUILDS; then
  echo ">>> No extra prebuild step is required beyond docker build context preparation"
fi

echo "Release repository : ${IMAGE_REPO}"
echo "Release version    : ${VERSION}"
echo "Release image id   : ${IMAGE_ID}"
echo "Release suffix     : ${RELEASE_SUFFIX}"
echo "Push enabled       : ${PUSH}"
if [[ -n "$ALPINE_MIRROR_HOST" ]]; then
  echo "Alpine mirror host : ${ALPINE_MIRROR_HOST}"
fi

echo
echo ">>> Building all-in-one image"
echo "    ${IMMUTABLE_TAG}"
echo "    ${VERSION_TAG}"
echo "    ${LATEST_TAG}"

build_args=(
  --build-arg "VANBLOG_IMAGE_NAME=${IMAGE_NAME}"
  --build-arg "VANBLOG_IMAGE_VERSION=${VERSION}"
  --build-arg "VANBLOG_IMAGE_ID=${IMAGE_ID}"
)

if [[ -n "$ALPINE_MIRROR_HOST" ]]; then
  build_args+=(--build-arg "ALPINE_MIRROR_HOST=${ALPINE_MIRROR_HOST}")
fi

if $PUSH; then
  docker buildx build \
    --platform "$PLATFORMS" \
    --file docker/all-in-one.Dockerfile \
    --tag "$IMMUTABLE_TAG" \
    --tag "$VERSION_TAG" \
    --tag "$LATEST_TAG" \
    "${build_args[@]}" \
    --push \
    .
else
  docker build \
    --file docker/all-in-one.Dockerfile \
    --tag "$IMMUTABLE_TAG" \
    --tag "$VERSION_TAG" \
    --tag "$LATEST_TAG" \
    "${build_args[@]}" \
    .
fi

echo
cat <<SUMMARY
All-in-one release completed.

Recommended deploy env:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO}
  VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX}

Example deploy command:
  VANBLOG_DOCKER_REPO=${IMAGE_REPO} VANBLOG_RELEASE_SUFFIX=${RELEASE_SUFFIX} docker compose -f docker-compose.all-in-one.image.yml up -d
SUMMARY
