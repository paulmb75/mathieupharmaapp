/**
 * Stockage privé des justificatifs. Les fichiers ne sont JAMAIS servis directement :
 * ils passent par une route qui vérifie les droits d'accès au dossier.
 * Implémentation actuelle : disque local. À remplacer par un stockage objet privé
 * (bucket non public, chiffrement au repos) avant une mise en production.
 */
export interface DocumentStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
