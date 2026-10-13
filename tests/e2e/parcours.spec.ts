import { expect, test, type Page } from "@playwright/test";
import { loadEnv } from "../../scripts/load-env";
import { fictitiousPdf } from "../../scripts/demo-pdf";

loadEnv();
const PASSWORD = process.env.DEMO_PASSWORD ?? "";
const PAUL = "paul.martin@demo.mathieu-pharma.test";
const SOPHIE = "sophie.durand@demo.mathieu-pharma.test";
const CLAIRE = "claire.adv@demo.mathieu-pharma.test";
const ADMIN = "admin@demo.mathieu-pharma.test";

async function login(page: Page, email: string) {
  await page.goto("/connexion");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"));
}

async function logout(page: Page) {
  await page.goto("/profil");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL("**/connexion");
}

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: fictitiousPdf(name, ["Test E2E"]) });

test("parcours complet commercial → ADV → complément → validation → Quadra", async ({ page }) => {
  // 1. Le commercial crée un brouillon incomplet et l'enregistre.
  await login(page, PAUL);
  await expect(page.getByRole("heading", { name: "Bonjour Paul" })).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir un compte" }).click();
  await page.waitForURL("**/dossiers/nouveau");
  await page.fill("#pharmacyName", "Pharmacie E2E des Tests");
  await page.fill("#city", "Marseille");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Enregistré à/)).toBeVisible();
  await page.waitForURL(/\/dossiers\/[0-9a-f-]{36}\/modifier/);
  const dossierId = page.url().match(/dossiers\/([0-9a-f-]{36})/)![1]!;

  // 2. Déconnexion puis reconnexion : le brouillon est retrouvé.
  await logout(page);
  await login(page, PAUL);
  await page.goto("/dossiers?statut=DRAFT");
  const card = page.locator(".mp-dcard", { hasText: "Pharmacie E2E des Tests" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Continuer" }).click();
  await expect(page.locator("#pharmacyName")).toHaveValue("Pharmacie E2E des Tests");

  // 3. Compléter les informations (format SIRET contrôlé).
  await page.fill("#cipCode", "7654321");
  await page.fill("#siret", "123");
  await page.locator("#siret").blur();
  await expect(page.getByText(/SIRET invalide/)).toBeVisible();
  await page.fill("#siret", "900 200 000 00017");
  await page.fill("#ownerName", "Camille Test");
  await page.fill("#address", "1 rue du Test");
  await page.fill("#postalCode", "13001");
  await page.fill("#phone", "04 91 11 22 33");
  await page.selectOption("#groupementType", "independante");
  await page.selectOption("#paymentMethod", "traite");
  await page.fill("#iban", "FR76 3000 6000 0112 3456 7890 189");
  await page.getByRole("button", { name: "Continuer" }).click();

  // 4. Justificatifs : sans KBIS ni RIB, la transmission est impossible.
  await expect(page.getByText("Le KBIS et le RIB manquent pour transmettre")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("button", { name: "Transmettre à l’ADV" })).toBeDisabled();
  await page.getByRole("button", { name: /KBIS de la pharmacie : à ajouter/ }).click();

  // Import de fichiers (KBIS de 2 pages, RIB).
  const kbisCard = page.locator("section", { has: page.getByRole("heading", { name: /KBIS de la pharmacie/ }) });
  await kbisCard.locator('input[type=file][multiple]').setInputFiles([pdf("kbis-p1.pdf"), pdf("kbis-p2.pdf")]);
  await expect(kbisCard.getByText("2 pages")).toBeVisible();
  const ribCard = page.locator("section", { has: page.getByRole("heading", { name: /RIB de la pharmacie/ }) });
  await ribCard.locator('input[type=file][multiple]').setInputFiles([pdf("rib.pdf")]);
  await expect(ribCard.getByText("Reçu")).toBeVisible();

  // 5. Vérification et transmission.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("FR76 •••• •••• 0189").first()).toBeVisible();
  const transmit = page.getByRole("button", { name: "Transmettre à l’ADV" });
  await expect(transmit).toBeDisabled();
  await page.getByLabel("Je confirme l’exactitude des informations du dossier.").check();
  await expect(transmit).toBeEnabled();
  await transmit.dblclick(); // double clic volontaire : une seule transmission attendue
  await page.waitForURL(`**/dossiers/${dossierId}?transmis=1`);
  await expect(page.getByText("Dossier transmis à l’ADV").first()).toBeVisible();
  await expect(page.locator(".mp-timeline__title", { hasText: "Dossier transmis à l’ADV" })).toHaveCount(1);

  // Après transmission, l'édition est fermée (redirection vers le détail).
  await page.goto(`/dossiers/${dossierId}/modifier`);
  await page.waitForURL(`**/dossiers/${dossierId}`);
  await logout(page);

  // 6. L'ADV demande un complément.
  await login(page, CLAIRE);
  await page.waitForURL("**/adv");
  await page.goto(`/dossiers/${dossierId}`);
  await page.getByRole("button", { name: "Demander un complément" }).click();
  await page.fill("#adv-msg", "RIB illisible, merci de le remplacer");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.locator(".mp-detail-head").getByText("À compléter")).toBeVisible();
  await logout(page);

  // 7. Le commercial corrige et retransmet.
  await login(page, PAUL);
  await page.goto(`/dossiers/${dossierId}`);
  await expect(page.getByText("RIB illisible, merci de le remplacer").first()).toBeVisible();
  await page.getByRole("link", { name: "Reprendre le dossier" }).first().click();
  await page.getByRole("button", { name: /Pièces/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Retirer rib.pdf" }).click();
  await expect(page.getByText("Le RIB manque pour transmettre")).toBeVisible();
  const ribCard2 = page.locator("section", { has: page.getByRole("heading", { name: /RIB de la pharmacie/ }) });
  await ribCard2.locator('input[type=file][multiple]').setInputFiles([pdf("rib-lisible.pdf")]);
  await expect(ribCard2.getByText("Reçu")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.fill("#reply", "RIB remplacé");
  await page.getByLabel("Je confirme l’exactitude des informations du dossier.").check();
  await page.getByRole("button", { name: "Retransmettre à l’ADV" }).click();
  await page.waitForURL(`**/dossiers/${dossierId}?transmis=1`);
  await logout(page);

  // 8. L'ADV valide (vérifications métier), puis confirme séparément la création Quadra.
  await login(page, CLAIRE);
  await page.goto(`/dossiers/${dossierId}`);
  await page.getByRole("button", { name: "Valider le dossier" }).click();
  const validate = page.getByRole("dialog").getByRole("button", { name: "Valider", exact: true });
  await expect(validate).toBeDisabled();
  for (const cb of await page.getByRole("dialog").getByRole("checkbox").all()) await cb.check();
  await validate.click();
  await expect(page.getByText("Validé par l’ADV — création Quadra en attente")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer la création dans Quadra" }).click();
  await page.fill("#quadra-ref", "E2E-0001");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer la création", exact: true }).click();
  await expect(page.getByText("Compte créé dans Quadra : E2E-0001")).toBeVisible();
  await logout(page);

  // 9. Le commercial voit le statut final.
  await login(page, PAUL);
  await page.goto("/dossiers?statut=CREATED_IN_QUADRA");
  await expect(page.locator(".mp-dcard", { hasText: "Pharmacie E2E des Tests" }).getByText("Créé dans Quadra")).toBeVisible();
});

test("les protections s'appliquent aux routes, aux données et aux documents", async ({ page, request }) => {
  // Sans session.
  expect((await request.get("/api/dossiers")).status()).toBe(401);
  const anon = await page.goto("/dossiers");
  expect(new URL(anon!.url()).pathname).toBe("/connexion");

  // Sophie (commerciale) ne voit pas les dossiers de Paul, ni leurs pièces.
  await login(page, PAUL);
  const paulList = await page.request.get("/api/dossiers");
  const paulItems = (await paulList.json()).items as { id: string; pharmacyName: string }[];
  const target = paulItems.find((d) => d.pharmacyName === "Pharmacie de la Mairie")!;
  const detail = await (await page.request.get(`/api/dossiers/${target.id}`)).json();
  const docId = detail.documents[0].id as string;
  const doc = await page.request.get(`/api/documents/${docId}`);
  expect(doc.status()).toBe(200);
  expect(doc.headers()["cache-control"]).toContain("no-store");
  await logout(page);

  await login(page, SOPHIE);
  expect((await page.request.get(`/api/dossiers/${target.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/documents/${docId}`)).status()).toBe(404);
  const forged = await page.request.post(`/api/dossiers/${target.id}/transitions/validate`, {
    headers: { Origin: "http://localhost:3100" },
    data: { checks: ["kbis_conforme", "rib_titulaire"] },
  });
  // Dossier d'un autre : « introuvable » (son existence n'est pas révélée).
  expect(forged.status()).toBe(404);
  const resp = await page.goto(`/dossiers/${target.id}`);
  expect(resp!.status()).toBe(404);
  await logout(page);

  // L'administrateur ne lit pas les dossiers ; l'ADV n'administre pas les utilisateurs.
  await login(page, ADMIN);
  expect((await page.request.get(`/api/dossiers/${target.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/documents/${docId}`)).status()).toBe(403);
  await logout(page);
  await login(page, CLAIRE);
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  await page.goto("/admin");
  expect(new URL(page.url()).pathname).toBe("/adv");
});

test("échec réseau : saisie conservée, état affiché, reprise et restauration", async ({ page, context }) => {
  await login(page, PAUL);
  await page.goto("/dossiers/nouveau");
  await page.fill("#pharmacyName", "Pharmacie Hors Ligne");
  await page.locator("#pharmacyName").blur();
  await expect(page.getByText(/Enregistré à/)).toBeVisible();
  await page.waitForURL(/\/modifier/);
  const editUrl = page.url();

  // Coupure réseau pendant la saisie.
  await context.setOffline(true);
  await page.fill("#city", "Aubagne");
  await page.locator("#city").blur();
  await expect(page.getByText(/Hors connexion — saisie conservée sur cet appareil/)).toBeVisible();

  // Retour du réseau : enregistrement automatique.
  await context.setOffline(false);
  await expect(page.getByText(/Enregistré à/)).toBeVisible({ timeout: 20_000 });

  // Échec serveur simulé puis rechargement : la copie locale est proposée.
  await page.route("**/api/dossiers/*", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await page.fill("#address", "3 cours Foch");
  await page.locator("#address").blur();
  await expect(page.getByText(/Hors connexion/)).toBeVisible();
  await page.unroute("**/api/dossiers/*");
  page.once("dialog", (d) => d.accept());
  await page.goto(editUrl);
  await expect(page.getByText("Saisie non enregistrée retrouvée")).toBeVisible();
  await page.getByRole("button", { name: "Restaurer" }).click();
  await expect(page.locator("#address")).toHaveValue("3 cours Foch");
  await expect(page.getByText(/Enregistré à/)).toBeVisible({ timeout: 10_000 });
});
