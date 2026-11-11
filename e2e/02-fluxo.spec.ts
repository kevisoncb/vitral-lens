import { expect, test } from "@playwright/test";
import { entrar, PACIENTE, reais, semErroDeTela } from "./ajuda";

/**
 * O diferencial do Vitral de ponta a ponta: consultório -> loja -> laboratório -> loja -> cliente assina.
 * Cada passo usa o login da área, como na ótica.
 */
test.describe.serial("fluxo da ótica", () => {
  let atendimentoUrl = "";

  test("consultório: cadastra o paciente, faz o exame e conclui", async ({ page }) => {
    await entrar(page, "optometrista");
    await expect(page).toHaveURL(/\/consultorio$/);
    const novo = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar e abrir exame" }) });
    await novo.getByLabel("Nome").fill(PACIENTE);
    await novo.getByLabel("Telefone").fill("27999887766");
    await novo.getByLabel(/autorizou o uso dos dados de saúde/).check();
    await novo.getByRole("button", { name: "Cadastrar e abrir exame" }).click();
    await expect(page).toHaveURL(/\/consultorio\/exame\//);

    await page.getByLabel("Queixa principal").fill("Dificuldade para ler de perto");
    const od = page.getByRole("group", { name: "Olho direito (OD)" });
    await od.getByLabel("Esférico").fill("-1,25");
    await od.getByLabel("Cilíndrico").fill("-0,50");
    await od.getByLabel("Eixo").fill("180");
    await od.getByLabel("Adição").fill("2,00");
    const oe = page.getByRole("group", { name: "Olho esquerdo (OE)" });
    await oe.getByLabel("Esférico").fill("-1,00");
    await oe.getByLabel("Adição").fill("2,00");
    await page.getByRole("button", { name: "Concluir e gerar receita" }).click();
    await expect(page).toHaveURL(/concluido=1/);
    await semErroDeTela(page);
  });

  test("loja: o paciente aparece no Início, monta o orçamento e recebe o sinal", async ({ page }) => {
    await entrar(page, "vendedor");
    await expect(page).toHaveURL(/\/inicio$/);
    const saiu = page.locator("section", { hasText: "Saíram do consultório" });
    await saiu.getByRole("link", { name: new RegExp(PACIENTE) }).click();
    await expect(page).toHaveURL(/\/vendas\/[0-9a-f-]+$/);
    atendimentoUrl = new URL(page.url()).pathname;

    // o card do consultório chega sem itens: acrescenta a lente do catálogo
    const valorLente = await page.locator("select[name=catalogo_id] option", { hasText: "Lente multifocal 1.67" }).getAttribute("value");
    await page.locator("select[name=catalogo_id]").selectOption(valorLente!);
    await page.getByRole("button", { name: "Acrescentar ao orçamento" }).click();
    await expect(page.locator(".linha-valor.total").first()).toContainText(reais(640));

    // sinal de R$ 200 no Pix, com a entrega prometida: a OS nasce
    const entrega = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Valor (R$)").fill("200,00");
    await page.getByLabel("Entrega prometida").fill(entrega);
    await page.getByLabel("É sinal").check();
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Falta pagar")).toBeVisible();
    await expect(page.locator(".linha-valor.total", { hasText: "Falta pagar" })).toContainText(reais(440));
    await expect(page.locator(".subtitulo").first()).toContainText(/OS \d+/);
    // depois de pago, o orçamento fecha
    await expect(page.getByText("Orçamento fechado: já tem pagamento.")).toBeVisible();
  });

  test("laboratório: a OS chega em Pago e anda até Chegou na loja", async ({ page }) => {
    await entrar(page, "laboratorio");
    await expect(page).toHaveURL(/\/producao$/);
    await page.getByRole("link", { name: new RegExp(PACIENTE) }).first().click();
    await expect(page).toHaveURL(/\/producao\/os\//);
    // o laboratório não vê valores
    await expect(page.getByText(/R\$\s?\d/)).toHaveCount(0);
    for (const etapa of ["No laboratório", "Em montagem", "Chegou na loja"]) {
      await page.locator("section", { hasText: "Mover para" }).getByRole("button", { name: etapa, exact: true }).click();
      await expect(page.locator(".subtitulo").first()).toContainText(etapa);
    }
  });

  test("loja: pede a assinatura, o cliente assina pelo celular e a loja vê", async ({ page, browser }) => {
    await entrar(page, "vendedor");
    await page.goto("/laboratorio");
    await page.getByRole("link", { name: new RegExp(PACIENTE) }).first().click();
    await expect(page).toHaveURL(/\/laboratorio\/[0-9a-f-]+$/);
    await expect(page.locator(".subtitulo").first()).toContainText("Chegou na loja");
    await page.getByRole("button", { name: "Pedir assinatura do cliente" }).click();
    const link = await page.getByLabel("Link para assinar").inputValue();
    expect(link).toMatch(/\/assinar\/[0-9a-f-]{36}$/);

    // o cliente abre no celular, sem login
    const celular = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const cliente = await celular.newPage();
    await cliente.goto(new URL(link).pathname);
    await expect(cliente.getByRole("heading", { name: /Ordem de serviço/ })).toBeVisible();
    await expect(cliente.getByText("Lente multifocal 1.67")).toBeVisible();
    await expect(cliente.getByText(reais(440))).toBeVisible(); // falta pagar
    const quadro = cliente.getByLabel("Quadro para assinar");
    await quadro.scrollIntoViewIfNeeded();
    const caixa = (await quadro.boundingBox())!;
    await cliente.mouse.move(caixa.x + 20, caixa.y + caixa.height / 2);
    await cliente.mouse.down();
    for (let i = 1; i <= 30; i++) await cliente.mouse.move(caixa.x + 20 + i * 9, caixa.y + caixa.height / 2 + Math.sin(i / 3) * 40);
    await cliente.mouse.up();
    await cliente.getByLabel(/Conferi a receita/).check();
    await cliente.getByRole("button", { name: "Assinar" }).click();
    await expect(cliente.getByText(/Assinado por/)).toBeVisible();
    await celular.close();

    await page.reload();
    await expect(page.getByText(/Conferida e assinada por/)).toBeVisible();
    await expect(page.getByRole("img", { name: /Assinatura de/ })).toBeVisible();

    // a loja avisa o cliente
    await page.locator("section", { hasText: "Mover para" }).getByRole("button", { name: "Cliente avisado", exact: true }).click();
    await expect(page.locator(".subtitulo").first()).toContainText("Cliente avisado");
    await semErroDeTela(page);
    expect(atendimentoUrl).not.toBe("");
  });
});
