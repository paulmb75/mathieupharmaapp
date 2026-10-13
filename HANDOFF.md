# HANDOFF — Mathieu Pharma (MVP ouvertures de compte)

## Architecture

Next.js 16 (App Router) monolithique : pages React Server Components + routes API JSON, PostgreSQL via Drizzle.
Trois couches séparées :

```
src/domain/        Règles métier PURES (client + serveur) : statuts, transitions, champs, formats, rôles
src/server/        Serveur uniquement ("server-only") : db, auth, services (contrôle d'accès), stockage, HTTP
src/integrations/  Interfaces Pappers / Quadra / fichier pharma — adaptateurs « non configuré » uniquement
src/app/           Routes Next (pages + /api) — minces : session → service → réponse
src/ui/            Composants réutilisables ; src/styles/tokens.css = variables de design
```

**Règle d'or : toute autorisation passe par `src/server/services/*`** (qui reçoivent l'acteur `SessionUser`).
Les pages et les routes appellent les services ; l'interface ne fait que masquer des boutons.

## Fichiers importants

| Fichier | Rôle |
|---|---|
| `src/domain/status.ts` | Statuts, libellés, **table `TRANSITIONS`** (source unique), événements |
| `src/domain/dossier.ts` | Champs, obligations provisoires, `checkSubmission`, schéma Zod des brouillons, identifiant Quadra proposé |
| `src/domain/formats.ts` | Contrôles de **format** (SIRET Luhn, IBAN mod 97, téléphone, CP, CIP) |
| `src/domain/adv.ts` | Vérifications **métier** confirmées par l'ADV avant validation |
| `src/server/services/access.ts` | Politique d'accès aux dossiers |
| `src/server/services/dossiers.ts` | Brouillons (idempotence, verrou optimiste), transitions (verrou `FOR UPDATE`), listes, commentaires |
| `src/server/services/documents.ts` | Justificatifs : type réel par octets magiques, taille, retrait logique, lecture contrôlée |
| `src/server/auth/*` | Sessions (jeton haché SHA-256), scrypt, verrouillage, `requirePageUser` / `requireApiUser` |
| `src/server/http.ts` | Enveloppe des routes : contrôle d'origine (CSRF), erreurs, `no-store` |
| `src/server/db/schema.ts` + `drizzle/` | Schéma et migrations SQL (ne jamais modifier une migration appliquée) |
| `src/ui/wizard/DossierWizard.tsx` | Formulaire 3 étapes : autosave en file, hors ligne, copie locale, envoi des pièces |
| `src/ui/detail/AdvActions.tsx` | Actions ADV (envoie `expectedStatus`) |
| `src/styles/tokens.css`, `components.css` | Variables et composants visuels |
| `tests/` | Unitaires, intégration (vraie base), e2e Playwright |

## Règles métier et de sécurité à préserver

- Transitions **uniquement** via `applyTransition` : rôle, propriétaire, statut d'origine, `expectedStatus`,
  pièces et champs obligatoires sont vérifiés sous verrou de ligne. Double clic = `alreadyApplied`, pas de doublon.
- Validation ADV ≠ création Quadra. `CREATED_IN_QUADRA` exige une confirmation distincte + référence de compte.
- Commercial : ses dossiers seulement ; modifie seulement `DRAFT` / `NEEDS_INFO`. ADV : tout sauf les brouillons,
  ne modifie pas le contenu. Admin : utilisateurs seulement, aucun accès aux dossiers. Accès refusé = 404.
- Identifiants, codes postaux, SIRET, IBAN, références : **chaînes de caractères**.
- Format valide ≠ vérification métier (libellés « Format valide — à vérifier » ; cases à cocher ADV).
- IBAN : jamais journalisé (`logError` + `scrub`, pas de logger SQL), masqué dans les listes, absent de la copie locale.
- Justificatifs : hors `public/`, servis par `/api/documents/:id` après contrôle d'accès, `no-store`, `nosniff`.
- Secrets uniquement dans `.env` (non versionné). Aucun document réel ni secret dans Git.
- Démo : `DEMO_MODE` et `db:seed` refusés si `APP_ENV=production` ; aucune porte dérobée d'authentification.
- Quadra : jamais de « max + 1 » ; l'attribution future doit être atomique côté système faisant autorité.
- Aucune donnée simulée présentée comme vérifiée ; aucun envoi de document à une IA externe sans décision explicite.

## Décisions provisoires (à confirmer)

- Champs obligatoires à la transmission : CIP, SIRET, titulaire, nom, adresse, CP, ville, téléphone, groupement
  (+ nom si groupement), mode de règlement, ≥ 1 KBIS, ≥ 1 RIB. E-mail, IBAN, réf. Quadra : facultatifs.
  **Le formulaire officiel et le fichier pharma n'ont pas été fournis.**
- Code CIP = 7 chiffres (d'après le mockup). Modes de règlement : traite (LCR), virement, chèque.
- ADV peut demander un complément ou refuser aussi depuis « Validé ». Les brouillons sont invisibles pour l'ADV.
- KPI de l'accueil : « demandes transmises » et « comptes créés » cette semaine (remplacent Visites/Commandes du
  mockup, sans source de données). Bouton « Continuer » de l'étape 2 actif même sans pièces (blocage à l'étape 3).
- Logo : reconstitution SVG provisoire (`src/ui/Logo.tsx`).

## Problèmes connus

- Pas de CSP complète (seulement `frame-ancestors`) ; à ajouter avec nonces avant production.
- Verrouillage de connexion par compte uniquement (pas de limitation par IP) : un tiers peut bloquer un compte 15 min.
- Stockage disque local, sans chiffrement au repos ni antivirus ; pièces retirées conservées sans durée de rétention.
- HEIC : non prévisualisable sur ordinateur (téléchargement). Testé sous Chromium uniquement : **pas encore testé sur un
  iPhone réel (Safari, appareil photo)**.
- Listes limitées à 100 résultats (pas de pagination). Pastilles de la navigation rafraîchies au rechargement seulement.
- `npm audit` : vulnérabilités dans des outils de développement (drizzle-kit/esbuild, braces), pas dans l'exécution.
- `npm install` exige `legacy-peer-deps` (fichier `.npmrc`) à cause d'un bug npm sur les dépendances pair de Vitest.

## Prochaines tâches (par priorité)

1. **Obtenir le formulaire officiel et le fichier pharma** ; ajuster `src/domain/dossier.ts` (champs, obligations,
   formats) et générer une migration si de nouvelles colonnes sont nécessaires.
2. Tester sur téléphones réels (iOS Safari, Android Chrome) : photo, import multiple, HEIC, mode hors ligne.
3. Préparer la production : hébergement, PostgreSQL managé + sauvegardes, stockage objet privé chiffré
   (implémenter `DocumentStorage`), HTTPS, CSP, limitation par IP, journal d'audit des téléchargements.
4. Notifications (e-mail ou push) : complément demandé, validation, création Quadra.
5. Rôle « Direction » en lecture seule si besoin ; pagination des listes ; export CSV ADV.
6. Intégrations, après accord et accès : fichier pharma (préremplissage), Pappers (contrôle SIRET), Quadra
   (recherche de prospect, attribution atomique) — via `src/integrations/*`.
7. Modules suivants (rapports, retours produits, parc auto, formations) en réutilisant `src/ui` et les services.

## Lancement et tests

```bash
npm install && cp .env.example .env   # renseigner DATABASE_URL, TEST_DATABASE_URL, DEMO_PASSWORD
npm run db:migrate && npm run db:seed
npm run dev                            # http://localhost:3000

npm run lint && npm run typecheck
npm test                               # 45 tests unitaires + intégration (base de test)
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e   # 3 tests navigateur (port 3100)
npm run build
```

La documentation Next.js de la version exacte est dans `node_modules/next/dist/docs/` (voir `AGENTS.md`).
