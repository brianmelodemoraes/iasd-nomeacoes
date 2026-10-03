/**
 * Modo demonstração: o mesmo comportamento do banco, mas tudo no navegador.
 * Abra o moderador, o telão e o celular em abas diferentes: elas se sincronizam.
 * Espelha as regras das funções SQL (supabase/migrations).
 */
import type { Api } from "./api";
import { CARGOS_PADRAO } from "./departamentos";
import type {
  Cargo, Eleito, Estado, LinhaResultado, Membro, MembroComissao, ResultadoPublico, Rodada, Sessao,
} from "./types";

interface Db {
  sessoes: Sessao[];
  codigos: Record<string, string>; // sessao_id -> codigo
  membros: Membro[];
  comissao: MembroComissao[];
  tokens: Record<string, string>; // comissao_id -> token
  cargos: Cargo[];
  rodadas: Rodada[];
  votou: { rodada_id: string; comissao_id: string; sessao_id: string }[];
  votos: { rodada_id: string; membro_id: string }[];
  eleitos: (Eleito & { sessao_id: string })[];
}

const CHAVE = "nomeacoes-demo-db";
const CANAL = "nomeacoes-demo";
export const CODIGO_DEMO = "DEMO26";

const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const agora = () => new Date().toISOString();
const erro = (codigo: string) => Promise.reject(new Error(codigo));

const SOBRENOMES = ["Almeida", "Barbosa", "Cardoso", "Duarte", "Esteves", "Fonseca", "Gomes", "Lima", "Moraes", "Nogueira", "Oliveira", "Pinheiro", "Queiroz", "Rocha", "Santos", "Teixeira", "Vieira", "Xavier"];
const NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Elaine", "Fábio", "Gabriela", "Hugo", "Isabela", "João", "Karina", "Lucas", "Mariana", "Natan", "Olívia", "Paulo", "Rafaela", "Samuel", "Tatiane", "Vitor", "Yasmin", "Zeca", "Renata", "Márcio"];

function semente(): Db {
  const sessaoId = id();
  const membros: Membro[] = [];
  let n = 0;
  for (const sobrenome of SOBRENOMES) {
    const qtd = 2 + (sobrenome.length % 3);
    for (let i = 0; i < qtd; i++) {
      membros.push({ id: id(), sessao_id: sessaoId, nome: `${NOMES[n % NOMES.length]} ${sobrenome}`, familia: sobrenome, ativo: true });
      n++;
    }
  }
  const comissao: MembroComissao[] = Array.from({ length: 20 }, (_, i) => ({
    id: id(), sessao_id: sessaoId, nome: `${NOMES[(i * 7) % NOMES.length]} ${SOBRENOMES[(i * 5) % SOBRENOMES.length]} (comissão)`, presente: false, entrou_em: null,
  }));
  return {
    sessoes: [{ id: sessaoId, nome: "Nomeações 2027 · demonstração", status: "preparando", cargo_atual_id: null, rodada_atual_id: null, limiar_aclamacao: 0.8, created_at: agora() }],
    codigos: { [sessaoId]: CODIGO_DEMO },
    membros,
    comissao,
    tokens: {},
    cargos: CARGOS_PADRAO.map((c) => ({ ...c, id: id(), sessao_id: sessaoId, status: "pendente" as const })),
    rodadas: [],
    votou: [],
    votos: [],
    eleitos: [],
  };
}

function ler(): Db {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Db;
  } catch {
    /* sem armazenamento: recomeça */
  }
  const db = semente();
  gravar(db, false);
  return db;
}

const ouvintes = new Set<() => void>();
let canal: BroadcastChannel | null = null;
function iniciarCanal() {
  if (canal || typeof BroadcastChannel === "undefined") return;
  canal = new BroadcastChannel(CANAL);
  canal.onmessage = () => ouvintes.forEach((f) => f());
}

function gravar(db: Db, avisar = true) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch {
    /* ignora */
  }
  if (avisar) {
    iniciarCanal();
    canal?.postMessage("mudou");
    ouvintes.forEach((f) => setTimeout(f, 0));
  }
}

/** Lê, altera e grava numa única operação. */
function mudar<T>(fn: (db: Db) => T): T {
  const db = ler();
  const r = fn(db);
  gravar(db);
  return r;
}

function sessaoPorCodigo(db: Db, codigo?: string) {
  const c = (codigo ?? "").trim().toUpperCase();
  const sid = Object.entries(db.codigos).find(([, v]) => v === c)?.[0];
  return db.sessoes.find((s) => s.id === sid);
}

function participante(db: Db, token?: string | null) {
  if (!token) return undefined;
  const cid = Object.entries(db.tokens).find(([, t]) => t === token)?.[0];
  return db.comissao.find((c) => c.id === cid);
}

function eleitoPara(db: Db, membroId: string): string[] {
  return db.eleitos
    .filter((e) => e.membro_id === membroId)
    .map((e) => db.cargos.find((c) => c.id === e.cargo_id))
    .filter((c): c is Cargo => Boolean(c))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.nome);
}

const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");

function montarEstado(db: Db, s: Sessao, token?: string): Estado {
  const c = participante(db, token);
  const presentes = db.comissao.filter((x) => x.sessao_id === s.id && x.presente).length;
  const r = db.rodadas.find((x) => x.id === s.rodada_atual_id);
  const votaram = r ? db.votou.filter((v) => v.rodada_id === r.id).length : 0;
  const membro = (mid: string) => db.membros.find((m) => m.id === mid);

  let resultado: ResultadoPublico[] | null = null;
  if (r?.status === "revelada") {
    const cont = new Map<string, number>();
    for (const v of db.votos.filter((v) => v.rodada_id === r.id)) cont.set(v.membro_id, (cont.get(v.membro_id) ?? 0) + 1);
    resultado = [...cont.entries()]
      .map(([mid, votos]) => ({ membro_id: mid, nome: membro(mid)?.nome ?? "?", votos }))
      .sort((a, b) => b.votos - a.votos || porNome(a, b));
  }

  return {
    sessao: {
      id: s.id, nome: s.nome, status: s.status, codigo: db.codigos[s.id],
      cargo_atual_id: s.cargo_atual_id, limiar_aclamacao: s.limiar_aclamacao,
    },
    comissao_total: db.comissao.filter((x) => x.sessao_id === s.id).length,
    presentes,
    cargos: db.cargos
      .filter((cg) => cg.sessao_id === s.id)
      .sort((a, b) => a.ordem - b.ordem || porNome(a, b))
      .map((cg) => ({
        id: cg.id, ordem: cg.ordem, nome: cg.nome, cor: cg.cor, vagas: cg.vagas, max_indicacoes: cg.max_indicacoes, status: cg.status,
        eleitos: db.eleitos
          .filter((e) => e.cargo_id === cg.id)
          .map((e) => ({ membro_id: e.membro_id, nome: membro(e.membro_id)?.nome ?? "?", forma: e.forma })),
      })),
    rodada: r
      ? {
          id: r.id, cargo_id: r.cargo_id, numero: r.numero, tipo: r.tipo, turno: r.turno, status: r.status,
          max_escolhas: r.max_escolhas,
          presentes: r.status === "aberta" ? presentes : r.presentes,
          votaram,
          candidatos: r.candidatos
            .map((mid) => membro(mid))
            .filter((m): m is Membro => Boolean(m))
            .sort(porNome)
            .map((m) => ({ id: m.id, nome: m.nome, eleito_para: eleitoPara(db, m.id) })),
          resultado,
        }
      : null,
    eu: c
      ? { comissao_id: c.id, nome: c.nome, presente: c.presente, ja_votou: Boolean(r && db.votou.some((v) => v.rodada_id === r.id && v.comissao_id === c.id)) }
      : null,
  };
}

function encerrar(db: Db, r: Rodada) {
  if (r.status !== "aberta") return;
  const presentes = db.comissao.filter((x) => x.sessao_id === r.sessao_id && x.presente).length;
  r.status = "encerrada";
  r.presentes = Math.max(presentes, db.votou.filter((v) => v.rodada_id === r.id).length);
}

export interface DemoExtras {
  /** Marca toda a comissão como presente (como se todos tivessem entrado). */
  simularEntradas(sessaoId: string): Promise<void>;
  /** Faz quem ainda não votou votar aleatoriamente (com tendência a um favorito). */
  simularVotos(rodadaId: string): Promise<void>;
  /** Apaga tudo e recomeça a demonstração. */
  reiniciarDemo(): Promise<void>;
}

export const demoApi: Api & DemoExtras = {
  modo: "demo",

  async sala(codigo) {
    const db = ler();
    const s = sessaoPorCodigo(db, codigo);
    if (!s) return erro("SALA_NAO_ENCONTRADA");
    return {
      sessao_id: s.id, nome: s.nome, status: s.status,
      comissao: db.comissao.filter((c) => c.sessao_id === s.id).sort(porNome).map((c) => ({ id: c.id, nome: c.nome, ocupado: Boolean(db.tokens[c.id]) })),
    };
  },

  async entrar(codigo, comissaoId, token) {
    const db = ler();
    const s = sessaoPorCodigo(db, codigo);
    if (!s) return erro("SALA_NAO_ENCONTRADA");
    if (s.status === "encerrada") return erro("SALA_ENCERRADA");
    const c = db.comissao.find((x) => x.id === comissaoId && x.sessao_id === s.id);
    if (!c) return erro("NOME_NAO_ENCONTRADO");
    let t = db.tokens[c.id];
    if (t) {
      if (token !== t) return erro("NOME_EM_USO");
    } else {
      t = id() + id();
      db.tokens[c.id] = t;
    }
    c.presente = true;
    c.entrou_em ??= agora();
    gravar(db);
    return { token: t, comissao_id: c.id, sessao_id: s.id, nome: c.nome };
  },

  async estado({ codigo, token }) {
    const db = ler();
    let s: Sessao | undefined;
    if (token) {
      const c = participante(db, token);
      if (!c) return erro("TOKEN_INVALIDO");
      s = db.sessoes.find((x) => x.id === c.sessao_id);
    } else {
      s = sessaoPorCodigo(db, codigo);
    }
    if (!s) return erro("SALA_NAO_ENCONTRADA");
    return montarEstado(db, s, token);
  },

  async listaMembros(token) {
    const db = ler();
    const c = participante(db, token);
    if (!c) return erro("TOKEN_INVALIDO");
    return db.membros.filter((m) => m.sessao_id === c.sessao_id && m.ativo).sort(porNome).map((m) => ({ id: m.id, nome: m.nome, eleito_para: eleitoPara(db, m.id) }));
  },

  async votar(token, rodadaId, membros) {
    const db = ler();
    const c = participante(db, token);
    if (!c) return erro("TOKEN_INVALIDO");
    if (!c.presente) return erro("NAO_PRESENTE");
    const r = db.rodadas.find((x) => x.id === rodadaId);
    if (!r || r.sessao_id !== c.sessao_id) return erro("RODADA_NAO_ENCONTRADA");
    if (r.status !== "aberta") return erro("RODADA_FECHADA");
    if (membros.length === 0) return erro("ESCOLHA_OBRIGATORIA");
    if (membros.length > r.max_escolhas) return erro("ESCOLHAS_DEMAIS");
    if (new Set(membros).size !== membros.length) return erro("ESCOLHA_REPETIDA");
    const validos = r.tipo === "votacao"
      ? membros.every((m) => r.candidatos.includes(m))
      : membros.every((m) => db.membros.some((x) => x.id === m && x.sessao_id === c.sessao_id && x.ativo));
    if (!validos) return erro("CANDIDATO_INVALIDO");
    if (db.votou.some((v) => v.rodada_id === r.id && v.comissao_id === c.id)) return erro("JA_VOTOU");
    db.votou.push({ rodada_id: r.id, comissao_id: c.id, sessao_id: r.sessao_id });
    for (const m of membros) db.votos.push({ rodada_id: r.id, membro_id: m });
    gravar(db);
  },

  assinar(_sessaoId, aoMudar) {
    iniciarCanal();
    ouvintes.add(aoMudar);
    const aoArmazenar = (e: StorageEvent) => e.key === CHAVE && aoMudar();
    window.addEventListener("storage", aoArmazenar);
    setTimeout(aoMudar, 0);
    return () => {
      ouvintes.delete(aoMudar);
      window.removeEventListener("storage", aoArmazenar);
    };
  },

  async usuario() {
    return { email: "moderador@demonstracao", admin: true };
  },
  async entrarAdmin() {},
  async sairAdmin() {},

  async sessoes() {
    return [...ler().sessoes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async criarSessao(nome) {
    return mudar((db) => {
      const s: Sessao = { id: id(), nome, status: "preparando", cargo_atual_id: null, rodada_atual_id: null, limiar_aclamacao: 0.8, created_at: agora() };
      db.sessoes.push(s);
      const codigo = Math.random().toString(36).slice(2, 8).toUpperCase();
      db.codigos[s.id] = codigo;
      return { id: s.id, codigo };
    });
  },
  async atualizarSessao(sid, p) {
    mudar((db) => Object.assign(db.sessoes.find((s) => s.id === sid)!, p));
  },
  async codigo(sid) {
    return ler().codigos[sid];
  },

  async membros(sid) {
    return ler().membros.filter((m) => m.sessao_id === sid).sort(porNome);
  },
  async adicionarMembros(sid, linhas) {
    mudar((db) => linhas.forEach((l) => db.membros.push({ id: id(), sessao_id: sid, nome: l.nome, familia: l.familia, ativo: true })));
  },
  async atualizarMembro(mid, p) {
    mudar((db) => Object.assign(db.membros.find((m) => m.id === mid)!, p));
  },
  async removerMembros(ids) {
    mudar((db) => {
      const s = new Set(ids);
      db.membros = db.membros.filter((m) => !s.has(m.id));
      db.eleitos = db.eleitos.filter((e) => !s.has(e.membro_id));
      db.votos = db.votos.filter((v) => !s.has(v.membro_id));
    });
  },

  async comissao(sid) {
    return ler().comissao.filter((c) => c.sessao_id === sid).sort(porNome);
  },
  async adicionarComissao(sid, nomes) {
    mudar((db) => nomes.forEach((nome) => db.comissao.push({ id: id(), sessao_id: sid, nome, presente: false, entrou_em: null })));
  },
  async atualizarComissao(cid, p) {
    mudar((db) => Object.assign(db.comissao.find((c) => c.id === cid)!, p));
  },
  async removerComissao(cid) {
    mudar((db) => {
      db.comissao = db.comissao.filter((c) => c.id !== cid);
      delete db.tokens[cid];
      db.votou = db.votou.filter((v) => v.comissao_id !== cid);
    });
  },
  async liberarParticipante(cid, ausente) {
    mudar((db) => {
      delete db.tokens[cid];
      if (ausente) db.comissao.find((c) => c.id === cid)!.presente = false;
    });
  },

  async cargos(sid) {
    return ler().cargos.filter((c) => c.sessao_id === sid).sort((a, b) => a.ordem - b.ordem || porNome(a, b));
  },
  async adicionarCargos(sid, cargos) {
    mudar((db) => cargos.forEach((c) => db.cargos.push({ ...c, id: id(), sessao_id: sid, status: "pendente" })));
  },
  async atualizarCargo(cid, p) {
    mudar((db) => Object.assign(db.cargos.find((c) => c.id === cid)!, p));
  },
  async removerCargo(cid) {
    mudar((db) => {
      const rids = new Set(db.rodadas.filter((r) => r.cargo_id === cid).map((r) => r.id));
      db.cargos = db.cargos.filter((c) => c.id !== cid);
      db.rodadas = db.rodadas.filter((r) => !rids.has(r.id));
      db.eleitos = db.eleitos.filter((e) => e.cargo_id !== cid);
      for (const s of db.sessoes) {
        if (s.cargo_atual_id === cid) s.cargo_atual_id = null;
        if (s.rodada_atual_id && rids.has(s.rodada_atual_id)) s.rodada_atual_id = null;
      }
    });
  },

  async rodadas(cid) {
    return ler().rodadas.filter((r) => r.cargo_id === cid).sort((a, b) => a.numero - b.numero);
  },
  async eleitos(sid) {
    return ler().eleitos.filter((e) => e.sessao_id === sid);
  },
  async quemVotou(rid) {
    return ler().votou.filter((v) => v.rodada_id === rid).map((v) => v.comissao_id);
  },
  async abrirRodada(cargoId, tipo, turno, candidatos, maxEscolhas) {
    if (tipo === "votacao" && candidatos.length === 0) return erro("SEM_CANDIDATOS");
    return mudar((db) => {
      const cg = db.cargos.find((c) => c.id === cargoId)!;
      db.rodadas.filter((r) => r.sessao_id === cg.sessao_id && r.status === "aberta").forEach((r) => encerrar(db, r));
      const numero = Math.max(0, ...db.rodadas.filter((r) => r.cargo_id === cargoId).map((r) => r.numero)) + 1;
      const r: Rodada = {
        id: id(), sessao_id: cg.sessao_id, cargo_id: cargoId, numero, tipo, turno, status: "aberta",
        candidatos: tipo === "votacao" ? candidatos : [], max_escolhas: Math.max(1, maxEscolhas),
        presentes: db.comissao.filter((c) => c.sessao_id === cg.sessao_id && c.presente).length, created_at: agora(),
      };
      db.rodadas.push(r);
      if (cg.status === "pendente") cg.status = "em_andamento";
      const s = db.sessoes.find((x) => x.id === cg.sessao_id)!;
      s.cargo_atual_id = cargoId;
      s.rodada_atual_id = r.id;
      s.status = "aberta";
      return r.id;
    });
  },
  async encerrarRodada(rid) {
    mudar((db) => encerrar(db, db.rodadas.find((r) => r.id === rid)!));
  },
  async revelarRodada(rid) {
    mudar((db) => {
      const r = db.rodadas.find((x) => x.id === rid)!;
      encerrar(db, r);
      r.status = "revelada";
    });
  },
  async resultado(rid) {
    const db = ler();
    if (db.rodadas.find((r) => r.id === rid)?.status === "aberta") return erro("RODADA_ABERTA");
    const cont = new Map<string, number>();
    for (const v of db.votos.filter((v) => v.rodada_id === rid)) cont.set(v.membro_id, (cont.get(v.membro_id) ?? 0) + 1);
    return [...cont.entries()]
      .map(([mid, votos]): LinhaResultado => {
        const m = db.membros.find((x) => x.id === mid);
        return { membro_id: mid, nome: m?.nome ?? "?", familia: m?.familia ?? null, votos, eleito_para: eleitoPara(db, mid) };
      })
      .sort((a, b) => b.votos - a.votos || porNome(a, b));
  },
  async eleger(cargoId, membros, forma, concluir) {
    const db = ler();
    const cg = db.cargos.find((c) => c.id === cargoId);
    if (!cg) return erro("CARGO_NAO_ENCONTRADO");
    const novos = membros.filter((m) => !db.eleitos.some((e) => e.cargo_id === cargoId && e.membro_id === m));
    if (db.eleitos.filter((e) => e.cargo_id === cargoId).length + novos.length > cg.vagas) return erro("VAGAS_EXCEDIDAS");
    for (const m of novos) db.eleitos.push({ id: id(), sessao_id: cg.sessao_id, cargo_id: cargoId, membro_id: m, forma, created_at: agora() });
    if (concluir) cg.status = "concluido";
    gravar(db);
  },
  async removerEleito(cargoId, membroId) {
    mudar((db) => {
      db.eleitos = db.eleitos.filter((e) => !(e.cargo_id === cargoId && e.membro_id === membroId));
      db.cargos.find((c) => c.id === cargoId)!.status = "em_andamento";
    });
  },
  async concluirCargo(cargoId, concluido) {
    mudar((db) => {
      db.cargos.find((c) => c.id === cargoId)!.status = concluido ? "concluido" : "em_andamento";
    });
  },
  async reiniciarCargo(cargoId) {
    mudar((db) => {
      const rids = new Set(db.rodadas.filter((r) => r.cargo_id === cargoId).map((r) => r.id));
      db.rodadas = db.rodadas.filter((r) => !rids.has(r.id));
      db.votou = db.votou.filter((v) => !rids.has(v.rodada_id));
      db.votos = db.votos.filter((v) => !rids.has(v.rodada_id));
      db.eleitos = db.eleitos.filter((e) => e.cargo_id !== cargoId);
      db.cargos.find((c) => c.id === cargoId)!.status = "pendente";
      for (const s of db.sessoes) if (s.rodada_atual_id && rids.has(s.rodada_atual_id)) s.rodada_atual_id = null;
    });
  },
  async selecionarCargo(cargoId) {
    mudar((db) => {
      const cg = db.cargos.find((c) => c.id === cargoId)!;
      const ultima = db.rodadas.filter((r) => r.cargo_id === cargoId).sort((a, b) => b.numero - a.numero)[0];
      const s = db.sessoes.find((x) => x.id === cg.sessao_id)!;
      s.cargo_atual_id = cargoId;
      s.rodada_atual_id = ultima?.id ?? null;
    });
  },

  // ----- Extras da demonstração -----
  async simularEntradas(sid) {
    mudar((db) => {
      for (const c of db.comissao.filter((x) => x.sessao_id === sid)) {
        c.presente = true;
        c.entrou_em ??= agora();
      }
    });
  },
  async simularVotos(rid) {
    mudar((db) => {
      const r = db.rodadas.find((x) => x.id === rid);
      if (!r || r.status !== "aberta") return;
      const membrosAtivos = db.membros.filter((m) => m.sessao_id === r.sessao_id && m.ativo);
      const opcoes = r.tipo === "votacao" ? r.candidatos : membrosAtivos.map((m) => m.id);
      // Favoritos fixos por rodada para o resultado parecer real.
      const semente = [...r.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
      const favoritos = opcoes.length ? [opcoes[semente % opcoes.length], opcoes[(semente * 7) % opcoes.length], opcoes[(semente * 13) % opcoes.length]] : [];
      const presentes = db.comissao.filter((c) => c.sessao_id === r.sessao_id && c.presente);
      for (const c of presentes) {
        if (db.votou.some((v) => v.rodada_id === r.id && v.comissao_id === c.id)) continue;
        const escolhas = new Set<string>();
        const quantos = r.tipo === "indicacao" ? Math.min(r.max_escolhas, opcoes.length) : Math.min(r.max_escolhas, opcoes.length);
        while (escolhas.size < quantos) {
          const p = Math.random();
          const pick = p < 0.55 && favoritos[0] ? favoritos[escolhas.size % favoritos.length] : opcoes[Math.floor(Math.random() * opcoes.length)];
          escolhas.add(escolhas.has(pick) ? opcoes[Math.floor(Math.random() * opcoes.length)] : pick);
        }
        db.votou.push({ rodada_id: r.id, comissao_id: c.id, sessao_id: r.sessao_id });
        for (const m of escolhas) db.votos.push({ rodada_id: r.id, membro_id: m });
      }
    });
  },
  async reiniciarDemo() {
    gravar(semente());
  },
};
