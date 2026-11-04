#!/usr/bin/env bash
# Publie une nouvelle version : commit des changements, tag, push => workflow « Release ».
# Usage : ./scripts/release.sh v1.0.0        (v1.2.0-beta.1 => pré-version)
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION="${1:?Usage : ./scripts/release.sh vX.Y.Z}"
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "Version attendue : vX.Y.Z (ex. v1.0.0)"; exit 1; }
git rev-parse "$VERSION" >/dev/null 2>&1 && { echo "Le tag $VERSION existe déjà"; exit 1; }

# Vérifie la syntaxe si Node.js est installé (le workflow la vérifie de toute façon)
if command -v node >/dev/null; then node --check dist/day-wheel-card.js; fi

git add -A
git commit -q -m "Version ${VERSION}" || echo "(rien de nouveau à valider)"
git push -q
git tag "$VERSION"
git push -q origin "$VERSION"
echo "Tag $VERSION envoyé : la release sera créée par GitHub Actions dans une minute."
