# GitHub Self-Generating Profile — V1.5

## 1. Objectif

Construire un profil GitHub dynamique, auto-généré et visuellement distinctif, qui se met à jour automatiquement à partir des données publiques GitHub.

Le projet doit être :

- 100 % autonome ;
- sans LLM ;
- sans clé API externe ;
- sans serveur ;
- sans base de données externe ;
- sans service payant ;
- exécutable uniquement avec GitHub Actions ;
- basé sur l’API GitHub et le `GITHUB_TOKEN` fourni nativement par GitHub Actions.

Le résultat final doit transformer le README du profil GitHub en un **dashboard vivant orienté AI / Cyber / Engineering**, capable d’indiquer automatiquement :

- les projets actuellement actifs ;
- l’activité récente ;
- les technologies réellement utilisées ;
- les statistiques principales ;
- la date de dernière génération.

---

# 2. Vision produit

Le README ne doit pas ressembler à un profil GitHub générique rempli de badges.

Il doit fonctionner comme un petit dashboard technique.

Exemple conceptuel :

```text
NOÉ BRIFFA
AI SYSTEMS · CYBERSECURITY · ENGINEERING

SYSTEM STATUS
────────────────────────────────

CURRENTLY BUILDING

01 Overlay Forge
   18 commits · updated 1d ago

02 Second Brain
   11 commits · updated 3d ago

03 Kubernetes Lab
   6 commits · updated 4d ago


ACTIVITY
────────────────────────────────

Commits / 7d        23
Commits / 30d       87
Active repositories  6
Public repositories 31


CURRENT STACK
────────────────────────────────

Python          █████████ 31%
TypeScript      ███████   24%
Docker          █████     18%
Kubernetes      ████      12%
Dart            ███        9%


LAST UPDATED

28 Sep 2026 · 04:02 UTC
```

Le design final peut être différent, mais il doit conserver cette philosophie.

---

# 3. Périmètre de la V1.5

La V1.5 doit inclure :

## Obligatoire

- génération automatique d’un SVG de profil ;
- récupération de données via GitHub API ;
- calcul de l’activité récente ;
- détection automatique des projets les plus actifs ;
- détection automatique de la stack actuelle ;
- statistiques sur 7 et 30 jours ;
- mise à jour automatique via GitHub Actions ;
- commit automatique du SVG généré ;
- fonctionnement sans clé API externe ;
- fonctionnement sans intervention humaine après installation.

## Souhaitable

- animations SVG légères ;
- effet terminal / dashboard ;
- dark mode et light mode si faisable proprement ;
- petite animation de curseur ou de scanline ;
- barres de progression ;
- mise en page responsive dans la limite de ce que GitHub README permet.

## Hors scope

Ne pas ajouter :

- LLM ;
- OpenAI ;
- Anthropic ;
- Gemini ;
- API externe nécessitant une clé ;
- serveur permanent ;
- base PostgreSQL / Supabase / Firebase ;
- système de compte utilisateur ;
- interface d’administration ;
- application web séparée ;
- analytics externes ;
- scraping fragile de GitHub HTML.

---

# 4. Architecture cible

```text
GitHub API
    │
    ▼
collect-github-data
    │
    ▼
raw-profile-data.json
    │
    ├───────────────┐
    ▼               ▼
analyze-projects   analyze-stack
    │               │
    └───────┬───────┘
            ▼
      profile-data.json
            │
            ▼
      generate-profile
            │
            ▼
      assets/profile.svg
            │
            ▼
         README.md
```

GitHub Actions orchestre l’ensemble.

---

# 5. Structure du repository

Structure recommandée :

```text
.
├── .github/
│   └── workflows/
│       └── update-profile.yml
│
├── scripts/
│   ├── collect-github-data.js
│   ├── analyze-projects.js
│   ├── analyze-stack.js
│   ├── generate-profile.js
│   └── utils.js
│
├── templates/
│   └── profile.svg
│
├── data/
│   ├── raw-profile-data.json
│   └── profile-data.json
│
├── assets/
│   └── profile.svg
│
├── config/
│   └── profile.config.json
│
├── README.md
├── package.json
└── .gitignore
```

Une implémentation TypeScript est acceptable si elle reste simple.

Node.js est recommandé pour limiter les dépendances.

---

# 6. Configuration

Créer un fichier :

```text
config/profile.config.json
```

Exemple :

```json
{
  "githubUsername": "USERNAME",
  "maxProjects": 4,
  "activityWindowDays": 30,
  "recentWindowDays": 7,
  "excludeRepositories": [
    "USERNAME",
    "old-test-repo"
  ],
  "excludeForks": true,
  "excludeArchived": true,
  "minimumActivityScore": 1
}
```

Les règles métier ne doivent pas être codées directement dans le SVG.

---

# 7. Collecte des données GitHub

Le script `collect-github-data.js` doit récupérer les informations utiles via l’API GitHub.

Utiliser :

```text
Authorization: Bearer $GITHUB_TOKEN
```

Le workflow GitHub Actions fournit le token automatiquement.

## Repositories

Pour chaque repository public pertinent récupérer au minimum :

```text
name
html_url
description
fork
archived
stargazers_count
forks_count
language
languages_url
created_at
updated_at
pushed_at
topics
default_branch
```

## Commits

Pour chaque repo actif, récupérer les commits récents nécessaires au calcul :

```text
commits 7 derniers jours
commits 30 derniers jours
date dernier commit
```

Limiter les appels API intelligemment.

Il n’est pas nécessaire de télécharger l’historique complet.

---

# 8. Analyse de l’activité

Créer un score d’activité déterministe.

Formule de départ recommandée :

```text
activity_score =
    commits_7d  × 10
  + commits_30d × 3
  + recency_bonus
  + stars_bonus
```

Exemple de `recency_bonus` :

```text
dernier commit < 3 jours   → +30
dernier commit < 7 jours   → +20
dernier commit < 14 jours  → +10
dernier commit < 30 jours  → +5
sinon                      → 0
```

Exemple de `stars_bonus` :

```text
min(stars, 20)
```

Le nombre d’étoiles ne doit pas dominer le score.

Le système vise à détecter :

```text
ce sur quoi l’utilisateur travaille réellement maintenant
```

et non les repos historiquement populaires.

---

# 9. Statut automatique des repositories

Attribuer un statut simple.

## ACTIVE

Critère recommandé :

```text
commit durant les 14 derniers jours
```

## MAINTAINED

```text
dernier commit entre 14 et 90 jours
```

## DORMANT

```text
aucun commit depuis plus de 90 jours
```

## ARCHIVED

Utiliser directement la propriété GitHub `archived`.

Les seuils doivent pouvoir être modifiés facilement dans la configuration.

---

# 10. Sélection de "Currently Building"

Sélectionner automatiquement les repos ayant le score d’activité le plus élevé.

Exemple :

```text
maxProjects = 4
```

Le système trie :

```text
activity_score DESC
```

Puis affiche les meilleurs projets admissibles.

Exclure par défaut :

- repository de profil ;
- forks ;
- archives ;
- repositories explicitement exclus dans la configuration.

Pour chaque projet afficher idéalement :

```text
nom
description courte
commits 7d ou 30d
dernier update
langage principal
statut
lien
```

---

# 11. Analyse automatique de la stack

Objectif :

ne pas afficher une stack déclarative et figée.

La section `CURRENT STACK` doit refléter les technologies réellement présentes dans les repos actifs.

Analyser en priorité :

```text
package.json
requirements.txt
pyproject.toml
Pipfile
Dockerfile
docker-compose.yml
compose.yml
go.mod
Cargo.toml
pubspec.yaml
pom.xml
build.gradle
*.csproj
```

Également :

```text
.github/workflows/
k8s/
kubernetes/
helm/
terraform/
```

---

# 12. Mapping de technologies

Créer un mapping déterministe.

Exemples :

```text
Dockerfile
→ Docker

docker-compose.yml
→ Docker Compose

k8s/*.yaml
→ Kubernetes

package.json contenant react
→ React

package.json contenant next
→ Next.js

package.json contenant typescript
→ TypeScript

requirements.txt contenant fastapi
→ FastAPI

requirements.txt contenant torch
→ PyTorch

pyproject.toml contenant fastapi
→ FastAPI

pubspec.yaml
→ Dart / Flutter

terraform/*.tf
→ Terraform
```

Le mapping doit être isolé dans un fichier ou une structure maintenable.

---

# 13. Pondération de la stack

Ne pas compter toutes les technologies de tous les repos de manière égale.

Pondérer par activité récente.

Exemple :

```text
repo_weight =
1 + log(1 + commits_30d)
```

Puis :

```text
technology_score =
Σ repo_weight
```

pour chaque technologie détectée.

Ainsi :

un vieux projet Flutter abandonné ne doit pas apparaître devant Python si Python est utilisé actuellement.

---

# 14. Données calculées finales

Le fichier :

```text
data/profile-data.json
```

devrait ressembler à :

```json
{
  "generatedAt": "2026-09-28T04:02:00Z",
  "stats": {
    "publicRepositories": 31,
    "activeRepositories": 6,
    "commits7d": 23,
    "commits30d": 87
  },
  "projects": [
    {
      "name": "overlay-forge",
      "url": "...",
      "description": "...",
      "status": "ACTIVE",
      "commits7d": 18,
      "commits30d": 31,
      "lastCommit": "2026-09-27",
      "primaryLanguage": "TypeScript",
      "activityScore": 207
    }
  ],
  "stack": [
    {
      "name": "Python",
      "score": 42,
      "percentage": 31
    }
  ]
}
```

---

# 15. Génération SVG

Le script :

```text
generate-profile.js
```

doit prendre :

```text
data/profile-data.json
```

et produire :

```text
assets/profile.svg
```

Le SVG doit être autonome.

Éviter les dépendances réseau externes.

---

# 16. Design recommandé

Direction graphique :

```text
AI / CYBER / ENGINEERING DASHBOARD
```

et non :

```text
README badge collection
```

Le rendu peut s’inspirer de :

- terminal moderne ;
- SOC dashboard ;
- command center ;
- AI lab ;
- HUD minimaliste.

Éviter le style hacker cliché trop chargé.

---

# 17. Sections recommandées

Ordre possible :

```text
HEADER

NAME
TAGLINE


CURRENTLY BUILDING

project 1
project 2
project 3
project 4


ACTIVITY

commits 7d
commits 30d
active repos
public repos


CURRENT STACK

technology bars


OPTIONAL

contribution mini-graph
recent activity indicator


LAST UPDATED
```

---

# 18. Animations SVG

Animations autorisées si elles restent légères.

Exemples :

```text
curseur clignotant
apparition progressive des lignes
barres qui se remplissent
scanline très légère
petit pulse sur ACTIVE
```

Ne pas créer :

- animations agressives ;
- temps de chargement artificiel ;
- gros effets 3D ;
- animations trop longues ;
- clignotements gênants.

Le profil doit rester lisible immédiatement.

---

# 19. Dark mode / Light mode

Si possible, utiliser :

```css
@media (prefers-color-scheme: dark)
```

dans le SVG.

Exemple :

```css
:root {
  --background: #f5f5f5;
  --text: #181818;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #111111;
    --text: #eeeeee;
  }
}
```

Valider que GitHub conserve correctement le rendu.

Si le support est trop fragile, privilégier un seul thème très propre.

---

# 20. GitHub Actions

Créer :

```text
.github/workflows/update-profile.yml
```

Triggers :

```yaml
on:
  workflow_dispatch:

  schedule:
    - cron: "0 4 * * *"
```

La fréquence quotidienne suffit.

---

# 21. Permissions GitHub Actions

Le workflow doit pouvoir commit les changements :

```yaml
permissions:
  contents: write
```

---

# 22. Étapes du workflow

Pipeline attendu :

```text
checkout
↓
setup Node
↓
npm ci
↓
collect GitHub data
↓
analyze projects
↓
analyze stack
↓
generate SVG
↓
git diff
↓
commit si changement
↓
push
```

Pseudo-workflow :

```yaml
steps:

  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: 22

  - run: npm ci

  - run: npm run generate
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  - name: Commit updated profile
    run: |
      git config user.name "github-actions[bot]"
      git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      git add assets/profile.svg data/profile-data.json

      git diff --cached --quiet || \
        git commit -m "chore: update GitHub profile"

      git push
```

---

# 23. Scripts npm

Exemple :

```json
{
  "scripts": {
    "collect": "node scripts/collect-github-data.js",
    "analyze:projects": "node scripts/analyze-projects.js",
    "analyze:stack": "node scripts/analyze-stack.js",
    "render": "node scripts/generate-profile.js",
    "generate": "npm run collect && npm run analyze:projects && npm run analyze:stack && npm run render"
  }
}
```

---

# 24. README final

Le README du repo profil doit rester minimal.

Exemple :

```md
<p align="center">
  <img src="./assets/profile.svg" width="100%" />
</p>
```

Optionnellement ajouter en dessous quelques liens simples :

```text
Portfolio
LinkedIn
Email
```

Ne pas dupliquer les informations déjà présentes dans le SVG.

---

# 25. Gestion des limites API

Le système doit éviter de faire :

```text
N repositories × historique complet des commits
```

Optimisations :

- ne charger que les repos récemment actifs ;
- utiliser des filtres temporels ;
- ignorer les repos archivés ;
- ignorer les forks ;
- limiter les appels aux contenus des repos ;
- analyser la stack principalement sur les repos actifs.

Ajouter une gestion claire des erreurs API.

Le workflow ne doit pas casser complètement parce qu’un repo individuel répond mal.

---

# 26. Robustesse

Le système doit fonctionner si :

- aucun commit sur 7 jours ;
- aucun repo actif ;
- une technologie n’est pas détectée ;
- une description est absente ;
- un nom de repo est très long ;
- GitHub API renvoie une erreur partielle ;
- un repo est privé ou inaccessible ;
- une statistique est à zéro.

Ne jamais afficher :

```text
undefined
NaN
null
```

dans le SVG.

---

# 27. Logs

Les scripts doivent produire des logs simples :

```text
[collect] 28 repositories found
[collect] 9 active repositories
[projects] selected 4 projects
[stack] 12 technologies detected
[render] profile.svg generated
```

Pas besoin de framework de logging.

---

# 28. Tests minimum

Ajouter au minimum des tests ou fixtures pour :

```text
calcul activité
classement projets
mapping technologies
normalisation des pourcentages
texte SVG échappé
```

Attention particulière à l’échappement XML :

```text
&
<
>
"
```

Les descriptions GitHub peuvent casser un SVG si elles ne sont pas échappées.

---

# 29. Critères d’acceptation

La V1.5 est considérée terminée si :

- [ ] le README affiche correctement `assets/profile.svg`
- [ ] le SVG est généré automatiquement
- [ ] aucune clé externe n’est nécessaire
- [ ] GitHub Actions fonctionne manuellement
- [ ] GitHub Actions fonctionne quotidiennement
- [ ] les projets affichés sont choisis automatiquement
- [ ] l’activité 7 jours fonctionne
- [ ] l’activité 30 jours fonctionne
- [ ] les repos archivés sont exclus
- [ ] les forks sont exclus par défaut
- [ ] la stack est détectée automatiquement
- [ ] la stack dépend de l’activité récente
- [ ] le SVG ne casse jamais sur texte utilisateur
- [ ] aucune valeur `null`, `undefined` ou `NaN` n’est visible
- [ ] aucun service externe n’est requis
- [ ] le workflow commit uniquement lorsqu’il existe une modification
- [ ] le projet peut être configuré sans modifier le cœur du code

---

# 30. Priorités de développement

## Phase 1 — Data

Faire fonctionner parfaitement :

```text
GitHub API
→ JSON
```

Avant de travailler sérieusement sur le design.

Livrable :

```text
data/profile-data.json
```

fiable.

---

## Phase 2 — Ranking

Implémenter :

```text
activité
status
currently building
```

Valider manuellement que les repos sélectionnés correspondent réellement aux projets actifs.

---

## Phase 3 — Stack

Implémenter l’analyse de stack.

Commencer avec peu de règles fiables :

```text
Python
TypeScript
JavaScript
Docker
Kubernetes
React
FastAPI
PyTorch
Flutter
Dart
```

Ajouter ensuite d’autres technologies.

---

## Phase 4 — SVG

Construire une première version simple.

Ne pas commencer immédiatement avec beaucoup d’animations.

Ordre :

```text
layout
↓
typographie
↓
données
↓
responsive
↓
animations
```

---

## Phase 5 — GitHub Actions

Automatiser la génération.

Tester :

```text
workflow_dispatch
```

avant d’activer le cron.

---

## Phase 6 — Polish

Seulement après fonctionnement complet :

```text
animations
dark mode
micro-interactions
alignements
typographie
```

---

# 31. Répartition conseillée entre agents

Si plusieurs agents peuvent travailler en parallèle :

## Agent A — Data / GitHub API

Responsable de :

```text
collect-github-data
gestion pagination
commits
rate limits
normalisation JSON
```

Livrable :

```text
raw-profile-data.json
```

---

## Agent B — Analysis

Responsable de :

```text
activity score
repo status
ranking
stack detection
technology weighting
```

Livrable :

```text
profile-data.json
```

---

## Agent C — SVG / Frontend

Responsable de :

```text
template SVG
layout
animations
dark/light
escaping
responsive
```

Livrable :

```text
assets/profile.svg
```

---

## Agent D — CI/CD

Responsable de :

```text
GitHub Actions
npm scripts
permissions
commit automatique
cron
```

---

## Reviewer

Doit vérifier :

```text
architecture
bugs
API limits
XML escaping
workflow
qualité du rendu
complexité inutile
```

Le reviewer doit supprimer toute abstraction ou dépendance qui n’apporte pas de valeur réelle.

---

# 32. Principes à respecter

## Keep it deterministic

À données GitHub identiques :

```text
même sortie
```

## Keep it cheap

Coût :

```text
0 €
```

## Keep it autonomous

Après installation :

```text
aucune intervention requise
```

## Keep it explainable

Chaque valeur affichée doit pouvoir être expliquée par une règle claire.

## Keep it maintainable

Éviter une architecture disproportionnée pour un README GitHub.

---

# 33. Définition finale de la V1.5

La V1.5 n’est pas simplement :

```text
un beau README
```

Elle doit être :

```text
un dashboard GitHub auto-généré
qui observe l’activité réelle du compte,
détermine automatiquement les projets actuels,
déduit la stack réellement utilisée,
et reconstruit quotidiennement le profil.
```

Pipeline final :

```text
GitHub
   ↓
Collect
   ↓
Analyze
   ↓
Rank
   ↓
Render
   ↓
GitHub Actions
   ↓
README vivant
```

Le système doit rester petit, déterministe, gratuit et suffisamment propre pour constituer lui-même un projet portfolio crédible.
