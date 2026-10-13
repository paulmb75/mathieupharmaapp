import { describe, expect, it } from "vitest";
import {
  formatIban,
  isValidCip,
  isValidEmail,
  isValidIban,
  isValidPhone,
  isValidPostalCode,
  isValidSiret,
  maskIban,
  normalizePhone,
} from "@/domain/formats";
import { checkSubmission, emptyDossierData, formatIssues, proposeQuadraIdentifier } from "@/domain/dossier";
import { scrub } from "@/server/errors";

describe("formats (contrôles de format uniquement)", () => {
  it("SIRET : 14 chiffres et clé de Luhn", () => {
    expect(isValidSiret("90010009000092")).toBe(true);
    expect(isValidSiret("900 100 090 00092")).toBe(true);
    expect(isValidSiret("90010009000093")).toBe(false);
    expect(isValidSiret("9001000900009")).toBe(false);
    expect(isValidSiret("9001000900009A")).toBe(false);
  });

  it("SIRET : exception La Poste (somme des chiffres multiple de 5)", () => {
    expect(isValidSiret("35600000000051")).toBe(true);
  });

  it("IBAN : clé ISO 13616 et longueur par pays", () => {
    expect(isValidIban("FR7630006000011234567890189")).toBe(true);
    expect(isValidIban("fr76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("FR7630006000011234567890188")).toBe(false);
    expect(isValidIban("FR763000600001123456789018")).toBe(false);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("IBAN masqué et formaté", () => {
    expect(maskIban("FR7630006000011234567890189")).toBe("FR76 •••• •••• 0189");
    expect(formatIban("FR7630006000011234567890189")).toBe("FR76 3000 6000 0112 3456 7890 189");
  });

  it("codes postaux, téléphones, e-mails, CIP restent des chaînes et sont contrôlés", () => {
    expect(isValidPostalCode("01000")).toBe(true);
    expect(isValidPostalCode("1000")).toBe(false);
    expect(isValidPhone("04 91 00 00 00")).toBe(true);
    expect(isValidPhone("+33 6 12 34 56 78")).toBe(true);
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("0612345678");
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidEmail("a@b.fr")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidCip("0123456")).toBe(true);
    expect(isValidCip("123456")).toBe(false);
  });

  it("formatIssues ne signale que les champs renseignés", () => {
    expect(formatIssues(emptyDossierData())).toEqual([]);
    const issues = formatIssues({ ...emptyDossierData(), siret: "123", iban: "FR00" });
    expect(issues.map((i) => i.field).sort()).toEqual(["iban", "siret"]);
  });

  it("checkSubmission exige champs obligatoires et justificatifs", () => {
    const c = checkSubmission(emptyDossierData(), { KBIS: 0, RIB: 0 });
    expect(c.ok).toBe(false);
    expect(c.missing).toContain("siret");
    expect(c.missingDocuments).toEqual(["KBIS", "RIB"]);
    const groupement = checkSubmission({ ...emptyDossierData(), groupementType: "groupement" }, { KBIS: 1, RIB: 1 });
    expect(groupement.missing).toContain("groupementName");
  });

  it("identifiant Quadra proposé (règle provisoire)", () => {
    expect(proposeQuadraIdentifier("Jean-Noël Dupont", "13008")).toBe("JEANNOELDUPONT13008");
    expect(proposeQuadraIdentifier("", "13008")).toBeNull();
    expect(proposeQuadraIdentifier("Dupont", "")).toBeNull();
  });

  it("les journaux masquent les IBAN", () => {
    expect(scrub("échec pour FR7630006000011234567890189 !")).not.toContain("30006000011234567890189");
  });
});
