"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { enviarFoto, type EstadoFoto } from "./actions";

/** Reduz a foto no próprio aparelho (até 1280 px, JPEG) antes de enviar: rápido e leve. */
async function reduzir(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1280 / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.82));
}

export function FotoProduto({ itemId, nome, fotoAtual }: { itemId: string; nome: string; fotoAtual: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoFoto, FormData>(enviarFoto.bind(null, itemId), null);
  const [previa, setPrevia] = useState<string | null>(fotoAtual);
  const [preparando, setPreparando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setPreparando(true);
    const blob = await reduzir(arquivo).catch(() => arquivo);
    setPrevia(URL.createObjectURL(blob));
    const dados = new FormData();
    dados.set("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
    setPreparando(false);
    startTransition(() => enviar(dados));
  }

  return (
    <div className="foto-produto">
      <div className="foto-previa">
        {previa ? <img src={estado?.url ?? previa} alt={`Foto de ${nome}`} /> : <span>Sem foto</span>}
      </div>
      <div className="foto-acoes">
        <strong>{nome}</strong>
        <input ref={entrada} type="file" accept="image/*" capture="environment" onChange={aoEscolher} hidden />
        <button type="button" className="botao" onClick={() => entrada.current?.click()} disabled={enviando || preparando}>
          {preparando ? "Preparando…" : enviando ? "Enviando…" : previa ? "Trocar foto" : "Tirar ou escolher foto"}
        </button>
        {estado && <small className={estado.ok ? "ok" : "erro"}>{estado.mensagem}</small>}
      </div>
    </div>
  );
}
