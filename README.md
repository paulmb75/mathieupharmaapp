# Mathieu Pharma — application interne

Application web responsive (téléphone d’abord, ordinateur pour l’ADV) qui regroupera à terme les outils des équipes
Mathieu Pharma. **Premier périmètre** : authentification et droits, accueil commercial, création et suivi des demandes
d’ouverture de compte, traitement des dossiers par l’ADV. Les autres modules (rapport du jour, véhicule, retours produits,
formations, fichier DN) apparaissent sur l’accueil avec la mention « À venir ».

> Le mode démonstration n’utilise que des **données fictives**. Ne déposez aucun document client réel dans un
> environnement de démonstration ou de développement.

## Stack

| Élément | Choix | Coût |
|---|---|---|
| Interface et serveur | Next.js 16.4 (App Router, React 19.3), TypeScript 5.9 | Gratuit (open source) |
| Base de données | PostgreSQL 16 (avec migrations SQL versionnées Drizzle Kit) | Gratuit en local ; hébergement managé payant à prévoir |
| Accès aux données | Drizzle ORM 0.45 + `pg` | Gratuit |
| Validation | Zod 4 (schémas partagés client/serveur) | Gratuit |
| Authentification | Sessions serveur en base, cookie `httpOnly`, mots de passe hachés avec scrypt (module natif de Node) | Gratuit |
| Justificatifs | Stockage privé sur disque, derrière une interface interchangeable (`DocumentStorage`) | Gratuit en local ; stockage objet privé à prévoir en production |
| Icônes, police | lucide-react, Inter (auto-hébergée via `@fontsource-variable/inter`) | Gratuit |
| Tests | Vitest 4 (unitaires et intégration sur une vraie base), Playwright 1.56 (bout en bout) | Gratuit |

Aucun service payant, aucun appel externe, aucune IA externe. Les versions ont été vérifiées dans la documentation
officielle (guide de migration Next.js 16 et guide d’authentification du dépôt `vercel/next.js`, README de Drizzle Kit) ;
la documentation de Next.js correspondant exactement à la version installée est aussi disponible dans
`node_modules/next/dist/docs/`.

## Démarrage local

Prérequis : Node.js ≥ 20.9 (testé avec 22), PostgreSQL ≥ 14 accessible localement.

```bash
# 1. Dépendances (le fichier .npmrc active legacy-peer-deps, nécessaire avec npm 10)
npm install

# 2. Configuration : copier puis renseigner DATABASE_URL, TEST_DATABASE_URL et DEMO_PASSWORD
cp .env.example .env

# 3. Bases PostgreSQL (exemple, à adapter)
createdb mathieupharma
createdb mathieupharma_test

# 4. Schéma puis données de démonstration fictives
npm run db:migrate
npm run db:seed

# 5. Lancement
npm run dev            # http://localhost:3000
```

Pour tester sur un téléphone du même réseau : `npx next dev -H 0.0.0.0` puis ouvrir `http://<ip-du-poste>:3000`
(l’appareil photo fonctionne via l’import de fichier natif, sans permission particulière).

### Comptes de démonstration (fictifs)

| Rôle | E-mail |
|---|---|
| Commercial | `paul.martin@demo.mathieu-pharma.test` |
| Commercial | `sophie.durand@demo.mathieu-pharma.test` |
| ADV | `claire.adv@demo.mathieu-pharma.test` |
| Administrateur | `admin@demo.mathieu-pharma.test` |

Mot de passe : la valeur de `DEMO_PASSWORD` de votre `.env`. Le script de démonstration **refuse** de s’exécuter si
`APP_ENV=production` ou si la base contient des comptes non fictifs.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | ESLint (config Next.js) |
| `npm run typecheck` | Génération des types de routes + `tsc` |
| `npm test` | Tests unitaires et d’intégration (base `TEST_DATABASE_URL`, vidée à chaque exécution) |
| `PW_CHROMIUM_PATH=/chemin/chromium npm run test:e2e` | Tests de bout en bout (démarrent leur propre serveur sur le port 3100, base de test) |
| `npm run db:generate` | Générer une migration après modification de `src/server/db/schema.ts` |
| `npm run db:migrate` | Appliquer les migrations |
| `npm run db:seed` | Recharger les données fictives (efface la base de démo) |
| `npm run db:reset` | Réinitialiser la base locale (refusé en production) |
| `npm run user:create -- --email x@y.fr --name "Prénom Nom" --role admin` | Créer un utilisateur (premier administrateur) avec mot de passe temporaire |

`PW_CHROMIUM_PATH` est facultatif si Playwright a installé son propre navigateur (`npx playwright install chromium`).

## Fonctionnalités

### Opérationnelles

- Connexion par e-mail et mot de passe, sessions serveur révocables, verrouillage temporaire après 5 échecs,
  changement de mot de passe, déconnexion.
- Rôles commercial / ADV / administrateur contrôlés côté serveur (routes API, pages, documents).
- Accueil commercial : statistiques de la semaine, « Ouvrir un compte », dossiers à compléter, demandes en validation,
  dossiers récents, modules futurs « À venir ».
- Formulaire en 3 étapes (informations, justificatifs, vérification) avec enregistrement automatique, indicateur
  d’état, verrou optimiste, reprise après coupure réseau et copie locale de secours (sans IBAN).
- Justificatifs KBIS et RIB de plusieurs pages, par photo ou import (PDF, JPEG, PNG, WEBP, HEIC ; 10 Mo par fichier ;
  type vérifié sur le contenu ; réduction des photos lourdes avant envoi).
- Transmission à l’ADV avec contrôle serveur des champs obligatoires et des pièces ; protection contre les doubles
  soumissions.
- Liste des demandes : recherche (pharmacie, ville, SIRET, référence, commercial), filtres par statut, date de mise à
  jour, commercial ; cartes sur téléphone, tableau sur ordinateur.
- Détail : informations, pièces, statut, historique, commentaires et demandes de complément.
- Espace ADV : file « À vérifier » (plus anciennes d’abord), « À créer dans Quadra », « En attente du commercial » ;
  demande de complément, validation avec vérifications métier, refus motivé, confirmation séparée de la création Quadra
  avec référence de compte.
- Administration : création d’utilisateurs, rôles, désactivation, réinitialisation de mot de passe, protection du
  dernier administrateur.

### Simulées ou provisoires (clairement identifiées)

- **Logo** : reconstitution SVG d’après les mockups, à remplacer par le fichier officiel.
- **Champs obligatoires, format du code CIP (7 chiffres), modes de règlement** : provisoires, faute de formulaire officiel.
- **Identifiant Quadra proposé** (titulaire + code postal) : simple suggestion affichée à l’ADV, règle à confirmer.
- **Données de démonstration** : entièrement fictives (IBAN d’exemple de la documentation bancaire).

### Bloquées (accès ou décision manquants)

- Préremplissage par le **fichier pharma consolidé** : fichier non fourni, colonnes non inspectées.
- Contrôle **Pappers** : aucun accès fourni, aucun endpoint codé.
- **Écriture dans Quadra** (recherche de prospect, attribution atomique du numéro, création) : interdite pour le MVP.
- Notifications (e-mail/push), mot de passe oublié en libre-service : non incluses.
- Déploiement : aucun ; à décider (hébergement, stockage objet, sauvegardes).

Voir `HANDOFF.md` pour l’architecture, les règles à préserver et les prochaines tâches.
