import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Domínio próprio da ótica -> site público. Ex.: SITE_DOMINIOS="oticasnery.com.br=nery,www.oticasnery.com.br=nery"
 * Cada domínio também precisa ser adicionado no projeto da Vercel.
 */
function slugDoDominio(host: string | null): string | null {
  if (!host) return null;
  const limpo = host.split(":")[0].toLowerCase();
  for (const par of (process.env.SITE_DOMINIOS ?? "").split(",")) {
    const [dominio, slug] = par.split("=").map((t) => t?.trim().toLowerCase());
    if (dominio && slug && dominio === limpo) return slug;
  }
  return null;
}

/** Renova a sessão e manda quem não está logado para /login. O site público não exige login. */
export async function middleware(request: NextRequest) {
  const slug = slugDoDominio(request.headers.get("host"));
  if (slug) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith("/site/")) {
      url.pathname = `/site/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname.startsWith("/site/")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista: { name: string; value: string; options: CookieOptions }[]) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  // "/" é o site do Vitral (lista de espera); quem está logado vai direto para o sistema
  const publica = caminho === "/login" || caminho === "/";

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
