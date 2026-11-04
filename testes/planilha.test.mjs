// Testes da leitura de planilhas (CSV e Excel). Rodam com `npm test` e no CI.
// As planilhas de testes/planilhas/ foram salvas no formato do Excel (.xlsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoriaChave, dataIso, lerClientes, lerCsv, lerProdutos, lerXlsx, precoNumero } from "../src/lib/planilha.ts";

function arquivo(nome) {
  const b = readFileSync(new URL(`planilhas/${nome}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

test("CSV do Excel brasileiro: ponto e vírgula, aspas e datas", () => {
  const m = lerCsv('﻿Nome;Celular;Data de Nascimento\n"Silva; Ana";27 9999-0000;5/3/80\r\n\r\nBruno;;1990-01-02\n');
  assert.deepEqual(m, [["Nome", "Celular", "Data de Nascimento"], ["Silva; Ana", "27 9999-0000", "5/3/80"], ["Bruno", "", "1990-01-02"]]);
  const c = lerClientes(m).linhas;
  assert.equal(c[0].nascimento, "1980-03-05");
  assert.equal(c[1].telefone, null);
});

test("Excel: primeira aba, textos com acento e símbolos, datas e linha vazia", async () => {
  const m = await lerXlsx(arquivo("clientes.xlsx"));
  assert.equal(m.length, 4); // títulos + 3 clientes; a linha vazia some e a segunda aba não entra
  const c = lerClientes(m);
  assert.deepEqual(c.avisos, []);
  assert.equal(c.linhas[0].nome, "João da Silva & Filhos");
  assert.equal(c.linhas[0].nascimento, "1981-01-01");
  assert.equal(c.linhas[0].endereco, "Rua São José, 10");
  assert.equal(c.linhas[1].nome, "Maria <Souza>");
  assert.equal(c.linhas[1].nascimento, "1990-12-31");
  assert.equal(c.linhas[2].nascimento, "1980-03-05");
});

test("Excel: produtos com preço em número e código numérico", async () => {
  const p = lerProdutos(await lerXlsx(arquivo("produtos.xlsx")), null);
  assert.deepEqual(p.linhas, [
    { categoria: "armacao", nome: "Aro acetato preto", preco: 450.5, marca: "Vitral", codigo: "AR-01" },
    { categoria: "lente_contato", nome: "Mensal", preco: 160, marca: null, codigo: "789003" },
  ]);
});

test("arquivo que não é Excel dá erro claro", async () => {
  await assert.rejects(lerXlsx(new TextEncoder().encode("nome;telefone").buffer), /não é uma planilha do Excel/);
});

test("CPF que o Excel guardou como número volta com os zeros", () => {
  const c = lerClientes([["Nome", "CPF"], ["Ana", "1234567890"]]).linhas[0];
  assert.equal(c.cpf, "01234567890");
});

test("conversões de data, preço e categoria", () => {
  assert.equal(dataIso("31/12/1980"), "1980-12-31");
  assert.equal(dataIso("29587"), "1981-01-01");
  assert.equal(precoNumero("R$ 1.234,56"), 1234.56);
  assert.equal(precoNumero("99.9"), 99.9);
  assert.equal(categoriaChave("Armações"), "armacao");
  assert.equal(categoriaChave("Lentes de contato"), "lente_contato");
});
