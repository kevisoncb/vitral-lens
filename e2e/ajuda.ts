import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

type Pessoa = { chave: string; nome: string; email: string; id: string };
type Dados = { senha: string; otica: string; pessoas: Pessoa[] };
let lidos: Dados | null = null;
/** Logins da ótica de teste, gravados por e2e/preparar.mjs (lidos só quando um teste precisa). */
function dados(): Dados {
  lidos ??= JSON.parse(readFileSync(join(__dirname, ".dados.json"), "utf8")) as Dados;
  return lidos;
}

export const PACIENTE = "Rosa Teste Ponta";

export function pessoa(chave: string): Pessoa {
  const p = dados().pessoas.find((x) => x.chave === chave);
  if (!p) throw new Error(`sem login de teste para ${chave}`);
  return p;
}

/** Entra com o login de teste do perfil e espera sair da tela de login. */
export async function entrar(page: Page, chave: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(pessoa(chave).email);
  await page.getByLabel("Senha").fill(dados().senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Valor em reais como a tela mostra: 640 -> "R$ 640,00" (com espaço comum ou fino). */
export function reais(valor: number): RegExp {
  const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return new RegExp(`R\\$\\s?${texto.replace(".", "\\.")}`);
}

/** Erros que não podem aparecer em nenhuma tela. */
export async function semErroDeTela(page: Page) {
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
}

/** Se a tela mostrou um erro (role="alert"), o teste falha com o texto dele. */
export async function semAlerta(page: Page) {
  await page.waitForLoadState("networkidle");
  const alertas = page.locator('[role="alert"]');
  const n = await alertas.count();
  if (n > 0) throw new Error(`a tela mostrou erro: ${(await alertas.allInnerTexts()).join(" | ")}`);
}
