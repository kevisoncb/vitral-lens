import { obterSessao } from "@/lib/sessao";
import type { TipoImportacao } from "@/lib/planilha";
import { Abas } from "../abas";
import { Importador } from "./importador";

/** Importação de planilhas: clientes e catálogo vindos do sistema antigo ou do Excel. */
export default async function PaginaImportar() {
  const sessao = await obterSessao();
  const tipos: TipoImportacao[] = [];
  if (sessao?.pode("clientes", "criar")) tipos.push("clientes");
  if (sessao?.pode("catalogo", "criar")) tipos.push("produtos");

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/importar" />
      <p className="subtitulo">
        Traga os clientes e os produtos do sistema antigo ou do Excel. Nada é apagado: só entram os que ainda não existem.
      </p>
      {tipos.length > 0 ? (
        <Importador tipos={tipos} />
      ) : (
        <p className="vazio">Seu perfil não pode cadastrar clientes nem produtos.</p>
      )}
    </>
  );
}
