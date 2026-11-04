import type { MetadataRoute } from "next";

/** Instalar o Vitral como app (celular, tablet e computador): ícone na tela inicial e tela cheia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vitral · sistema para óticas",
    short_name: "Vitral",
    description: "Consultório, loja e laboratório da ótica num fluxo só.",
    lang: "pt-BR",
    start_url: "/inicio", // cada área é levada para a sua tela
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f6f4",
    theme_color: "#12302c",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-mascaravel-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vendas", url: "/vendas", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Caixa (PDV)", url: "/pdv", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Produção", url: "/producao", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
