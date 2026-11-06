"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assinarOS } from "./actions";

/** Quadro para assinar com o dedo (ou o mouse), nome e aceite. */
export function QuadroAssinatura({ token, nomeSugerido }: { token: string; nomeSugerido: string }) {
  const quadro = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [tracos, setTracos] = useState(0);
  const [nome, setNome] = useState(nomeSugerido);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const c = quadro.current;
    if (!c) return;
    const escala = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * escala);
    c.height = Math.round(height * escala);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#12302C";
  }, []);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function parar() {
    if (desenhando.current) setTracos((t) => t + 1);
    desenhando.current = false;
  }
  function limpar() {
    const c = quadro.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setTracos(0);
  }

  function enviar() {
    setErro(null);
    if (tracos === 0) return setErro("Faça a sua assinatura no quadro.");
    if (nome.trim().length < 3) return setErro("Escreva seu nome completo.");
    if (!aceite) return setErro("Marque que conferiu os dados.");
    const imagem = quadro.current?.toDataURL("image/png") ?? "";
    iniciar(async () => {
      const r = await assinarOS(token, nome.trim(), imagem);
      if (!r.ok) setErro(r.mensagem ?? "Não foi possível assinar. Tente de novo.");
      else router.refresh();
    });
  }

  return (
    <div className="formulario">
      <label className="rotulo">Seu nome completo
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      </label>
      <div className="rotulo">
        <span>Assine aqui com o dedo</span>
        <canvas
          ref={quadro}
          className="quadro-assinatura"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={parar}
          onPointerLeave={parar}
          aria-label="Quadro para assinar"
        />
        <button type="button" className="botao-secundario" onClick={limpar} style={{ alignSelf: "flex-start" }}>Limpar</button>
      </div>
      <label className="marcar">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        Conferi a receita, as lentes, a armação, o prazo e o valor acima, e estão corretos.
      </label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="botao" type="button" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Assinar"}</button>
    </div>
  );
}
