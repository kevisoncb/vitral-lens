/**
 * Código de barras Code 128 (o que os leitores USB e o celular leem), desenhado em SVG sem biblioteca.
 * Usa o conjunto C (pares de dígitos) quando o código é só número com quantidade par de dígitos,
 * e o conjunto B (letras, números e símbolos) nos outros casos.
 */

// larguras barra/espaço de cada símbolo 0..105; 106 é o fim
const PADROES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const INICIO_B = 104;
const INICIO_C = 105;
const FIM = 106;

/** Códigos que cabem numa etiqueta: letras sem acento, números e símbolos comuns. */
export function codigoValido(texto: string): boolean {
  return /^[\x20-\x7e]{1,40}$/.test(texto);
}

/** Símbolos (valores 0..106) do código, com o início, o dígito verificador e o fim. */
export function simbolosCode128(texto: string): number[] {
  if (!codigoValido(texto)) throw new Error("Código com caractere que não cabe no código de barras");
  const soPares = /^\d+$/.test(texto) && texto.length % 2 === 0 && texto.length >= 4;
  const valores = soPares
    ? [INICIO_C, ...(texto.match(/\d\d/g) ?? []).map(Number)]
    : [INICIO_B, ...[...texto].map((c) => c.charCodeAt(0) - 32)];
  const verificador = valores.reduce((soma, v, i) => soma + v * Math.max(i, 1), 0) % 103;
  return [...valores, verificador, FIM];
}

/** Sequência de módulos: "1" = barra, "0" = espaço (sem as margens). */
export function modulosCode128(texto: string): string {
  let saida = "";
  for (const s of simbolosCode128(texto)) {
    [...PADROES[s]].forEach((largura, i) => {
      saida += (i % 2 === 0 ? "1" : "0").repeat(Number(largura));
    });
  }
  return saida;
}

/** SVG do código de barras, com a margem branca de 10 módulos que os leitores pedem. */
export function svgCode128(texto: string, altura = 40): string {
  const modulos = modulosCode128(texto);
  const margem = 10;
  const largura = modulos.length + margem * 2;
  let barras = "";
  let i = 0;
  while (i < modulos.length) {
    if (modulos[i] === "1") {
      let fim = i;
      while (modulos[fim] === "1") fim++;
      barras += `<rect x="${i + margem}" y="0" width="${fim - i}" height="${altura}"/>`;
      i = fim;
    } else i++;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Código de barras ${texto.replace(/[<>&"]/g, "")}"><rect width="${largura}" height="${altura}" fill="#fff"/><g fill="#000">${barras}</g></svg>`;
}
