import Link from "next/link";
import { criarCliente } from "./actions";
import { CampoMascara } from "@/components/campo-mascara";

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <h1>Novo cliente</h1>
      <form action={criarCliente} className="formulario">
        {erro && <p className="erro" role="alert">{erro}</p>}
        <label className="rotulo">Nome completo
          <input className="campo" name="nome" required autoFocus />
        </label>
        <label className="rotulo">Telefone (WhatsApp)
          <CampoMascara mascara="telefone" name="telefone" placeholder="(27) 99999-0000" />
        </label>
        <label className="rotulo">E-mail
          <input className="campo" name="email" type="email" />
        </label>
        <div className="linha">
          <label className="rotulo">CPF
            <CampoMascara mascara="cpf" name="cpf" placeholder="000.000.000-00" />
          </label>
          <label className="rotulo">Nascimento
            <input className="campo" name="nascimento" type="date" />
          </label>
        </div>
        <label className="rotulo">Endereço
          <input className="campo" name="endereco" />
        </label>
        <label className="marcar">
          <input type="checkbox" name="lgpd" />
          Cliente autorizou o uso dos dados e da receita (LGPD)
        </label>
        <div className="janela-botoes">
          <Link className="botao-secundario" href="/clientes">Cancelar</Link>
          <button className="botao" type="submit">Salvar cliente</button>
        </div>
      </form>
    </>
  );
}
