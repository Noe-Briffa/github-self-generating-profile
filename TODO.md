# TODO — GitHub Self-Generating Profile V1.5

Source : `github-self-generating-profile-v1.5.md`
Principe : cocher au fur et à mesure. Ne cocher que si vérifié.

---

## Phase 0 — Setup repo

- [x] Créer `package.json` avec scripts `collect`, `analyze:projects`, `analyze:stack`, `render`, `generate` (`generate = collect && analyze:projects && analyze:stack && render` §23)
- [x] Créer arborescence `.github/workflows/`, `scripts/`, `templates/`, `data/`, `assets/`, `config/`
- [x] Créer `config/profile.config.json` (`githubUsername`, `maxProjects=4`, `activityWindowDays=30`, `recentWindowDays=7`, `activeDays=14`, `maintainedDays=90`, `excludeRepositories`, `excludeForks=true`, `excludeArchived=true`, `minimumActivityScore=1`)
- [x] Créer `.gitignore` (`node_modules/`, fichiers temporaires)
- [x] Vérifier `node --version` compatible Node 22

## Phase 1 — Data / Collecte GitHub API

- [x] Créer `scripts/utils.js` (fetch, logs, gestion erreurs, helpers dates)
- [x] Créer `scripts/collect-github-data.js` avec `Authorization: Bearer $GITHUB_TOKEN`
- [x] Lister repos publics + pagination (`name`, `html_url`, `description`, `fork`, `archived`, `stargazers_count`, `forks_count`, `language`, `languages_url`, `created_at`, `updated_at`, `pushed_at`, `topics`, `default_branch`)
- [x] Filtrer forks / archivés / exclus config avant appels lourds, filtres temporels, stack sur actifs seuls, limiter appels contenus, gérer rate-limit (§25)
- [x] Récupérer commits 7d / 30d + date dernier commit (sans historique complet)
- [x] Écrire `data/raw-profile-data.json` stable et normalisé
- [x] Logs `[collect] N repositories found / N active`
- [x] Ne jamais crasher sur 1 repo en erreur (try/catch par repo, erreur API partielle tolérée)

## Phase 2 — Ranking / Projets

- [x] Créer `scripts/analyze-projects.js`
- [x] Implémenter `activity_score = commits_7d×10 + commits_30d×3 + recency_bonus + stars_bonus`
- [x] Implémenter `recency_bonus` (<3j +30, <7j +20, <14j +10, <30j +5, sinon 0)
- [x] Implémenter `stars_bonus = min(stars,20)`
- [x] Implémenter statuts ACTIVE (<14j), MAINTAINED (14-90j), DORMANT (>90j), ARCHIVED (champ GitHub), seuils configurables
- [x] Trier `lastCommit DESC`, tiebreak `activity_score DESC` (choix user 28/09, diverge spec §10 tri score seul), exclure profil/forks/archives/exclus config + `minimumActivityScore`
- [x] Vérifier manuellement sélection = vrais projets actifs (vérifié 28/09 live : token-dashboard, Noe-Briffa.github.io, image-colorization-nn, local-rag-assistant-poc)
- [x] Logs `[projects] selected N projects`

## Phase 3 — Stack réelle

- [x] Créer `scripts/analyze-stack.js`
- [x] Scanner repos actifs : `package.json`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `Dockerfile`, `docker-compose.yml`, `compose.yml`, `go.mod`, `Cargo.toml`, `pubspec.yaml`, `pom.xml`, `build.gradle`, `*.csproj`
- [x] Scanner `.github/workflows/`, `k8s/`, `kubernetes/`, `helm/`, `terraform/`
- [x] Créer mapping déterministe isolé (Docker, Docker Compose, Kubernetes, React, Next.js, TypeScript, FastAPI, PyTorch, Dart/Flutter, Terraform)
- [x] Pondérer `repo_weight = 1 + log(1 + commits_30d)`, `technology_score = Σ repo_weight`, normaliser `%`
- [x] Démarrer base fiable : Python, TypeScript, JavaScript, Docker, Kubernetes, React, FastAPI, PyTorch, Flutter, Dart
- [x] Écrire `data/profile-data.json` format §14 (`generatedAt`, `stats{publicRepositories,activeRepositories,commits7d,commits30d}`, `projects{name,url,description,status,commits7d,commits30d,lastCommit,primaryLanguage,activityScore}`, `stack{name,score,percentage}`)
- [x] Logs `[stack] N technologies detected`

## Phase 4 — SVG / Render

- [x] Créer `templates/profile.svg` + `scripts/generate-profile.js` (entrée `data/profile-data.json` → sortie `assets/profile.svg` §15)
- [x] Générer `assets/profile.svg` autonome, sans dépendance réseau
- [x] Sections HEADER, NAME, TAGLINE, CURRENTLY BUILDING (nom, description, commits, update, langage, statut, lien), ACTIVITY (7d, 30d, active, public), CURRENT STACK (barres), LAST UPDATED UTC
- [x] Échapper XML `& < > "` sur tout texte utilisateur
- [x] Gérer vide/long/absent : 0 commit, 0 actif, techno non détectée, description absente, nom long, repo privé/inaccessible, erreur API partielle, stats à zéro — jamais `undefined/NaN/null` (§26)
- [x] Ordre : layout → typo → données → responsive → animations
- [x] Logs `[render] profile.svg generated`

## Phase 5 — GitHub Actions / CI

- [x] Créer `.github/workflows/update-profile.yml` (`workflow_dispatch`, `schedule cron "0 4 * * *"`)
- [x] Steps : checkout@v4 → setup-node@v4 Node 22 → `npm ci` → `npm run generate` avec `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` → `git add assets/profile.svg data/profile-data.json` → commit si diff → push
- [x] `permissions: contents: write`, `user.name github-actions[bot]`, `user.email 41898282+github-actions[bot]@users.noreply.github.com`, commit `git diff --cached --quiet || git commit -m "chore: update GitHub profile"` (§22)
- [ ] Tester `workflow_dispatch` avant cron (bloqué : attend push repo + user)
- [x] README minimal `<p align="center"><img src="./assets/profile.svg" width="100%" /></p>` + liens Portfolio/LinkedIn/Email, sans duplication SVG

## Phase 6 — Polish

- [ ] Animations légères : curseur, fade lignes, barres, scanline, pulse ACTIVE — lisible immédiat, pas agressif
- [ ] Dark/light `@media (prefers-color-scheme: dark)` si rendu GitHub stable, sinon 1 thème propre
- [ ] Alignements, typo, responsive limite README
- [ ] Tests min : calcul activité, classement, mapping techno, normalisation %, escape SVG

## Phase 7 — Validation V1.5 (§29)

- [ ] README affiche `assets/profile.svg`
- [ ] SVG généré auto, aucune clé externe, aucun service externe
- [ ] Actions manuel OK, quotidien OK, commit seulement si modification
- [ ] Projets auto, activité 7d OK, 30d OK, archivés exclus, forks exclus défaut
- [ ] Stack auto + dépend activité récente
- [ ] SVG ne casse jamais sur texte utilisateur, pas de `null/undefined/NaN`
- [ ] Config sans toucher cœur code
