// Testes das máscaras dos campos (dinheiro, porcentagem, documentos e códigos fiscais).
import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarMascara, lerDecimal, valorInicial } from "../src/lib/mascaras.ts";

test("dinheiro enche da direita, como na maquininha", () => {
  assert.equal(aplicarMascara("moeda", "1"), "0,01");
  assert.equal(aplicarMascara("moeda", "12345"), "123,45");
  assert.equal(aplicarMascara("moeda", "123456789"), "1.234.567,89");
  assert.equal(aplicarMascara("moeda", "R$ 1.234,567"), "12.345,67"); // digitou mais um número
  assert.equal(aplicarMascara("moeda", ""), "");
  assert.equal(aplicarMascara("moeda", "-500"), "5,00"); // dinheiro não fica negativo
});

test("porcentagem aceita negativo quando permitido (desconto)", () => {
  assert.equal(aplicarMascara("porcentagem", "500"), "5,00");
  assert.equal(aplicarMascara("porcentagem", "-545", true), "-5,45");
  assert.equal(aplicarMascara("porcentagem", "-", true), "-");
  assert.equal(aplicarMascara("porcentagem", "15000"), "150,00");
});

test("ler o número de volta", () => {
  assert.equal(lerDecimal("1.234,56"), 1234.56);
  assert.equal(lerDecimal("-5,45"), -5.45);
  assert.equal(lerDecimal("99.9"), 99.9);
  assert.equal(lerDecimal(""), null);
  assert.equal(lerDecimal("-"), null);
});

test("documentos e telefone", () => {
  assert.equal(aplicarMascara("cpf", "12345678901"), "123.456.789-01");
  assert.equal(aplicarMascara("cpf", "1234"), "123.4");
  assert.equal(aplicarMascara("cnpj", "12345678000190"), "12.345.678/0001-90");
  assert.equal(aplicarMascara("telefone", "27999990001"), "(27) 99999-0001");
  assert.equal(aplicarMascara("telefone", "2733330000"), "(27) 3333-0000");
  assert.equal(aplicarMascara("telefone", "27"), "(27");
  assert.equal(aplicarMascara("cep", "29100000"), "29100-000");
});

test("códigos fiscais", () => {
  assert.equal(aplicarMascara("ncm", "90031100"), "9003.11.00");
  assert.equal(aplicarMascara("ncm", "9003"), "9003");
  assert.equal(aplicarMascara("cest", "2805400"), "28.054.00");
  assert.equal(aplicarMascara("cfop", "5.102x"), "5102");
  assert.equal(aplicarMascara("digitos", "00"), "00"); // CST 00 mantém o zero
  assert.equal(aplicarMascara("digitos", "000.001"), "000001");
  assert.equal(aplicarMascara("inteiro", "007"), "7");
});

test("valor que vem do banco já aparece formatado", () => {
  assert.equal(valorInicial("moeda", 1254.8), "1.254,80");
  assert.equal(valorInicial("moeda", "450.00"), "450,00");
  assert.equal(valorInicial("porcentagem", -3.3333), "-3,33");
  assert.equal(valorInicial("ncm", "90031100"), "9003.11.00");
  assert.equal(valorInicial("cpf", null), "");
});
