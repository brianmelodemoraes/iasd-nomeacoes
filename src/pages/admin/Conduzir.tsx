import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Circle, CircleDot, Eye, Loader2, Play, RotateCcw, Square, Tv, UserPlus, Wand2, X } from "lucide-react";
import { api, emDemo } from "@/lib/backend";
import { mensagemErro } from "@/lib/api";
import { demoApi } from "@/lib/demoApi";
import { apurarIndicacao, apurarVotacao, type Contagem, type Pulado } from "@/lib/regras";
import type { Cargo, Estado, LinhaResultado, Membro, Rodada, Sessao } from "@/lib/types";
import type { DadosAdmin } from "./useAdmin";

export function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const executar = async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, erro, setErro, executar };
}

export function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200">{texto}</p>;
}

export function Conduzir({ sessao, dados, estado }: { sessao: Sessao; dados: DadosAdmin; estado: Estado | null }) {
  const { cargos } = dados;
  const [cargoId, setCargoId] = useState<string | null>(null);

  useEffect(() => {
    if (cargoId && cargos.some((c) => c.id === cargoId)) return;
    const inicial = estado?.sessao.cargo_atual_id ?? cargos.find((c) => c.status !== "concluido")?.id ?? cargos[0]?.id ?? null;
    setCargoId(inicial);
  }, [cargos, cargoId, estado?.sessao.cargo_atual_id]);

  const cargo = cargos.find((c) => c.id === cargoId) ?? null;

  if (!cargos.length) {
    return <p className="cartao p-8 text-navy/70">Cadastre os cargos na aba <b>Cargos</b> para começar.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <nav className="cartao max-h-[75vh] overflow-y-auto p-2">
        {cargos.map((c) => {
          const n = dados.eleitos.filter((e) => e.cargo_id === c.id).length;
          const noTelao = estado?.sessao.cargo_atual_id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCargoId(c.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${c.id === cargoId ? "bg-navy text-papel" : "hover:bg-papel-200"}`}
            >
              {c.status === "concluido" ? (
                <Check size={16} className="shrink-0 text-emerald-600" />
              ) : c.status === "em_andamento" ? (
                <CircleDot size={16} className="shrink-0 text-ouro-600" />
              ) : (
                <Circle size={16} className="shrink-0 opacity-30" />
              )}
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
              <span className="flex-1 truncate">{c.nome}</span>
              {c.vagas > 1 && <span className="text-xs opacity-60">{n}/{c.vagas}</span>}
              {noTelao && <Tv size={14} className="shrink-0 opacity-70" aria-label="no telão" />}
            </button>
          );
        })}
      </nav>
      {cargo && (
        <PainelCargo
          key={cargo.id}
          sessao={sessao}
          cargo={cargo}
          dados={dados}
          estado={estado}
          aoProximo={(id) => setCargoId(id)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------

function PainelCargo(p: { sessao: Sessao; cargo: Cargo; dados: DadosAdmin; estado: Estado | null; aoProximo: (id: string) => void }) {
  const { cargo, dados, estado } = p;
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const acao = useAcao();

  useEffect(() => {
    api.rodadas(cargo.id).then(setRodadas).catch((e) => acao.setErro(mensagemErro(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargo.id, dados.versao]);

  const membroPorId = useMemo(() => new Map(dados.membros.map((m) => [m.id, m])), [dados.membros]);
  const eleitosCargo = dados.eleitos.filter((e) => e.cargo_id === cargo.id);
  const vagasAbertas = cargo.vagas - eleitosCargo.length;
  const ultima = rodadas?.[rodadas.length - 1] ?? null;
  const noTelao = estado?.sessao.cargo_atual_id === cargo.id;

  const proximoCargo = () => {
    const i = dados.cargos.findIndex((c) => c.id === cargo.id);
    const prox = [...dados.cargos.slice(i + 1), ...dados.cargos.slice(0, i)].find((c) => c.status !== "concluido");
    if (!prox) return;
    p.aoProximo(prox.id);
    void acao.executar(() => api.selecionarCargo(prox.id));
  };

  const abrirIndicacao = () =>
    acao.executar(() => api.abrirRodada(cargo.id, "indicacao", 1, [], Math.max(1, Math.min(cargo.max_indicacoes, vagasAbertas))));

  return (
    <section className="space-y-5">
      <header className="cartao overflow-hidden">
        <div className="h-1.5" style={{ background: cargo.cor }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <p className="rotulo text-navy/50">
              {cargo.vagas > 1 ? `${cargo.vagas} vagas · até ${cargo.max_indicacoes} indicações por pessoa` : "1 vaga"}
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">{cargo.nome}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {!noTelao && (
              <button className="btn-claro" onClick={() => acao.executar(() => api.selecionarCargo(cargo.id))} disabled={acao.ocupado}>
                <Tv size={18} /> Mostrar no telão
              </button>
            )}
          </div>
        </div>
        {eleitosCargo.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-papel-300 px-5 py-3">
            <span className="rotulo self-center text-navy/50">Eleitos</span>
            {eleitosCargo.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-ouro/20 py-1 pl-3 pr-1.5 text-sm font-medium">
                {membroPorId.get(e.membro_id)?.nome ?? "?"}
                <span className="text-xs text-navy/50">{e.forma === "aclamacao" ? "80%" : e.forma}</span>
                <button
                  className="rounded-full p-0.5 hover:bg-white"
                  title="Remover eleito"
                  onClick={() => {
                    if (confirm(`Remover ${membroPorId.get(e.membro_id)?.nome} deste cargo?`)) {
                      void acao.executar(() => api.removerEleito(cargo.id, e.membro_id));
                    }
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </header>

      <Erro texto={acao.erro} />

      {rodadas === null ? (
        <div className="cartao grid place-items-center p-10"><Loader2 className="animate-spin" /></div>
      ) : cargo.status === "concluido" ? (
        <div className="cartao flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-serif text-2xl font-semibold">Cargo concluído</p>
            <p className="text-navy/60">O telão está mostrando a celebração.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-claro" onClick={() => acao.executar(() => api.concluirCargo(cargo.id, false))}>Reabrir</button>
            <button className="btn-primario" onClick={proximoCargo} disabled={acao.ocupado}>
              Próximo cargo <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : !ultima ? (
        <DefinirVagas
          key={cargo.id}
          cargo={cargo}
          presentes={estado?.presentes ?? 0}
          ocupado={acao.ocupado}
          aoAbrir={(vagas, max) =>
            acao.executar(async () => {
              if (vagas !== cargo.vagas || max !== cargo.max_indicacoes) {
                await api.atualizarCargo(cargo.id, { vagas, max_indicacoes: max });
              }
              await api.abrirRodada(cargo.id, "indicacao", 1, [], Math.max(1, Math.min(max, vagas - eleitosCargo.length)));
            })
          }
        />
      ) : ultima.status === "aberta" ? (
        <RodadaAberta rodada={ultima} cargo={cargo} dados={dados} estado={estado} />
      ) : (
        <Apuracao
          key={ultima.id + ultima.status}
          rodada={ultima}
          cargo={cargo}
          dados={dados}
          membroPorId={membroPorId}
          limiar={p.sessao.limiar_aclamacao}
          aoNovaIndicacao={abrirIndicacao}
          aoProximoCargo={proximoCargo}
        />
      )}

      {rodadas && rodadas.length > 1 && (
        <p className="text-sm text-navy/50">
          Rodadas deste cargo:{" "}
          {rodadas.map((r) => `${r.numero}ª ${r.tipo === "indicacao" ? "indicação" : r.turno > 1 ? "2º turno" : "votação"}`).join(" → ")}
        </p>
      )}

      <OpcoesAvancadas cargo={cargo} dados={dados} vagasAbertas={vagasAbertas} />
    </section>
  );
}

// -------------------------------------------------------------------------------------------

/** Antes da 1ª rodada: confirma (ou define na hora) quantas vagas o cargo terá. */
function DefinirVagas(p: { cargo: Cargo; presentes: number; ocupado: boolean; aoAbrir: (vagas: number, max: number) => void }) {
  const { cargo } = p;
  const [vagas, setVagas] = useState(cargo.vagas);
  const [max, setMax] = useState(cargo.max_indicacoes);
  // Indicações por pessoa acompanham as vagas até o moderador mudar à mão.
  const [maxLigado, setMaxLigado] = useState(cargo.max_indicacoes === cargo.vagas);
  const varias = vagas > 1;
  const valido = vagas >= 1 && max >= 1 && max <= vagas;

  const mudarVagas = (v: number) => {
    const n = Math.max(1, Math.min(99, Math.floor(v) || 1));
    setVagas(n);
    if (maxLigado) setMax(n);
    else if (max > n) setMax(n);
  };

  return (
    <div className={`cartao p-6 ${varias ? "border-l-4 border-ouro" : ""}`}>
      <p className="font-serif text-2xl font-semibold">Pronto para começar</p>
      <p className="text-navy/60">{p.presentes} presentes na comissão.</p>
      <div className="mt-5 flex flex-wrap items-end gap-5">
        <label className="block">
          <span className="rotulo text-navy/60">Quantas vagas?</span>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className="btn-claro h-12 w-12 p-0 text-xl" onClick={() => mudarVagas(vagas - 1)} aria-label="Menos uma vaga">−</button>
            <input
              type="number"
              min={1}
              className="campo h-12 w-24 text-center font-serif text-2xl font-semibold"
              value={vagas}
              onChange={(e) => mudarVagas(+e.target.value)}
            />
            <button type="button" className="btn-claro h-12 w-12 p-0 text-xl" onClick={() => mudarVagas(vagas + 1)} aria-label="Mais uma vaga">+</button>
          </div>
        </label>
        {varias && (
          <label className="block">
            <span className="rotulo text-navy/60">Cada membro indica até</span>
            <input
              type="number"
              min={1}
              max={vagas}
              className="campo mt-1 block h-12 w-24 text-center font-serif text-2xl font-semibold"
              value={max}
              onChange={(e) => {
                setMaxLigado(false);
                setMax(Math.max(1, Math.min(vagas, Math.floor(+e.target.value) || 1)));
              }}
            />
          </label>
        )}
        <button className="btn-primario ml-auto px-6 py-3 text-lg" onClick={() => p.aoAbrir(vagas, max)} disabled={p.ocupado || !valido}>
          <Play size={20} /> Abrir indicação{varias ? ` · ${vagas} vagas` : ""}
        </button>
      </div>
      {varias && (
        <p className="mt-3 text-sm text-navy/60">
          Quem tiver 80% dos presentes entra direto; as vagas restantes vão para votação.
        </p>
      )}
    </div>
  );
}

function RodadaAberta({ rodada, cargo, dados, estado }: { rodada: Rodada; cargo: Cargo; dados: DadosAdmin; estado: Estado | null }) {
  const [votaram, setVotaram] = useState<string[]>([]);
  const acao = useAcao();
  const ao = estado?.rodada?.id === rodada.id ? estado.rodada : null;

  useEffect(() => {
    api.quemVotou(rodada.id).then(setVotaram).catch(() => undefined);
  }, [rodada.id, dados.versao, ao?.votaram]);

  const presentes = dados.comissao.filter((c) => c.presente);
  const faltam = presentes.filter((c) => !votaram.includes(c.id));
  const total = ao?.presentes ?? presentes.length;
  const feitos = ao?.votaram ?? votaram.length;
  const nomeEtapa = rodada.tipo === "indicacao" ? "Indicação" : rodada.turno > 1 ? "2º turno" : "Votação";

  return (
    <div className="cartao p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="rotulo text-navy/50">{nomeEtapa} aberta · rodada {rodada.numero}</p>
          <p className="mt-1 font-serif text-5xl font-semibold tabular-nums">
            {feitos}<span className="text-navy/30">/{total}</span>
          </p>
          <p className="text-navy/60">{rodada.tipo === "indicacao" ? "indicaram" : "votaram"} · contagem fica oculta até encerrar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {emDemo && (
            <button className="btn-claro" onClick={() => acao.executar(() => demoApi.simularVotos(rodada.id))} disabled={acao.ocupado}>
              <Wand2 size={18} /> Simular votos
            </button>
          )}
          <button
            className="btn-primario px-6 py-3 text-lg"
            disabled={acao.ocupado}
            onClick={() => {
              if (faltam.length && !confirm(`${faltam.length} pessoa(s) ainda não ${rodada.tipo === "indicacao" ? "indicaram" : "votaram"}. Encerrar mesmo assim?`)) return;
              void acao.executar(() => api.encerrarRodada(rodada.id));
            }}
          >
            <Square size={18} /> Encerrar rodada
          </button>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-papel-200">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${total ? (feitos / total) * 100 : 0}%`, background: cargo.cor }} />
      </div>
      {rodada.tipo === "votacao" && (
        <p className="mt-4 text-sm text-navy/70">
          Na cédula: {rodada.candidatos.map((id) => dados.membros.find((m) => m.id === id)?.nome ?? "?").join(" · ")}
          {" "}· cada um escolhe até {rodada.max_escolhas}
        </p>
      )}
      {faltam.length > 0 && (
        <div className="mt-4">
          <p className="rotulo text-navy/50">Faltam</p>
          <p className="mt-1 text-sm text-navy/80">{faltam.map((c) => c.nome).join(" · ")}</p>
        </div>
      )}
      <div className="mt-2"><Erro texto={acao.erro} /></div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------

type Etiqueta = { texto: string; tom: "ouro" | "verde" | "cinza" | "ambar" };

function Apuracao(p: {
  rodada: Rodada;
  cargo: Cargo;
  dados: DadosAdmin;
  membroPorId: Map<string, Membro>;
  limiar: number;
  aoNovaIndicacao: () => void;
  aoProximoCargo: () => void;
}) {
  const { rodada, cargo, dados, membroPorId } = p;
  const [resultado, setResultado] = useState<LinhaResultado[] | null>(null);
  const acao = useAcao();

  useEffect(() => {
    api.resultado(rodada.id).then(setResultado).catch((e) => acao.setErro(mensagemErro(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada.id]);

  const eleitosCargo = dados.eleitos.filter((e) => e.cargo_id === cargo.id);
  // Eleitos antes desta rodada são a base da apuração; os depois vieram dela.
  const antes = eleitosCargo.filter((e) => e.created_at < rodada.created_at);
  const daRodada = eleitosCargo.filter((e) => e.created_at >= rodada.created_at);
  const vagasNaRodada = cargo.vagas - antes.length;
  const vagasAgora = cargo.vagas - eleitosCargo.length;

  const ap = useMemo(() => {
    if (!resultado) return null;
    const contagens: Contagem[] = resultado.map((r) => ({ membroId: r.membro_id, nome: r.nome, familia: r.familia, votos: r.votos }));
    if (rodada.tipo === "votacao") {
      for (const id of rodada.candidatos) {
        if (!contagens.some((c) => c.membroId === id)) {
          const m = membroPorId.get(id);
          contagens.push({ membroId: id, nome: m?.nome ?? "?", familia: m?.familia ?? null, votos: 0 });
        }
      }
    }
    const ctx = {
      presentes: rodada.presentes,
      vagasRestantes: vagasNaRodada,
      familiasOcupadas: antes.map((e) => membroPorId.get(e.membro_id)?.familia ?? null),
      limiar: p.limiar,
    };
    if (rodada.tipo === "indicacao") {
      const r = apurarIndicacao(contagens, ctx);
      return { contagens, sugeridos: r.eleitos, pulados: r.pulados, proximos: r.candidatosVotacao, minimo: r.minimoAclamacao, empate: false };
    }
    const r = apurarVotacao(contagens, ctx, rodada.turno);
    return { contagens, sugeridos: r.eleitos, pulados: r.pulados, proximos: r.proximoTurno, minimo: r.minimo, empate: r.empate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, rodada, vagasNaRodada, membroPorId, p.limiar]);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (ap) setSelecionados(new Set(ap.proximos.map((c) => c.membroId)));
  }, [ap]);

  if (!resultado || !ap) {
    return (
      <div className="cartao grid place-items-center p-10">
        {acao.erro ? <Erro texto={acao.erro} /> : <Loader2 className="animate-spin" />}
      </div>
    );
  }

  const aplicado = daRodada.length > 0 || ap.sugeridos.length === 0;
  const forma = rodada.tipo === "indicacao" ? "aclamacao" : "votacao";
  const sugeridosIds = new Set(ap.sugeridos.map((s) => s.membroId));
  const proximosIds = new Set(ap.proximos.map((s) => s.membroId));
  const puladoPor = new Map<string, Pulado>(ap.pulados.map((x) => [x.contagem.membroId, x]));
  const eleitosIds = new Set(eleitosCargo.map((e) => e.membro_id));
  const nomeProxima =
    rodada.tipo === "indicacao" ? "votação" : ap.empate ? "desempate" : "2º turno";
  const turnoProximo = rodada.tipo === "indicacao" ? 1 : 2;

  const etiquetas = (c: Contagem): Etiqueta[] => {
    const l: Etiqueta[] = [];
    if (eleitosIds.has(c.membroId)) l.push({ texto: "eleito", tom: "verde" });
    else if (sugeridosIds.has(c.membroId)) l.push({ texto: rodada.tipo === "indicacao" ? "≥ 80% · eleito" : "eleito", tom: "ouro" });
    const pulado = puladoPor.get(c.membroId);
    if (pulado) l.push({ texto: `mesma família de ${pulado.por}`, tom: "ambar" });
    if (proximosIds.has(c.membroId) && vagasAgora > 0) l.push({ texto: `vai para ${nomeProxima}`, tom: "cinza" });
    const outros = resultado.find((r) => r.membro_id === c.membroId)?.eleito_para.filter((n) => n !== cargo.nome) ?? [];
    if (outros.length) l.push({ texto: `já eleito: ${outros.join(", ")}`, tom: "ambar" });
    return l;
  };

  const linhas = [...ap.contagens].sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="space-y-5">
      <div className="cartao overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-papel-300 px-5 py-4">
          <div>
            <p className="rotulo text-navy/50">
              Resultado · {rodada.tipo === "indicacao" ? "indicação" : rodada.turno > 1 ? "2º turno" : "votação"} · rodada {rodada.numero}
            </p>
            <p className="text-sm text-navy/70">
              {rodada.presentes} presentes ·{" "}
              {rodada.tipo === "indicacao"
                ? `${ap.minimo} votos = ${Math.round(p.limiar * 100)}% (entra direto)`
                : rodada.turno <= 1
                  ? `${ap.minimo} votos = maioria`
                  : "mais votado vence"}
            </p>
          </div>
          {rodada.status === "encerrada" ? (
            <button className="btn-ouro" onClick={() => acao.executar(() => api.revelarRodada(rodada.id))} disabled={acao.ocupado}>
              <Eye size={18} /> Revelar no telão
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-navy/60"><Tv size={16} /> revelado no telão</span>
          )}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {linhas.map((c) => (
              <tr key={c.membroId} className="border-b border-papel-200 last:border-0">
                <td className="px-5 py-2.5">
                  <span className="font-medium">{c.nome}</span>
                  {c.familia && <span className="ml-2 text-xs text-navy/40">fam. {c.familia}</span>}
                </td>
                <td className="w-[38%] px-2">
                  <div className="h-2.5 rounded-r bg-papel-200">
                    <div className="h-full rounded-r" style={{ width: `${(c.votos / Math.max(1, rodada.presentes)) * 100}%`, background: sugeridosIds.has(c.membroId) || eleitosIds.has(c.membroId) ? "#C9A44C" : cargo.cor }} />
                  </div>
                </td>
                <td className="w-24 px-2 text-right tabular-nums">
                  <b>{c.votos}</b> <span className="text-navy/40">{Math.round((c.votos / Math.max(1, rodada.presentes)) * 100)}%</span>
                </td>
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    {etiquetas(c).map((e) => (
                      <span
                        key={e.texto}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          { ouro: "bg-ouro/25 text-navy", verde: "bg-emerald-100 text-emerald-900", cinza: "bg-papel-200 text-navy/70", ambar: "bg-amber-100 text-amber-900" }[e.tom]
                        }`}
                      >
                        {e.texto}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td className="px-5 py-6 text-navy/60">Nenhum voto nesta rodada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Erro texto={acao.erro} />

      {/* Passo 1: confirmar eleitos */}
      {!aplicado && (
        <div className="cartao flex flex-wrap items-center justify-between gap-4 border-l-4 border-ouro p-5">
          <div>
            <p className="font-serif text-xl font-semibold">
              {ap.sugeridos.length === 1 ? "Eleito(a)" : `${ap.sugeridos.length} eleitos`}
              {rodada.tipo === "indicacao" ? " com 80% ou mais" : rodada.turno > 1 ? " no 2º turno" : " por maioria"}
            </p>
            <p className="text-navy/70">{ap.sugeridos.map((s) => s.nome).join(" · ")}</p>
          </div>
          <button
            className="btn-primario px-6 py-3"
            disabled={acao.ocupado}
            onClick={() =>
              acao.executar(() =>
                api.eleger(cargo.id, ap.sugeridos.map((s) => s.membroId), forma, vagasNaRodada - ap.sugeridos.length <= 0),
              )
            }
          >
            <Check size={18} /> Confirmar {ap.sugeridos.length === 1 ? "eleito" : "eleitos"}
          </button>
        </div>
      )}

      {/* Passo 2: próxima rodada ou próximo cargo */}
      {aplicado && vagasAgora > 0 && (
        <div className="cartao p-5">
          <p className="font-serif text-xl font-semibold">
            {vagasAgora === 1 ? "Falta 1 vaga" : `Faltam ${vagasAgora} vagas`}
            {ap.proximos.length > 0 && ` → ${nomeProxima}`}
          </p>
          {ap.proximos.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-navy/60">
                {ap.empate
                  ? "Empate. Nova rodada só entre os empatados."
                  : rodada.tipo === "indicacao"
                    ? "Todos os indicados (exceto família de eleito) vão para a cédula. Desmarque quem não aceitou."
                    : "Os mais votados de famílias diferentes vão para o 2º turno."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-navy/50">{selecionados.size} de {ap.proximos.length} na cédula ·</span>
                <button className="underline" onClick={() => setSelecionados(new Set(ap.proximos.map((c) => c.membroId)))}>todos</button>
                {ap.proximos.length > vagasAgora * 2 && (
                  <button className="underline" onClick={() => setSelecionados(new Set(ap.proximos.slice(0, vagasAgora * 2).map((c) => c.membroId)))}>
                    só os {vagasAgora * 2} mais indicados
                  </button>
                )}
                <button className="underline" onClick={() => setSelecionados(new Set())}>nenhum</button>
              </div>
              <CandidatosMarcaveis
                lista={ap.proximos}
                selecionados={selecionados}
                aoMudar={setSelecionados}
              />
            </>
          ) : (
            <p className="mt-1 text-sm text-navy/60">Não sobrou ninguém para votar. Abra uma nova indicação.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {ap.proximos.length > 0 && (
              <button
                className="btn-primario px-6 py-3"
                disabled={acao.ocupado || selecionados.size === 0}
                onClick={() =>
                  acao.executar(() =>
                    api.abrirRodada(cargo.id, "votacao", turnoProximo, [...selecionados], Math.max(1, Math.min(vagasAgora, selecionados.size - 1 || 1))),
                  )
                }
              >
                <Play size={18} /> Abrir {nomeProxima} ({selecionados.size})
              </button>
            )}
            <button className={ap.proximos.length ? "btn-claro" : "btn-primario px-6 py-3"} onClick={p.aoNovaIndicacao} disabled={acao.ocupado}>
              <RotateCcw size={18} /> Nova indicação
            </button>
          </div>
        </div>
      )}

      {aplicado && vagasAgora <= 0 && cargo.status !== "concluido" && (
        <div className="cartao flex items-center justify-between p-5">
          <p className="font-serif text-xl font-semibold">Todas as vagas preenchidas</p>
          <button className="btn-primario" onClick={() => acao.executar(() => api.concluirCargo(cargo.id, true))}>Concluir cargo</button>
        </div>
      )}
    </div>
  );
}

function CandidatosMarcaveis({ lista, selecionados, aoMudar }: { lista: Contagem[]; selecionados: Set<string>; aoMudar: (s: Set<string>) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {lista.map((c) => {
        const sel = selecionados.has(c.membroId);
        return (
          <button
            key={c.membroId}
            onClick={() => {
              const s = new Set(selecionados);
              if (sel) s.delete(c.membroId);
              else s.add(c.membroId);
              aoMudar(s);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${sel ? "bg-navy text-papel ring-navy" : "bg-white text-navy/50 line-through ring-papel-300"}`}
          >
            {sel && <Check size={14} />} {c.nome} <span className="opacity-60">{c.votos}</span>
          </button>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------------------------------

function OpcoesAvancadas({ cargo, dados, vagasAbertas }: { cargo: Cargo; dados: DadosAdmin; vagasAbertas: number }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const acao = useAcao();
  const eleitosCargo = new Set(dados.eleitos.filter((e) => e.cargo_id === cargo.id).map((e) => e.membro_id));
  const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const achados = q.length >= 2
    ? dados.membros.filter((m) => m.ativo && !eleitosCargo.has(m.id) && m.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <div className="cartao">
      <button className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-navy/70" onClick={() => setAberto(!aberto)}>
        Mais opções deste cargo
        <ChevronDown size={18} className={`transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="space-y-5 border-t border-papel-300 p-5">
          <div>
            <p className="font-semibold">Eleger manualmente</p>
            <p className="text-sm text-navy/60">Para decisões tomadas fora do sistema (ex.: acordo da comissão).</p>
            <input className="campo mt-2" placeholder="Buscar membro…" value={busca} onChange={(e) => setBusca(e.target.value)} disabled={vagasAbertas <= 0} />
            <ul className="mt-2 space-y-1">
              {achados.map((m) => {
                const mesmaFamilia = m.familia && dados.eleitos.some((e) => e.cargo_id === cargo.id && dados.membros.find((x) => x.id === e.membro_id)?.familia?.trim().toLowerCase() === m.familia?.trim().toLowerCase());
                return (
                  <li key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-papel-200">
                    <span>
                      {m.nome}
                      {mesmaFamilia && <span className="selo-aviso ml-2">mesma família de um eleito</span>}
                    </span>
                    <button
                      className="btn-claro py-1.5 text-sm"
                      disabled={acao.ocupado}
                      onClick={() =>
                        acao.executar(async () => {
                          await api.eleger(cargo.id, [m.id], "manual", vagasAbertas - 1 <= 0);
                          setBusca("");
                        })
                      }
                    >
                      <UserPlus size={16} /> Eleger
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <AlterarVagas cargo={cargo} minimo={dados.eleitos.filter((e) => e.cargo_id === cargo.id).length} />
          <div className="flex flex-wrap gap-2">
            {cargo.status !== "concluido" && (
              <button className="btn-claro" onClick={() => acao.executar(() => api.concluirCargo(cargo.id, true))}>
                <Check size={18} /> Concluir com {vagasAbertas} vaga(s) em aberto
              </button>
            )}
            <button
              className="btn-perigo"
              onClick={() => {
                if (confirm(`Apagar TODAS as rodadas e eleitos de ${cargo.nome}? Não dá para desfazer.`)) {
                  void acao.executar(() => api.reiniciarCargo(cargo.id));
                }
              }}
            >
              <RotateCcw size={18} /> Recomeçar cargo do zero
            </button>
          </div>
          <Erro texto={acao.erro} />
        </div>
      )}
    </div>
  );
}

function AlterarVagas({ cargo, minimo }: { cargo: Cargo; minimo: number }) {
  const [vagas, setVagas] = useState(cargo.vagas);
  const acao = useAcao();
  useEffect(() => setVagas(cargo.vagas), [cargo.vagas]);
  const minimoReal = Math.max(1, minimo);
  return (
    <div>
      <p className="font-semibold">Número de vagas</p>
      <p className="text-sm text-navy/60">A comissão pode mudar o número durante o processo. Não pode ser menor que os já eleitos ({minimo}).</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={minimoReal}
          className="campo w-24 py-2 text-center"
          value={vagas}
          onChange={(e) => setVagas(Math.max(minimoReal, Math.floor(+e.target.value) || minimoReal))}
        />
        <button
          className="btn-claro"
          disabled={acao.ocupado || vagas === cargo.vagas}
          onClick={() =>
            acao.executar(async () => {
              await api.atualizarCargo(cargo.id, { vagas, max_indicacoes: Math.min(cargo.max_indicacoes === cargo.vagas ? vagas : cargo.max_indicacoes, vagas) });
              if (minimo < vagas && cargo.status === "concluido") await api.concluirCargo(cargo.id, false);
            })
          }
        >
          Salvar vagas
        </button>
      </div>
      <Erro texto={acao.erro} />
    </div>
  );
}
