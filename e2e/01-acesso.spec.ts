import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

// cada perfil cai na tela da sua área
for (const [chave, inicio] of [
  ["dono", "/inicio"],
  ["vendedor", "/inicio"],
  ["optometrista", "/consultorio"],
  ["laboratorio", "/producao"],
  ["caixa", "/pdv"],
] as const) {
  test(`${chave} entra e cai em ${inicio}`, async ({ page }) => {
    await entrar(page, chave);
    await page.goto("/inicio");
    await expect(page).toHaveURL(new RegExp(`${inicio}$`));
  });
}

test("quem é de uma área não abre a tela de outra", async ({ page }) => {
  await entrar(page, "vendedor");
  await page.goto("/financeiro");
  await expect(page).toHaveURL(/\/inicio$/);

  await entrar(page, "laboratorio");
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/producao$/);

  await entrar(page, "caixa");
  await page.goto("/vendas");
  await expect(page).toHaveURL(/\/pdv$/);
});

test("senha errada não entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("balcao@e2e.vitral");
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login\?erro=credenciais/);
});

test("sem login, as telas mandam para o login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login$/);
});
