import Link from "next/link";
import { criarReceita } from "./actions";

const COLUNAS = [
  ["esferico", "Esférico"],
  ["cilindrico", "Cilíndrico"],
  ["eixo", "Eixo"],
  ["adicao", "Adição"],
  ["dnp", "DNP"],
  ["altura", "Altura"],
  ["prisma", "Prisma"],
  ["base", "Base"],
] as const;

export default async function NovaReceita({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const salvar = criarReceita.bind(null, id);

  return (
    <>
      <h1>Nova receita</h1>
      <form action={salvar} className="formulario formulario-largo" encType="multipart/form-data">
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="linha">
          <label className="rotulo">Data da receita
            <input className="campo" type="date" name="data_receita" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </label>
          <label className="rotulo">Tipo
            <select className="campo" name="tipo" defaultValue="oculos">
              <option value="oculos">Óculos</option>
              <option value="contato">Lente de contato</option>
            </select>
          </label>
          <label className="rotulo">Validade
            <input className="campo" type="date" name="validade" />
          </label>
        </div>
        <div className="linha">
          <label className="rotulo">Médico(a)
            <input className="campo" name="medico" />
          </label>
          <label className="rotulo">CRM
            <input className="campo" name="crm" />
          </label>
          <label className="marcar">
            <input type="checkbox" name="externa" defaultChecked />
            Receita de fora (trazida pelo cliente)
          </label>
        </div>

        {(["OD", "OE"] as const).map((olho) => (
          <fieldset key={olho} className="olho">
            <legend>{olho === "OD" ? "Olho direito (OD)" : "Olho esquerdo (OE)"}</legend>
            <div className="grade-olho">
              {COLUNAS.map(([campo, rotulo]) => (
                <label key={campo} className="rotulo">{rotulo}
                  <input className="campo" name={`${olho}_${campo}`} inputMode={campo === "base" ? "text" : "decimal"} placeholder="0,00" />
                </label>
              ))}
              <label className="rotulo">Curva base (LC)
                <input className="campo" name={`${olho}_curva_base`} inputMode="decimal" />
              </label>
              <label className="rotulo">Diâmetro (LC)
                <input className="campo" name={`${olho}_diametro`} inputMode="decimal" />
              </label>
            </div>
          </fieldset>
        ))}

        <label className="rotulo">Observações
          <textarea className="campo" name="observacao" rows={3} />
        </label>
        <label className="rotulo">Foto ou PDF da receita
          <input className="campo" type="file" name="anexo" accept="image/*,application/pdf" />
        </label>

        <div className="janela-botoes">
          <Link className="botao-secundario" href={`/clientes/${id}`}>Cancelar</Link>
          <button className="botao" type="submit">Salvar receita</button>
        </div>
      </form>
    </>
  );
}
