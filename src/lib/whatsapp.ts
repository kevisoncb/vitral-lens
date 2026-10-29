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
