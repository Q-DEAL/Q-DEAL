#!/usr/bin/env bash
# Installs the pinned dbmate release (migration tool) after checking its SHA-256.
# Used by the Codespace image and by CI; bump VERSION and both checksums together.
set -euo pipefail

VERSION=2.36.0
case "$(uname -m)" in
  x86_64)        ARCH=amd64; SHA256=47e284b3d8cbad1ba5f090495aa05afd1bbd5f35e2ed5577aad06da74ce780ce ;;
  aarch64|arm64) ARCH=arm64; SHA256=c7d49db4b54e487eddf8ce7d6e88f4035e1eb04c7edb16008f668cdfad2f29e8 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

DEST=${1:-/usr/local/bin/dbmate}
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsSL -o "$tmp" "https://github.com/amacneil/dbmate/releases/download/v${VERSION}/dbmate-linux-${ARCH}"
echo "${SHA256}  ${tmp}" | sha256sum --check --quiet -
install -m 0755 "$tmp" "$DEST"
echo "dbmate ${VERSION} installed in ${DEST}"
