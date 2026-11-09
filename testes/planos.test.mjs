// Testes dos planos (Essencial, Especial, lojas extras).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mensalidade, nomeDoPlano, recursosLiberados } from "../src/lib/planos.ts";

test("Especial libera as notas fiscais junto", () => {
  assert.deepEqual([...recursosLiberados(["plano_especial"])].sort(), ["nota_fiscal", "plano_especial"]);
  assert.deepEqual([...recursosLiberados(["nota_fiscal"])], ["nota_fiscal"]);
  assert.equal(recursosLiberados([]).size, 0);
});

test("mensalidade: R$ 99, R$ 199 e R$ 49 por loja extra", () => {
  assert.equal(mensalidade({}), 99);
  assert.equal(mensalidade({ plano_especial: 1 }), 199);
  assert.equal(mensalidade({ plano_especial: 1, multiloja: 2 }), 297);
  assert.equal(mensalidade({ nota_fiscal: 1 }), 99);
  assert.equal(nomeDoPlano({ plano_especial: 1 }), "Especial");
  assert.equal(nomeDoPlano({ multiloja: 1 }), "Essencial");
});
