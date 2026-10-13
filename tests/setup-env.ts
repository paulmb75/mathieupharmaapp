import { loadEnv } from "../scripts/load-env";

loadEnv();
// Les tests n'utilisent JAMAIS la base de développement.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL manquant (voir .env.example).");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.STORAGE_DIR = "./test-storage";
process.env.APP_ENV = "development";
process.env.DEMO_MODE = "false";
