// Testes da leitura do XML da NF-e do fornecedor (entrada de mercadoria).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoriaPorNcm, lerNfe, pagamentoPorTPag } from "../src/lib/nfe.ts";

const xml = readFileSync(new URL("notas/nfe-armacoes.xml", import.meta.url), "utf8");

test("cabeçalho: chave, número, emissão, fornecedor e total", () => {
  const n = lerNfe(xml);
  assert.equal(n.chave, "32261112345678000190550010000088121000088120");
  assert.equal(n.numero, "8812");
  assert.equal(n.serie, "1");
  assert.equal(n.emissao, "2026-11-03");
  assert.equal(n.fornecedor, "Ótica Distribuidora & Cia");
  assert.equal(n.cnpj, "12345678000190");
  assert.equal(n.valorTotal, 1254.8);
});

test("itens: EAN vira o código; sem GTIN usa o código do fornecedor; categoria pelo NCM", () => {
  const [a, b, c] = lerNfe(xml).itens;
  assert.deepEqual([a.codigo, a.ean, a.nome, a.quantidade, a.custo, a.categoria], ["7891234567895", "7891234567895", "ARMACAO ACETATO PRETA 52-18", 3, 150, "armacao"]);
  assert.deepEqual([b.codigo, b.ean, b.quantidade, b.custo, b.categoria], ["SOL-AV-01", null, 2, 89.9, "armacao"]);
  assert.deepEqual([c.codigo, c.unidade, c.quantidade, c.custo, c.categoria], ["7890000000013", "CX", 10, 62.5, "lente_contato"]);
});

test("por unidade: frete/desconto viram insumos e IPI/ICMS-ST viram impostos; origem e CEST", () => {
  const [a, b, c] = lerNfe(xml).itens;
  assert.deepEqual([a.insumos, a.impostos, a.origem, a.cest], [5, 7.5, 0, "2805400"]); // frete 15/3; IPI 22,50/3
  assert.deepEqual([b.insumos, b.impostos, b.origem], [-4.9, 6.2, 2]); // desconto 9,80/2; ST 12,40/2
  assert.deepEqual([c.insumos, c.impostos, c.origem, c.cest], [0, 0, null, null]);
});

test("duplicatas viram as parcelas a pagar", () => {
  assert.deepEqual(lerNfe(xml).duplicatas, [
    { numero: "001", vencimento: "2026-12-03", valor: 418.27 },
    { numero: "002", vencimento: "2027-01-02", valor: 418.27 },
    { numero: "003", vencimento: "2027-02-01", valor: 418.26 },
  ]);
});

test("aceita prefixo de namespace e recusa o que não é NF-e", () => {
  const comPrefixo = xml.replace(/<(\/?)(?!\?)(\w+)/g, "<$1nfe:$2");
  assert.equal(lerNfe(comPrefixo).itens.length, 3);
  assert.throws(() => lerNfe("<html><body>DANFE</body></html>"), /não é o XML de uma NF-e/);
});

test("NCM para categoria", () => {
  assert.equal(categoriaPorNcm("9003.11.00"), "armacao");
  assert.equal(categoriaPorNcm("90015000"), "lente");
  assert.equal(categoriaPorNcm("42029200"), "acessorio");
});

test("forma de pagamento ao fornecedor: boleto gera parcelas, cartão e Pix são à vista", () => {
  assert.equal(pagamentoPorTPag(["15"]), "boleto");
  assert.equal(pagamentoPorTPag(["03"]), "a_vista");
  assert.equal(pagamentoPorTPag(["17", "01"]), "a_vista");
  assert.equal(pagamentoPorTPag(["90"]), null);
  assert.equal(lerNfe(xml).pagamento, null); // a nota de exemplo não traz <pag>
  const comCartao = xml.replace("</cobr>", "</cobr><pag><detPag><tPag>03</tPag><vPag>1254.80</vPag></detPag></pag>");
  assert.equal(lerNfe(comCartao).pagamento, "a_vista");
});
