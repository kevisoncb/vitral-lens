import { test } from "@playwright/test";
import { entrar, pronta } from "./ajuda";

/**
 * Fotos das telas principais, já com os dados que os testes anteriores criaram. Saem no relatório do CI
 * (artefato "relatorio-telas", pasta test-results/fotos) para mostrar o sistema sem precisar abrir.
 */
test.describe("fotos", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 1366, height: 820 } });

  test("telas da ótica", async ({ page }) => {
    await entrar(page, "dono");
    for (const [arquivo, caminho] of [["1-funil-de-vendas", "/vendas"], ["2-laboratorio", "/laboratorio"], ["3-pdv-caixa", "/pdv"], ["4-financeiro", "/financeiro"]]) {
      await page.goto(caminho);
      await pronta(page);
      await page.screenshot({ path: `test-results/fotos/${arquivo}.png`, fullPage: true });
    }
  });

  test("site da ótica no celular", async ({ browser }) => {
    const celular = await browser.newContext({ baseURL: process.env.E2E_URL ?? "http://localhost:3000", locale: "pt-BR", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await celular.newPage();
    await page.goto("/site/teste/agendar");
    await pronta(page);
    await page.screenshot({ path: "test-results/fotos/5-agendamento-no-celular.png", fullPage: true });
    await celular.close();
  });
});
