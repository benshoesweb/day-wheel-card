#!/usr/bin/env bash
# Prépare la demande d'entrée dans le catalogue par défaut (hacs/default, fichier « plugin »),
# utilisé par HACS et par la Marketplace de Home Assistant.
# À lancer une seule fois, quand « Validate » est vert et qu'une release existe.
# La demande est ouverte dans le navigateur : il reste à remplir le modèle (cases à cocher,
# lien vers la dernière release, lien vers une exécution « Validate » réussie).
set -euo pipefail

REPO=day-wheel-card
OWNER="$(gh api user --jq .login)"
ENTRY="${OWNER}/${REPO}"
WORK="$(mktemp -d)"

gh release view --repo "$ENTRY" >/dev/null 2>&1 || { echo "Aucune release publiée sur $ENTRY"; exit 1; }

cd "$WORK"
gh repo fork hacs/default --clone --remote -- --depth 1 >/dev/null
cd default
git checkout -q -b "add-${REPO}"

# Ajoute l'entrée en respectant l'ordre alphabétique du fichier
python3 - "$ENTRY" <<'EOF'
import json, sys
entry = sys.argv[1]
with open("plugin", encoding="utf-8") as f:
    items = json.load(f)
if any(x.lower() == entry.lower() for x in items):
    sys.exit(f"{entry} est déjà dans la liste")
items.append(entry)
items.sort(key=str.casefold)
with open("plugin", "w", encoding="utf-8") as f:
    f.write(json.dumps(items, indent=2) + "\n")
EOF

git diff --stat
git commit -q -am "Add ${ENTRY}"
git push -q -u origin "add-${REPO}"
gh pr create --repo hacs/default --head "${OWNER}:add-${REPO}" --title "Add ${ENTRY}" --web
