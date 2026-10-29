import { entrar } from "./actions";

const MENSAGENS: Record<string, string> = {
  campos: "Informe o e-mail e a senha.",
  credenciais: "E-mail ou senha incorretos.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagem = erro ? (MENSAGENS[erro] ?? "Não foi possível entrar.") : null;

  return (
    <main className="login">
      <section className="login-marca">
        <strong style={{ fontSize: 24 }}>Vitral</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h1>Nenhum cliente esquecido no caminho.</h1>
          <p>
            Vendas, laboratório, receitas e agenda da sua ótica em um só lugar, no computador,
            tablet ou celular.
          </p>
        </div>
        <p style={{ fontSize: 14, color: "#a9c4be" }}>
          Acesso individual por funcionário · dados protegidos conforme a LGPD
        </p>
      </section>

      <section className="login-form-area">
        <form className="login-form" action={entrar}>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.02em" }}>Entrar</h2>
            <p className="subtitulo">Use o e-mail que a sua ótica cadastrou para você.</p>
          </div>

          {mensagem && (
            <div className="erro" role="alert">
              {mensagem}
            </div>
          )}

          <div>
            <label className="rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              className="campo"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@suaotica.com.br"
              required
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="senha">
              Senha
            </label>
            <input
              className="campo"
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="botao" type="submit" style={{ height: 50, fontSize: 16 }}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
