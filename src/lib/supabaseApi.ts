import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Api } from "./api";
import type { Cargo, Eleito, Estado, LinhaResultado, Membro, MembroComissao, MembroLista, Rodada, Sala, Sessao, Entrada } from "./types";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(URL && CHAVE);

/** Chaves novas (sb_publishable_) não são JWT: não podem ir no Authorization. */
function fetchComChave(chave: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (chave.startsWith("sb_") && headers.get("Authorization") === `Bearer ${chave}`) headers.delete("Authorization");
    headers.set("apikey", chave);
    return fetch(input, { ...init, headers });
  };
}

let cliente: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!cliente) {
    if (!URL || !CHAVE) throw new Error("Supabase não configurado");
    cliente = createClient(URL, CHAVE, {
      global: { fetch: fetchComChave(CHAVE) },
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "nomeacoes-auth" },
    });
  }
  return cliente;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function ok<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const TABELAS_COM_SESSAO = ["nom_comissao", "nom_cargos", "nom_rodadas", "nom_votou", "nom_eleitos"];

export const supabaseApi: Api = {
  modo: "supabase",

  sala: (codigo) => rpc<Sala>("nom_sala", { p_codigo: codigo }),
  entrar: (codigo, comissaoId, token) =>
    rpc<Entrada>("nom_entrar", { p_codigo: codigo, p_comissao_id: comissaoId, p_token: token ?? null }),
  estado: ({ codigo, token }) => rpc<Estado>("nom_estado", { p_codigo: codigo ?? null, p_token: token ?? null }),
  listaMembros: (token) => rpc<MembroLista[]>("nom_lista_membros", { p_token: token }),
  votar: (token, rodadaId, membros) => rpc<void>("nom_votar", { p_token: token, p_rodada_id: rodadaId, p_membros: membros }),

  assinar(sessaoId, aoMudar) {
    let ch = sb().channel(`nom-${sessaoId}-${Math.random().toString(36).slice(2)}`);
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "nom_sessoes", filter: `id=eq.${sessaoId}` }, aoMudar);
    for (const t of TABELAS_COM_SESSAO) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `sessao_id=eq.${sessaoId}` }, aoMudar);
    }
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") aoMudar();
    });
    // Rede de segurança: exclusões e reconexões nem sempre chegam pelo realtime.
    const intervalo = window.setInterval(aoMudar, 5000);
    return () => {
      window.clearInterval(intervalo);
      void sb().removeChannel(ch);
    };
  },

  async usuario() {
    const { data } = await sb().auth.getSession();
    const email = data.session?.user.email ?? null;
    if (!data.session) return { email: null, admin: false };
    const admin = await rpc<boolean>("nom_eh_admin").catch(() => false);
    return { email, admin };
  },
  async entrarAdmin(email, senha) {
    const { error } = await sb().auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message);
  },
  async sairAdmin() {
    await sb().auth.signOut();
  },

  sessoes: () => ok<Sessao[]>(sb().from("nom_sessoes").select("*").order("created_at", { ascending: false })),
  criarSessao: (nome) => rpc("nom_criar_sessao", { p_nome: nome }),
  async atualizarSessao(id, p) {
    await ok(sb().from("nom_sessoes").update(p).eq("id", id));
  },
  codigo: (sessaoId) => rpc<string>("nom_codigo", { p_sessao_id: sessaoId }),

  membros: (sessaoId) => ok<Membro[]>(sb().from("nom_membros").select("*").eq("sessao_id", sessaoId).order("nome").limit(5000)),
  async adicionarMembros(sessaoId, linhas) {
    for (let i = 0; i < linhas.length; i += 500) {
      await ok(sb().from("nom_membros").insert(linhas.slice(i, i + 500).map((l) => ({ ...l, sessao_id: sessaoId }))));
    }
  },
  async atualizarMembro(id, p) {
    await ok(sb().from("nom_membros").update(p).eq("id", id));
  },
  async removerMembros(ids) {
    for (let i = 0; i < ids.length; i += 200) {
      await ok(sb().from("nom_membros").delete().in("id", ids.slice(i, i + 200)));
    }
  },

  comissao: (sessaoId) => ok<MembroComissao[]>(sb().from("nom_comissao").select("*").eq("sessao_id", sessaoId).order("nome")),
  async adicionarComissao(sessaoId, nomes) {
    await ok(sb().from("nom_comissao").insert(nomes.map((nome) => ({ nome, sessao_id: sessaoId }))));
  },
  async atualizarComissao(id, p) {
    await ok(sb().from("nom_comissao").update(p).eq("id", id));
  },
  async removerComissao(id) {
    await ok(sb().from("nom_comissao").delete().eq("id", id));
  },
  liberarParticipante: (comissaoId, ausente) =>
    rpc("nom_liberar_participante", { p_comissao_id: comissaoId, p_ausente: ausente }),

  cargos: (sessaoId) => ok<Cargo[]>(sb().from("nom_cargos").select("*").eq("sessao_id", sessaoId).order("ordem").order("nome")),
  async adicionarCargos(sessaoId, cargos) {
    await ok(sb().from("nom_cargos").insert(cargos.map((c) => ({ ...c, sessao_id: sessaoId }))));
  },
  async atualizarCargo(id, p) {
    await ok(sb().from("nom_cargos").update(p).eq("id", id));
  },
  async removerCargo(id) {
    await ok(sb().from("nom_cargos").delete().eq("id", id));
  },

  rodadas: (cargoId) => ok<Rodada[]>(sb().from("nom_rodadas").select("*").eq("cargo_id", cargoId).order("numero")),
  eleitos: (sessaoId) => ok<Eleito[]>(sb().from("nom_eleitos").select("id,cargo_id,membro_id,forma,created_at").eq("sessao_id", sessaoId).order("created_at")),
  async quemVotou(rodadaId) {
    const linhas = await ok<{ comissao_id: string }[]>(sb().from("nom_votou").select("comissao_id").eq("rodada_id", rodadaId));
    return linhas.map((l) => l.comissao_id);
  },
  abrirRodada: (cargoId, tipo, turno, candidatos, maxEscolhas) =>
    rpc<string>("nom_abrir_rodada", { p_cargo_id: cargoId, p_tipo: tipo, p_turno: turno, p_candidatos: candidatos, p_max_escolhas: maxEscolhas }),
  encerrarRodada: (rodadaId) => rpc("nom_encerrar_rodada", { p_rodada_id: rodadaId }),
  revelarRodada: (rodadaId) => rpc("nom_revelar_rodada", { p_rodada_id: rodadaId }),
  resultado: (rodadaId) => rpc<LinhaResultado[]>("nom_resultado", { p_rodada_id: rodadaId }),
  eleger: (cargoId, membros, forma, concluir) =>
    rpc("nom_eleger", { p_cargo_id: cargoId, p_membros: membros, p_forma: forma, p_concluir: concluir }),
  async removerEleito(cargoId, membroId) {
    await ok(sb().from("nom_eleitos").delete().eq("cargo_id", cargoId).eq("membro_id", membroId));
    await ok(sb().from("nom_cargos").update({ status: "em_andamento" }).eq("id", cargoId));
  },
  async concluirCargo(cargoId, concluido) {
    await ok(sb().from("nom_cargos").update({ status: concluido ? "concluido" : "em_andamento" }).eq("id", cargoId));
  },
  reiniciarCargo: (cargoId) => rpc("nom_reiniciar_cargo", { p_cargo_id: cargoId }),
  selecionarCargo: (cargoId) => rpc("nom_selecionar_cargo", { p_cargo_id: cargoId }),
};
