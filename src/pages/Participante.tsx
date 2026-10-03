import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Loader2, Search, X } from "lucide-react";
import { api, emDemo } from "@/lib/backend";
import { mensagemErro } from "@/lib/api";
import { useEstado } from "@/lib/useEstado";
import type { Estado, MembroLista, Sala } from "@/lib/types";
import { FaixaDemo, Marca } from "@/components/Marca";

const CHAVE_TOKEN = "nomeacoes-token";

interface Guardado { codigo: string; token: string; nome: string }

function lerGuardado(): Guardado | null {
  try {
    const b = localStorage.getItem(CHAVE_TOKEN);
    return b ? (JSON.parse(b) as Guardado) : null;
  } catch {
    return null;
  }
}
function guardar(g: Guardado | null) {
  try {
    if (g) localStorage.setItem(CHAVE_TOKEN, JSON.stringify(g));
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* sem armazenamento: o acesso dura só esta aba */
  }
}

export default function Participante() {
  const codigoUrl = new URLSearchParams(window.location.search).get("c")?.toUpperCase() ?? "";
  const [guardado, setGuardado] = useState<Guardado | null>(() => {
    const g = lerGuardado();
    return g && (!codigoUrl || g.codigo === codigoUrl) ? g : null;
  });

  const sair = () => {
    guardar(null);
    setGuardado(null);
  };

  return (
    <div className="min-h-dvh bg-papel">
      <FaixaDemo />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-6">
        {guardado ? (
          <Votacao guardado={guardado} aoSair={sair} />
        ) : (
          <Entrada
            codigoInicial={codigoUrl || (emDemo ? "DEMO26" : "")}
            aoEntrar={(g) => {
              guardar(g);
              setGuardado(g);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Entrada

function Entrada({ codigoInicial, aoEntrar }: { codigoInicial: string; aoEntrar: (g: Guardado) => void }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [sala, setSala] = useState<Sala | null>(null);
  const [escolhido, setEscolhido] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const buscarSala = async (c = codigo) => {
    if (c.trim().length < 4) return;
    setCarregando(true);
    setErro(null);
    try {
      setSala(await api.sala(c));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (codigoInicial) void buscarSala(codigoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = async () => {
    if (!escolhido) return;
    setCarregando(true);
    setErro(null);
    try {
      const e = await api.entrar(codigo, escolhido.id, null);
      aoEntrar({ codigo: codigo.trim().toUpperCase(), token: e.token, nome: e.nome });
    } catch (e) {
      setErro(mensagemErro(e));
      setEscolhido(null);
      void buscarSala();
    } finally {
      setCarregando(false);
    }
  };

  if (!sala) {
    return (
      <div className="flex flex-1 flex-col">
        <Marca />
        <h1 className="mt-10 font-serif text-4xl font-semibold leading-tight">Comissão de Nomeações</h1>
        <p className="mt-3 text-lg text-navy/70">Digite o código que aparece no telão.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void buscarSala();
          }}
        >
          <input
            className="campo text-center font-serif text-3xl tracking-[0.3em] uppercase"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="CÓDIGO"
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-label="Código da sala"
          />
          {erro && <Aviso>{erro}</Aviso>}
          <button className="btn-primario w-full py-4 text-lg" disabled={carregando || codigo.length < 4}>
            {carregando ? <Loader2 className="animate-spin" /> : "Continuar"}
          </button>
        </form>
      </div>
    );
  }

  if (escolhido) {
    return (
      <div className="flex flex-1 flex-col">
        <button className="flex items-center gap-1 self-start text-navy/60" onClick={() => setEscolhido(null)}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <div className="mt-16 text-center">
          <p className="text-lg text-navy/70">Você é</p>
          <p className="mt-2 font-serif text-4xl font-semibold">{escolhido.nome}?</p>
          <p className="mx-auto mt-6 max-w-xs text-navy/60">
            Seu nome fica ligado a este celular. Seus votos são secretos: ninguém vê em quem você votou.
          </p>
        </div>
        {erro && <div className="mt-6"><Aviso>{erro}</Aviso></div>}
        <button className="btn-primario mt-auto w-full py-4 text-lg" onClick={confirmar} disabled={carregando}>
          {carregando ? <Loader2 className="animate-spin" /> : "Sim, sou eu"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <button className="flex items-center gap-1 self-start text-navy/60" onClick={() => setSala(null)}>
        <ChevronLeft size={18} /> Trocar código
      </button>
      <p className="rotulo mt-6 text-navy/50">{sala.nome}</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Toque no seu nome</h1>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      <ul className="mt-6 space-y-2">
        {sala.comissao.map((c) => (
          <li key={c.id}>
            <button
              className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-4 text-left text-lg ring-1 ring-papel-300 transition hover:ring-navy disabled:bg-papel-200 disabled:text-navy/40"
              disabled={c.ocupado}
              onClick={() => setEscolhido(c)}
            >
              <span>{c.nome}</span>
              {c.ocupado && <span className="text-sm">já entrou</span>}
            </button>
          </li>
        ))}
      </ul>
      {sala.comissao.length === 0 && <p className="mt-6 text-navy/60">A comissão ainda não foi cadastrada.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Votação

function Votacao({ guardado, aoSair }: { guardado: Guardado; aoSair: () => void }) {
  const { estado, erro } = useEstado({ token: guardado.token });

  useEffect(() => {
    if (erro && /expirou|acesso/i.test(erro)) aoSair();
  }, [erro, aoSair]);

  if (!estado) {
    return (
      <div className="flex flex-1 items-center justify-center text-navy/60">
        {erro ? <Aviso>{erro}</Aviso> : <Loader2 className="animate-spin" />}
      </div>
    );
  }

  const cargo = estado.cargos.find((c) => c.id === estado.sessao.cargo_atual_id);
  const r = estado.rodada;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <Marca />
        <span className="max-w-[50%] truncate text-sm text-navy/60">{estado.eu?.nome ?? guardado.nome}</span>
      </header>

      {estado.sessao.status === "encerrada" ? (
        <Mensagem titulo="Reunião encerrada" texto="Obrigado por servir na comissão. Que Deus abençoe a nova liderança." />
      ) : !estado.eu?.presente ? (
        <Mensagem titulo="Você está como ausente" texto="Fale com o moderador para voltar à votação." />
      ) : !cargo || !r || r.cargo_id !== cargo.id ? (
        <Mensagem titulo="Aguarde" texto={cargo ? `Próximo: ${cargo.nome}` : "O moderador vai abrir a primeira rodada."} pulsar />
      ) : r.status !== "aberta" ? (
        <Mensagem titulo={cargo.nome} texto={r.status === "revelada" ? "Resultado no telão." : "Rodada encerrada. Aguardando apuração."} />
      ) : estado.eu.ja_votou ? (
        <Registrado estado={estado} />
      ) : r.tipo === "indicacao" ? (
        <Indicar key={r.id} estado={estado} token={guardado.token} />
      ) : (
        <Votar key={r.id} estado={estado} token={guardado.token} />
      )}
    </div>
  );
}

function Cabecalho({ estado }: { estado: Estado }) {
  const r = estado.rodada!;
  const cargo = estado.cargos.find((c) => c.id === r.cargo_id)!;
  const etapa = r.tipo === "indicacao" ? "Indicação" : r.turno > 1 ? "Votação · 2º turno" : "Votação";
  return (
    <div className="mt-8">
      <span className="rotulo inline-block rounded-full px-3 py-1 text-white" style={{ background: cargo.cor }}>{etapa}</span>
      <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight">{cargo.nome}</h1>
      <p className="mt-2 text-navy/70">
        {r.max_escolhas > 1 ? `Escolha até ${r.max_escolhas} nomes.` : "Escolha 1 nome."}
      </p>
    </div>
  );
}

function SeloEleito({ cargos }: { cargos: string[] }) {
  if (!cargos.length) return null;
  return <span className="selo-aviso">Já eleito(a): {cargos.join(", ")}</span>;
}

function Indicar({ estado, token }: { estado: Estado; token: string }) {
  const r = estado.rodada!;
  const [membros, setMembros] = useState<MembroLista[] | null>(null);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<MembroLista[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    api.listaMembros(token).then(setMembros).catch(() => setMembros([]));
  }, [token]);

  const filtrados = useMemo(() => {
    if (!membros) return [];
    const q = normalizar(busca);
    if (q.length < 2) return [];
    return membros.filter((m) => normalizar(m.nome).includes(q)).slice(0, 30);
  }, [membros, busca]);

  const alternar = (m: MembroLista) => {
    setEscolhidos((atual) => {
      if (atual.some((x) => x.id === m.id)) return atual.filter((x) => x.id !== m.id);
      if (r.max_escolhas === 1) return [m];
      if (atual.length >= r.max_escolhas) return atual;
      return [...atual, m];
    });
    if (r.max_escolhas === 1) setBusca("");
  };

  return (
    <div className="flex flex-1 flex-col">
      <Cabecalho estado={estado} />

      {escolhidos.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {escolhidos.map((m) => (
            <button key={m.id} onClick={() => alternar(m)} className="inline-flex items-center gap-1.5 rounded-full bg-navy py-1.5 pl-3 pr-2 text-papel">
              {m.nome} <X size={16} aria-label="remover" />
            </button>
          ))}
        </div>
      )}

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-navy/40" size={20} />
        <input
          className="campo pl-11"
          placeholder={membros ? "Digite o nome…" : "Carregando lista…"}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          disabled={!membros}
          autoComplete="off"
        />
      </div>

      <ul className="mt-3 space-y-2">
        {filtrados.map((m) => {
          const sel = escolhidos.some((x) => x.id === m.id);
          const cheio = !sel && r.max_escolhas > 1 && escolhidos.length >= r.max_escolhas;
          return (
            <li key={m.id}>
              <button
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 transition ${sel ? "bg-navy text-papel ring-navy" : "bg-white ring-papel-300"} disabled:opacity-40`}
                onClick={() => alternar(m)}
                disabled={cheio}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${sel ? "border-ouro bg-ouro text-navy" : "border-papel-300"}`}>
                  {sel && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg">{m.nome}</span>
                  <SeloEleito cargos={m.eleito_para} />
                </span>
              </button>
            </li>
          );
        })}
        {busca.length >= 2 && membros && filtrados.length === 0 && (
          <li className="px-1 py-3 text-navy/60">Nenhum membro com esse nome.</li>
        )}
      </ul>

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-papel via-papel to-transparent pt-6">
        <button className="btn-primario w-full py-4 text-lg" disabled={!escolhidos.length} onClick={() => setConfirmando(true)}>
          {escolhidos.length ? `Indicar (${escolhidos.length}${r.max_escolhas > 1 ? ` de ${r.max_escolhas}` : ""})` : "Escolha um nome"}
        </button>
      </div>

      {confirmando && (
        <Confirmar
          titulo="Confirmar indicação?"
          nomes={escolhidos.map((m) => m.nome)}
          token={token}
          rodadaId={r.id}
          ids={escolhidos.map((m) => m.id)}
          aoFechar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

function Votar({ estado, token }: { estado: Estado; token: string }) {
  const r = estado.rodada!;
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const alternar = (id: string) =>
    setEscolhidos((a) =>
      a.includes(id) ? a.filter((x) => x !== id) : r.max_escolhas === 1 ? [id] : a.length >= r.max_escolhas ? a : [...a, id],
    );

  return (
    <div className="flex flex-1 flex-col">
      <Cabecalho estado={estado} />
      <ul className="mt-6 space-y-2">
        {r.candidatos.map((c) => {
          const sel = escolhidos.includes(c.id);
          return (
            <li key={c.id}>
              <button
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left ring-1 transition ${sel ? "bg-navy text-papel ring-navy" : "bg-white ring-papel-300"}`}
                onClick={() => alternar(c.id)}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${sel ? "border-ouro bg-ouro text-navy" : "border-papel-300"}`}>
                  {sel && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-xl">{c.nome}</span>
                  <SeloEleito cargos={c.eleito_para} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-papel via-papel to-transparent pt-6">
        <button className="btn-primario w-full py-4 text-lg" disabled={!escolhidos.length} onClick={() => setConfirmando(true)}>
          {escolhidos.length ? `Votar${r.max_escolhas > 1 ? ` (${escolhidos.length} de ${r.max_escolhas})` : ""}` : "Escolha um nome"}
        </button>
      </div>
      {confirmando && (
        <Confirmar
          titulo="Confirmar voto?"
          nomes={r.candidatos.filter((c) => escolhidos.includes(c.id)).map((c) => c.nome)}
          token={token}
          rodadaId={r.id}
          ids={escolhidos}
          aoFechar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

function Confirmar(p: { titulo: string; nomes: string[]; token: string; rodadaId: string; ids: string[]; aoFechar: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.votar(p.token, p.rodadaId, p.ids);
      // o estado ao vivo troca a tela para "registrado"
    } catch (e) {
      setErro(mensagemErro(e));
      setEnviando(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-navy-950/50 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="animar-entrada w-full max-w-md rounded-3xl bg-white p-6">
        <h2 className="font-serif text-2xl font-semibold">{p.titulo}</h2>
        <ul className="mt-4 space-y-1 text-lg">
          {p.nomes.map((n) => (
            <li key={n} className="flex items-center gap-2"><Check size={18} className="text-ouro-600" /> {n}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-navy/60">Depois de enviar não dá para mudar.</p>
        {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn-claro py-3.5" onClick={p.aoFechar} disabled={enviando}>Voltar</button>
          <button className="btn-primario py-3.5" onClick={enviar} disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" /> : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Registrado({ estado }: { estado: Estado }) {
  const r = estado.rodada!;
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="animar-entrada grid h-24 w-24 place-items-center rounded-full bg-navy text-ouro">
        <Check size={48} strokeWidth={3} />
      </div>
      <h1 className="mt-6 font-serif text-3xl font-semibold">{r.tipo === "indicacao" ? "Indicação registrada" : "Voto registrado"}</h1>
      <p className="mt-2 text-lg text-navy/70">Aguarde os demais.</p>
      <p className="mt-8 font-serif text-5xl font-semibold tabular-nums">
        {r.votaram}<span className="text-navy/40">/{r.presentes}</span>
      </p>
      <p className="text-sm text-navy/60">já {r.tipo === "indicacao" ? "indicaram" : "votaram"}</p>
    </div>
  );
}

function Mensagem({ titulo, texto, pulsar }: { titulo: string; texto: string; pulsar?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className={`font-serif text-4xl font-semibold ${pulsar ? "pulsar" : ""}`}>{titulo}</h1>
      <p className="mt-3 text-lg text-navy/70">{texto}</p>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200">{children}</p>;
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
