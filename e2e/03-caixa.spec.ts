import { expect, test } from "@playwright/test";
import { entrar, PACIENTE, pronta, reais, semAlerta } from "./ajuda";

/** Um dia de caixa: abre com troco, vende, recebe o saldo dos óculos, faz sangria e fecha conferido. */
test("caixa: abre, vende, recebe os óculos, sangria e fecha conferido", async ({ page }) => {
  await entrar(page, "caixa");
  await expect(page).toHaveURL(/\/pdv$/);
  await page.getByLabel("Dinheiro na gaveta (R$)").fill("100,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await semAlerta(page);
  await expect(page.getByRole("heading", { name: "Nova venda" })).toBeVisible();
  await pronta(page);

  // venda pelo código de barras, em dinheiro (a primeira forma já vem com o total)
  await page.getByLabel("Buscar produto").fill("7890001");
  await page.getByRole("button", { name: /Estojo rígido/ }).first().click();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Venda \d+ registrada/ })).toBeVisible();
  await pronta(page);

  // recebe no caixa o saldo dos óculos do fluxo (R$ 440), em dinheiro
  await page.getByLabel("Buscar cliente para receber").fill("Rosa");
  await page.getByRole("button", { name: "Buscar" }).click();
  await pronta(page);
  const pendencia = page.locator("form.receber-item", { hasText: PACIENTE });
  await expect(pendencia).toBeVisible();
  await expect(pendencia.getByLabel("Valor recebido")).toHaveValue(/440,00/);
  await pendencia.getByRole("button", { name: "Receber" }).click();
  await semAlerta(page);
  // recebido: sai da lista de pendências e entra no resumo do caixa
  await expect(page.locator("form.receber-item", { hasText: PACIENTE })).toHaveCount(0);
  await expect(page.locator(".linha-valor", { hasText: "Recebido (óculos/crediário) · Dinheiro" })).toContainText(reais(440));
  await pronta(page);

  // sangria de R$ 20
  const sangria = page.locator("section", { hasText: "Sangria ou suprimento" });
  await sangria.getByLabel("Valor").fill("20,00");
  await sangria.getByLabel("Motivo").fill("Depósito");
  await sangria.getByRole("button", { name: "Lançar" }).click();
  await semAlerta(page);
  await expect(page.locator(".linha-valor", { hasText: "Sangrias" })).toContainText(reais(20));
  await pronta(page);

  // gaveta: 100 + 50 (estojo) + 440 (óculos) − 20 (sangria) = 570
  await expect(page.locator(".linha-valor", { hasText: "Dinheiro na gaveta" })).toContainText(reais(570));
  await page.getByLabel("Dinheiro contado na gaveta (R$)").fill("570,00");
  await page.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(page).toHaveURL(/\/cupom\/fechamento\//);
  await expect(page.getByText("FECHAMENTO DE CAIXA")).toBeVisible();
  await expect(page.locator(".cupom-linha", { hasText: "Diferença" })).toContainText("conferido");
  await expect(page.locator(".cupom-linha", { hasText: "Esperado" })).toContainText(reais(570));
});

test("o funil mostra os óculos pagos depois do caixa", async ({ page }) => {
  await entrar(page, "vendedor");
  await page.goto("/clientes/chamar");
  await expect(page.getByRole("heading", { name: "Clientes para chamar" })).toBeVisible();
  await page.goto("/clientes");
  await page.getByRole("link", { name: new RegExp(PACIENTE) }).click();
  await pronta(page);
  // o atendimento da ficha do cliente (o card que veio do consultório)
  await page.locator("section", { hasText: "Atendimentos" }).locator("a.lista-item").first().click();
  await pronta(page);
  await expect(page.locator(".linha-valor.total", { hasText: "Falta pagar" })).toContainText(reais(0));
});
