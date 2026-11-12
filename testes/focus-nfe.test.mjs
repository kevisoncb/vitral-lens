// Testes da conversa com a Focus NFe, com um "fetch" falso no lugar da internet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarNfce, dataEmissao, emitirNfce, urlArquivo } from "../src/lib/focus-nfe.ts";

function falso(respostas) {
  const chamadas = [];
  const f = async (url, init = {}) => {
    chamadas.push({ url, metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    const [status, corpo] = respostas.shift();
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  };
  return { f, chamadas };
}

test("emite em homologação com Basic (token como usuário) e a hora de Brasília", async () => {
  const { f, chamadas } = falso([[201, { status: "autorizado", numero: "15", serie: "1", chave_nfe: "3226", caminho_danfe: "/arquivos/x.html", qrcode_url: "https://qr" }]]);
  const r = await emitirNfce("tok", "homologacao", "vitral-1", { cnpj_emitente: "123", items: [] }, f);
  assert.equal(r.status, "autorizado");
  assert.equal(r.numero, "15");
  assert.equal(chamadas[0].url, "https://homologacao.focusnfe.com.br/v2/nfce?ref=vitral-1");
  assert.equal(chamadas[0].metodo, "POST");
  assert.equal(chamadas[0].auth, `Basic ${Buffer.from("tok:").toString("base64")}`);
  assert.match(chamadas[0].corpo.data_emissao, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
});

test("rejeição da SEFAZ traz o motivo", async () => {
  const { f } = falso([[200, { status: "erro_autorizacao", status_sefaz: "704", mensagem_sefaz: "Rejeição: NFC-e com Data-Hora de emissão atrasada" }]]);
  const r = await emitirNfce("tok", "producao", "vitral-2", {}, f);
  assert.equal(r.status, "erro_autorizacao");
  assert.match(r.mensagem, /Data-Hora de emissão atrasada/);
});

test("referência já processada: consulta em vez de emitir de novo", async () => {
  const { f, chamadas } = falso([
    [422, { codigo: "already_processed", mensagem: "Nota fiscal já processada" }],
    [200, { status: "autorizado", numero: "16" }],
  ]);
  const r = await emitirNfce("tok", "producao", "vitral-3", {}, f);
  assert.equal(r.status, "autorizado");
  assert.equal(chamadas[1].url, "https://api.focusnfe.com.br/v2/nfce/vitral-3");
  assert.equal(chamadas[1].metodo, "GET");
});

test("erro de validação vira mensagem legível", async () => {
  const { f } = falso([[400, { codigo: "erro_validacao_schema", mensagem: "Erro de schema", erros: [{ mensagem: "codigo_ncm inválido" }] }]]);
  const r = await emitirNfce("tok", "homologacao", "vitral-4", {}, f);
  assert.equal(r.status, "erro");
  assert.equal(r.mensagem, "codigo_ncm inválido");
});

test("emissor fora do ar ou sem conexão: fica pendente para tentar de novo", async () => {
  const { f } = falso([[503, {}]]);
  assert.equal((await emitirNfce("tok", "producao", "vitral-5", {}, f)).semResposta, true);
  const semRede = async () => { throw new Error("ECONNRESET"); };
  assert.equal((await emitirNfce("tok", "producao", "vitral-5", {}, semRede)).semResposta, true);
});

test("cancelamento manda a justificativa no DELETE", async () => {
  const { f, chamadas } = falso([[200, { status: "cancelado", mensagem_sefaz: "Cancelamento homologado" }]]);
  const r = await cancelarNfce("tok", "homologacao", "vitral-1", "Cliente desistiu da compra na hora", f);
  assert.equal(r.status, "cancelado");
  assert.equal(chamadas[0].metodo, "DELETE");
  assert.deepEqual(chamadas[0].corpo, { justificativa: "Cliente desistiu da compra na hora" });
});

test("caminho do DANFCe vira endereço completo; hora no fuso de Brasília", () => {
  assert.equal(urlArquivo("producao", "/arquivos/x.html"), "https://api.focusnfe.com.br/arquivos/x.html");
  assert.equal(urlArquivo("homologacao", "https://outro/x"), "https://outro/x");
  assert.equal(dataEmissao(new Date("2026-11-04T15:00:00Z")), "2026-11-04T12:00:00-03:00");
});
