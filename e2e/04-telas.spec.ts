import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { entrar, semErroDeTela } from "./ajuda";

/**
 * Todas as telas abrem sem erro, no computador e no celular; no celular nada estoura para o lado;
 * e nenhuma tem problema de acessibilidade grave (axe "critical"). Os "serious" ficam anotados no relatório.
 */
const TELAS: Record<string, string[]> = {
  dono: [
    "/inicio", "/vendas", "/vendas/novo", "/clientes", "/clientes/novo", "/clientes/chamar", "/agenda", "/laboratorio",
    "/catalogo", "/catalogo/etiquetas", "/estoque", "/estoque/nota", "/comissoes", "/relatorios", "/configuracoes",
    "/configuracoes/usuarios", "/configuracoes/perfis", "/configuracoes/agenda", "/configuracoes/funil", "/configuracoes/importar",
    "/financeiro", "/financeiro/pagar", "/financeiro/receber", "/financeiro/categorias", "/pdv", "/pdv/vendas", "/pdv/caixas",
    "/producao", "/consultorio", "/conta",
  ],
  publico: ["/", "/login", "/reforma-tributaria", "/site/teste", "/site/teste/agendar"],
};

async function conferir(page: Page, caminho: string, celular: boolean) {
  const resposta = await page.goto(caminho);
  expect(resposta?.status(), `${caminho} respondeu`).toBeLessThan(400);
  await semErroDeTela(page);
  if (celular) {
    const estouro = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(estouro, `${caminho} estoura ${estouro}px para o lado no celular`).toBeLessThanOrEqual(1);
  }
  // o axe traz a própria cópia dos tipos do Playwright; a página é a mesma
  const axe = await new AxeBuilder({ page: page as never }).analyze();
  const criticos = axe.violations.filter((v) => v.impact === "critical");
  const serios = axe.violations.filter((v) => v.impact === "serious");
  if (serios.length) test.info().annotations.push({ type: "acessibilidade (sério)", description: `${caminho}: ${serios.map((v) => v.id).join(", ")}` });
  expect(criticos.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `${caminho} tem problema grave de acessibilidade`).toEqual([]);
}

for (const celular of [false, true]) {
  test.describe(celular ? "celular" : "computador", () => {
    if (celular) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("telas públicas", async ({ page }) => {
      await page.context().clearCookies();
      for (const caminho of TELAS.publico) await conferir(page, caminho, celular);
    });

    test("telas da ótica (dono)", async ({ page }) => {
      test.setTimeout(240_000);
      await entrar(page, "dono");
      for (const caminho of TELAS.dono) await conferir(page, caminho, celular);
    });
  });
}
