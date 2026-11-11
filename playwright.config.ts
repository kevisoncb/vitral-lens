import { defineConfig, devices } from "@playwright/test";

/**
 * Teste das telas de ponta a ponta: Vitral rodando (next start) ligado a um Supabase local (npx supabase start)
 * preparado por e2e/preparar.mjs. No CI roda no job "e2e". Os arquivos rodam em ordem e um de cada vez:
 * o fluxo do 02 deixa a OS que o 03 recebe no caixa.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "computador", use: { ...devices["Desktop Chrome"] } }],
});
