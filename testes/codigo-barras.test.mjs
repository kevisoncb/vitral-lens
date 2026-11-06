// Testes do código de barras (Code 128). Lê as barras de volta como um leitor faria e confere o
// dígito verificador. A tabela de símbolos foi comparada com a da biblioteca python-barcode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoValido, modulosCode128, simbolosCode128, svgCode128 } from "../src/lib/codigo-barras.ts";

/** Separa os módulos em blocos de símbolo, como um leitor faz. */
function ler(modulos) {
  // cada símbolo tem 11 módulos; o de fim tem 13
  const simbolos = [];
  let i = 0;
  while (i + 11 <= modulos.length) {
    const resto = modulos.length - i;
    simbolos.push(modulos.slice(i, resto === 13 ? i + 13 : i + 11));
    i += resto === 13 ? 13 : 11;
  }
  return simbolos;
}

function larguras(m) {
  return m.match(/1+|0+/g).map((x) => x.length).join("");
}

test("cada símbolo tem 11 módulos (o de fim, 13) e começa com barra", () => {
  for (const t of ["AR-01", "789003", "VT000123", "Aro preto 52-18"]) {
    const m = modulosCode128(t);
    assert.equal((m.length - 13) % 11, 0, t);
    assert.ok(m.startsWith("1") && m.endsWith("11"), t);
  }
});

test("lido de volta, cada símbolo tem as larguras do padrão e o verificador confere", () => {
  for (const t of ["AR-01", "789003", "VT000123", "ABC12345", "a@b.c/9"]) {
    const simbolos = simbolosCode128(t);
    const blocos = ler(modulosCode128(t));
    assert.equal(blocos.length, simbolos.length, t);
    // verificador: início + soma(valor × posição), módulo 103
    const dados = simbolos.slice(0, -2);
    const verificador = dados.reduce((s, v, i) => s + v * Math.max(i, 1), 0) % 103;
    assert.equal(simbolos.at(-2), verificador, t);
    // larguras de cada bloco somam 11 (fim: 13)
    blocos.forEach((b, i) => assert.equal([...larguras(b)].reduce((s, w) => s + Number(w), 0), i === blocos.length - 1 ? 13 : 11, `${t} símbolo ${i}`));
  }
});

test("só números com quantidade par usa o conjunto C (mais curto)", () => {
  assert.equal(simbolosCode128("789003")[0], 105);
  assert.equal(simbolosCode128("12345")[0], 104);
  assert.equal(simbolosCode128("AR-01")[0], 104);
  // valores do conjunto B: caractere - 32
  assert.deepEqual(simbolosCode128("AR-01").slice(1, 6), [33, 50, 13, 16, 17]);
  assert.deepEqual(simbolosCode128("789003").slice(1, 4), [78, 90, 3]);
});

test("referência conferida com a python-barcode", () => {
  // barras geradas pela python-barcode 0.15.1 para os mesmos códigos (iguais, módulo a módulo)
  assert.equal(modulosCode128("AR-01"), "110100100001010001100011000101110100110111001001110110010011100110100110111001100011101011");
  assert.equal(modulosCode128("789003"), "11010011100110000101001101111011010010011000101001100001100011101011");
});

test("acento não cabe no código de barras", () => {
  assert.equal(codigoValido("Ótica"), false);
  assert.throws(() => simbolosCode128("Ótica"));
  assert.match(svgCode128("AR-01"), /^<svg .*<\/svg>$/);
});
