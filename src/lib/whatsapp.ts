/**
 * Link do WhatsApp com a mensagem pronta. O Vitral não envia nada sozinho:
 * o funcionário abre a conversa e aperta enviar.
 */
export function linkWhatsApp(telefone: string | null | undefined, mensagem: string): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemCobrarRetorno(nomeCliente: string, nomeOtica: string): string {
  const primeiro = nomeCliente.split(" ")[0];
  return `Olá ${primeiro}, tudo bem? Aqui é da ${nomeOtica}. Passando para saber se você conseguiu avaliar o orçamento dos seus óculos. Posso te ajudar com alguma dúvida?`;
}

export function mensagemOculosPronto(nomeCliente: string, nomeOtica: string): string {
  const primeiro = nomeCliente.split(" ")[0];
  return `Olá ${primeiro}, seus óculos chegaram na ${nomeOtica}! Você já pode vir retirar. Qualquer dúvida, é só chamar.`;
}

export function mensagemLembreteParcela(nomeCliente: string, nomeOtica: string, valor: string, vencimento: string): string {
  const primeiro = nomeCliente.split(" ")[0];
  return `Olá ${primeiro}, tudo bem? Aqui é da ${nomeOtica}. Passando para lembrar da parcela de ${valor} com vencimento em ${vencimento}. Se já pagou, desconsidere. Obrigado!`;
}

/** Motivos da lista "Clientes para chamar" (função clientes_para_chamar()). */
export type MotivoChamar = "receita_vencendo" | "aniversario" | "oculos_um_ano" | "orcamento_perdido";

export const ROTULO_MOTIVO: Record<MotivoChamar, string> = {
  aniversario: "Aniversário",
  receita_vencendo: "Receita vencendo",
  oculos_um_ano: "Óculos há 1 ano",
  orcamento_perdido: "Orçamento perdido",
};

/** Mensagem pronta para cada motivo. O funcionário pode mudar antes de enviar. */
export function mensagemChamar(motivo: MotivoChamar, nomeCliente: string, nomeOtica: string): string {
  const primeiro = nomeCliente.split(" ")[0];
  switch (motivo) {
    case "aniversario":
      return `Olá ${primeiro}! Aqui é da ${nomeOtica}. Passando para te desejar um feliz aniversário! Que seja um ano de muita saúde e alegria. Quando quiser renovar os óculos, estamos aqui.`;
    case "receita_vencendo":
      return `Olá ${primeiro}, tudo bem? Aqui é da ${nomeOtica}. Sua receita está perto de completar um ano. Que tal agendar um novo exame de vista para conferir se o grau mudou?`;
    case "oculos_um_ano":
      return `Olá ${primeiro}, tudo bem? Aqui é da ${nomeOtica}. Já faz um ano que você levou seus óculos. Como eles estão? Se quiser, passe aqui para um ajuste e limpeza, sem custo.`;
    case "orcamento_perdido":
      return `Olá ${primeiro}, tudo bem? Aqui é da ${nomeOtica}. Ainda está pensando nos óculos novos? Temos novidades e condições especiais esta semana. Posso te mandar?`;
  }
}
