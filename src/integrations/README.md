# Intégrations externes

Aucune intégration n'est active dans ce MVP. Chaque système externe dispose d'une
interface séparée et d'un adaptateur « non configuré » qui **ne renvoie jamais de
donnée inventée**. L'interface utilisateur n'affiche aucun résultat issu de ces
adaptateurs.

| Système | Fichier | Usage prévu | État |
|---|---|---|---|
| Fichier pharma consolidé | `pharma-file.ts` | Préremplissage par CIP / SIRET | Non fourni : colonnes inconnues, rien n'est supposé |
| Pappers | `pappers.ts` | Contrôle SIRET / raison sociale / dirigeant | Aucun accès fourni, aucun endpoint codé |
| Quadra | `quadra.ts` | Recherche de prospect, attribution de numéro, création | Aucune écriture ; création manuelle confirmée par l'ADV |

Règles à respecter lors de l'implémentation réelle :

- Les secrets (clés API) restent exclusivement côté serveur (variables d'environnement).
- Un résultat externe est une **aide au préremplissage**, affichée avec sa source et sa date ;
  il ne remplace pas la vérification de l'ADV.
- Quadra : vérifier d'abord l'existence d'un prospect et conserver son numéro ; sinon,
  l'attribution du numéro doit être **atomique et effectuée par le système qui fait autorité**
  (jamais un « maximum + 1 » calculé dans le navigateur ou par cette application).
- Aucun document client n'est envoyé à un service d'IA externe sans décision explicite.
