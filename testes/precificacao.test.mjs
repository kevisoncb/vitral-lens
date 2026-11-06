// Testes da conta de custo e preço (insumos/impostos em R$ ou %, margem sobre o custo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { converter, custoFinal, margemPeloPreco, precoPelaMargem } from "../src/lib/precificacao.ts";

test("custo final mistura reais e porcentagem", () => {
  assert.equal(custoFinal(150, 5, "reais", 7.5, "porcentagem"), 166.25); // frete R$ 5 + IPI 7,5% (R$ 11,25)
  assert.equal(custoFinal(89.9, -4.9, "reais", 6.2, "reais"), 91.2); // desconto e ICMS-ST em reais
  assert.equal(custoFinal(100, 10, "porcentagem", 0, "reais"), 110);
});

test("margem é sobre o custo: 30% em R$ 100 dá R$ 130, e volta", () => {
  assert.equal(precoPelaMargem(100, 30), 130);
  assert.equal(precoPelaMargem(166.25, 30), 216.13);
  assert.equal(margemPeloPreco(100, 130), 30);
  assert.equal(margemPeloPreco(0, 130), null);
});

test("trocar R$ por % mantém o mesmo dinheiro", () => {
  assert.equal(converter(11.25, "reais", "porcentagem", 150), 7.5);
  assert.equal(converter(7.5, "porcentagem", "reais", 150), 11.25);
  assert.equal(converter(5, "reais", "reais", 150), 5);
});
