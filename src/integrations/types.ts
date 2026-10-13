/** Résultat d'un appel d'intégration : jamais de donnée simulée présentée comme réelle. */
export type IntegrationResult<T> =
  | { status: "not_configured"; source: string }
  | { status: "not_found"; source: string }
  | { status: "error"; source: string; message: string }
  | { status: "ok"; source: string; fetchedAt: Date; data: T };
