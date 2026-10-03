import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Unlock, Upload } from "lucide-react";
import { api } from "@/lib/backend";
import { CARGOS_PADRAO } from "@/lib/departamentos";
import type { Cargo, Sessao } from "@/lib/types";
import { Erro, useAcao } from "./Conduzir";
import type { DadosAdmin } from "./useAdmin";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** "Nome;Família" (ou tab / vírgula) por linha. Família é opcional. */
export function lerLinhas(texto: string): { nome: string; familia: string | null }[] {
  const saida: { nome: string; familia: string | null }[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const partes = linha.includes(";") ? linha.split(";") : linha.includes("\t") ? linha.split("\t") : linha.split(",");
    const nome = (partes[0] ?? "").replace(/^"|"$/g, "").trim();
    const familia = (partes[1] ?? "").replace(/^"|"$/g, "").trim() || null;
    if (!nome || /^nome$/i.test(nome)) continue;
    saida.push({ nome, familia });
  }
  return saida;
}

// ---------------------------------------------------------------- Membros

export function Membros({ sessao, dados }: { sessao: Sessao; dados: DadosAdmin }) {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const acao = useAcao();
  const { membros } = dados;

  const familias = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of membros) if (x.familia) m.set(norm(x.familia), (m.get(norm(x.familia)) ?? 0) + 1);
    return m;
  }, [membros]);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    return q ? membros.filter((m) => norm(m.nome).includes(q) || norm(m.familia ?? "").includes(q)) : membros;
  }, [membros, busca]);

  const importar = () =>
    acao.executar(async () => {
      const linhas = lerLinhas(texto);
      const porNome = new Map(membros.map((m) => [norm(m.nome), m]));
      const novos: typeof linhas = [];
      for (const l of linhas) {
        const existente = porNome.get(norm(l.nome));
        if (existente) {
          if (l.familia && l.familia !== existente.familia) await api.atualizarMembro(existente.id, { familia: l.familia });
        } else {
          novos.push(l);
          porNome.set(norm(l.nome), { id: "", sessao_id: sessao.id, nome: l.nome, familia: l.familia, ativo: true });
        }
      }
      if (novos.length) await api.adicionarMembros(sessao.id, novos);
      setTexto("");
      await dados.recarregarMembros();
    });

  const lerArquivo = async (f: File) => setTexto(await f.text());

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="cartao space-y-3 p-5">
        <h3 className="font-serif text-xl font-semibold">Importar membros</h3>
        <p className="text-sm text-navy/70">
          Um por linha: <code className="rounded bg-papel-200 px-1">Nome; Família</code>. A família é o que liga um núcleo familiar
          (ex.: <i>Silva-João</i>). Quem já existe só tem a família atualizada.
        </p>
        <textarea
          className="campo h-56 font-mono text-sm"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Maria da Silva; Silva-João\nJoão da Silva; Silva-João\nPedro Lima"}
        />
        <div className="flex flex-wrap gap-2">
          <label className="btn-claro cursor-pointer">
            <Upload size={18} /> Arquivo .csv/.txt
            <input type="file" accept=".csv,.txt,text/plain,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
          </label>
          <button className="btn-primario" onClick={importar} disabled={acao.ocupado || !texto.trim()}>
            Importar {texto.trim() ? `(${lerLinhas(texto).length})` : ""}
          </button>
        </div>
        <Erro texto={acao.erro} />
      </div>

      <div className="cartao overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-papel-300 p-4">
          <p className="font-semibold">{membros.length} membros · {familias.size} famílias</p>
          <input className="campo ml-auto max-w-xs py-2" placeholder="Buscar nome ou família…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-papel-200 text-left text-xs uppercase tracking-wider text-navy/60">
              <tr><th className="px-4 py-2">Nome</th><th className="px-4 py-2">Família</th><th className="px-4 py-2">Ativo</th><th /></tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-b border-papel-200">
                  <td className="px-4 py-1.5">{m.nome}</td>
                  <td className="px-4 py-1.5">
                    <input
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 hover:border-papel-300 focus:border-navy focus:outline-none"
                      defaultValue={m.familia ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== m.familia) void acao.executar(async () => { await api.atualizarMembro(m.id, { familia: v }); await dados.recarregarMembros(); });
                      }}
                    />
                    {m.familia && (familias.get(norm(m.familia)) ?? 0) > 1 && (
                      <span className="px-2 text-xs text-navy/40">{familias.get(norm(m.familia))} pessoas</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5">
                    <input
                      type="checkbox"
                      checked={m.ativo}
                      onChange={(e) => acao.executar(async () => { await api.atualizarMembro(m.id, { ativo: e.target.checked }); await dados.recarregarMembros(); })}
                      aria-label="Pode ser indicado"
                    />
                  </td>
                  <td className="px-2">
                    <button
                      className="rounded p-1 text-navy/40 hover:bg-red-50 hover:text-red-700"
                      onClick={() => confirm(`Remover ${m.nome}?`) && acao.executar(async () => { await api.removerMembros([m.id]); await dados.recarregarMembros(); })}
                      aria-label="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!membros.length && <p className="p-6 text-navy/60">Nenhum membro ainda. Cole a lista ao lado.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Comissão

export function Comissao({ sessao, dados }: { sessao: Sessao; dados: DadosAdmin }) {
  const [texto, setTexto] = useState("");
  const acao = useAcao();
  const presentes = dados.comissao.filter((c) => c.presente).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="cartao space-y-3 p-5">
        <h3 className="font-serif text-xl font-semibold">Membros da comissão</h3>
        <p className="text-sm text-navy/70">Quem vota. Um nome por linha. No celular, cada um escolhe o próprio nome desta lista.</p>
        <textarea className="campo h-48" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={"Pr. Amaury\nFulano de Tal"} />
        <button
          className="btn-primario"
          disabled={acao.ocupado || !texto.trim()}
          onClick={() =>
            acao.executar(async () => {
              const existentes = new Set(dados.comissao.map((c) => norm(c.nome)));
              const nomes = lerLinhas(texto).map((l) => l.nome).filter((n) => !existentes.has(norm(n)));
              if (nomes.length) await api.adicionarComissao(sessao.id, nomes);
              setTexto("");
              await dados.recarregar();
            })
          }
        >
          <Plus size={18} /> Adicionar
        </button>
        <Erro texto={acao.erro} />
      </div>

      <div className="cartao overflow-hidden">
        <div className="border-b border-papel-300 p-4">
          <p className="font-semibold">{presentes} presentes de {dados.comissao.length}</p>
          <p className="text-sm text-navy/60">A base dos 80% é o número de presentes. Desmarque quem saiu da reunião.</p>
        </div>
        <ul>
          {dados.comissao.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-papel-200 px-4 py-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${c.presente ? "bg-emerald-500" : "bg-papel-300"}`} />
              <span className="flex-1 font-medium">{c.nome}</span>
              <span className="text-xs text-navy/50">{c.entrou_em ? "entrou pelo celular" : "ainda não entrou"}</span>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={c.presente} onChange={(e) => acao.executar(() => api.atualizarComissao(c.id, { presente: e.target.checked }))} />
                presente
              </label>
              {c.entrou_em && (
                <button
                  className="btn-claro py-1 text-sm"
                  title="Desliga o celular atual. A pessoa pode entrar de novo escolhendo o nome."
                  onClick={() => confirm(`Liberar o nome de ${c.nome} para entrar em outro celular?`) && acao.executar(() => api.liberarParticipante(c.id, false))}
                >
                  <Unlock size={14} /> Liberar celular
                </button>
              )}
              <button
                className="rounded p-1 text-navy/40 hover:bg-red-50 hover:text-red-700"
                onClick={() => confirm(`Remover ${c.nome} da comissão?`) && acao.executar(() => api.removerComissao(c.id))}
                aria-label="Remover"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        {!dados.comissao.length && <p className="p-6 text-navy/60">Nenhum membro da comissão cadastrado.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Cargos

export function Cargos({ sessao, dados }: { sessao: Sessao; dados: DadosAdmin }) {
  const acao = useAcao();
  const { cargos } = dados;
  const salvar = (c: Cargo, p: Partial<Cargo>) => acao.executar(() => api.atualizarCargo(c.id, p));

  const mover = (i: number, d: -1 | 1) =>
    acao.executar(async () => {
      const lista = [...cargos];
      const j = i + d;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await Promise.all(lista.map((c, k) => (c.ordem !== k + 1 ? api.atualizarCargo(c.id, { ordem: k + 1 }) : null)));
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!cargos.length && (
          <button className="btn-primario" onClick={() => acao.executar(() => api.adicionarCargos(sessao.id, CARGOS_PADRAO))}>
            Carregar cargos padrão (Anciãos + {CARGOS_PADRAO.length - 1} departamentos)
          </button>
        )}
        <button
          className="btn-claro"
          onClick={() => {
            const nome = prompt("Nome do cargo");
            if (nome?.trim()) void acao.executar(() => api.adicionarCargos(sessao.id, [{ ordem: cargos.length + 1, nome: nome.trim(), cor: "#2f557f", vagas: 1, max_indicacoes: 1 }]));
          }}
        >
          <Plus size={18} /> Novo cargo
        </button>
      </div>
      <Erro texto={acao.erro} />
      <div className="cartao overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-papel-200 text-left text-xs uppercase tracking-wider text-navy/60">
            <tr>
              <th className="px-3 py-2">Ordem</th><th className="px-3 py-2">Cor</th><th className="px-3 py-2">Cargo</th>
              <th className="px-3 py-2">Vagas</th><th className="px-3 py-2">Indicações por pessoa</th><th className="px-3 py-2">Situação</th><th />
            </tr>
          </thead>
          <tbody>
            {cargos.map((c, i) => (
              <tr key={c.id} className="border-b border-papel-200">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-navy/50">{i + 1}</span>
                    <button className="rounded p-1 hover:bg-papel-200 disabled:opacity-20" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                    <button className="rounded p-1 hover:bg-papel-200 disabled:opacity-20" disabled={i === cargos.length - 1} onClick={() => mover(i, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
                  </div>
                </td>
                <td className="px-3"><input type="color" defaultValue={c.cor} onBlur={(e) => e.target.value !== c.cor && salvar(c, { cor: e.target.value })} className="h-7 w-9 cursor-pointer rounded border-0" /></td>
                <td className="px-3"><input className="w-full rounded-lg border border-transparent px-2 py-1 hover:border-papel-300" defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== c.nome && salvar(c, { nome: e.target.value.trim() })} /></td>
                <td className="px-3"><input type="number" min={1} className="w-16 rounded-lg border border-papel-300 px-2 py-1" defaultValue={c.vagas} onBlur={(e) => +e.target.value !== c.vagas && +e.target.value >= 1 && salvar(c, { vagas: +e.target.value })} /></td>
                <td className="px-3"><input type="number" min={1} className="w-16 rounded-lg border border-papel-300 px-2 py-1" defaultValue={c.max_indicacoes} onBlur={(e) => +e.target.value !== c.max_indicacoes && +e.target.value >= 1 && salvar(c, { max_indicacoes: +e.target.value })} /></td>
                <td className="px-3 text-navy/60">{{ pendente: "—", em_andamento: "em andamento", concluido: "concluído" }[c.status]}</td>
                <td className="px-2">
                  <button
                    className="rounded p-1 text-navy/40 hover:bg-red-50 hover:text-red-700"
                    onClick={() => confirm(`Remover o cargo ${c.nome} (e as rodadas dele)?`) && acao.executar(() => api.removerCargo(c.id))}
                    aria-label="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-navy/60">
        Anciãos: cada membro da comissão indica até 14 nomes; quem tiver 80% dos presentes entra direto e as vagas restantes vão para votação.
        Ajuste "Vagas" e "Indicações por pessoa" quando confirmar a regra.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Resultado final

export function Final({ sessao, dados }: { sessao: Sessao; dados: DadosAdmin }) {
  const acao = useAcao();
  const membro = (id: string) => dados.membros.find((m) => m.id === id)?.nome ?? "?";
  const linhas = dados.cargos.map((c) => ({ cargo: c, nomes: dados.eleitos.filter((e) => e.cargo_id === c.id).map((e) => membro(e.membro_id)) }));

  const baixarCsv = () => {
    const csv = ["Cargo;Eleito(a)", ...linhas.flatMap((l) => (l.nomes.length ? l.nomes : [""]).map((n) => `${l.cargo.nome};${n}`))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessao.nome.replace(/[^\w\- ]+/g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className="btn-claro" onClick={baixarCsv}>Baixar planilha (CSV)</button>
        <button className="btn-claro" onClick={() => window.print()}>Imprimir / salvar PDF</button>
        {sessao.status !== "encerrada" ? (
          <button className="btn-ouro" onClick={() => confirm("Encerrar a reunião? O telão mostrará o quadro final.") && acao.executar(() => api.atualizarSessao(sessao.id, { status: "encerrada" }))}>
            Encerrar reunião e mostrar quadro no telão
          </button>
        ) : (
          <button className="btn-claro" onClick={() => acao.executar(() => api.atualizarSessao(sessao.id, { status: "aberta" }))}>Reabrir reunião</button>
        )}
      </div>
      <Erro texto={acao.erro} />
      <div className="cartao p-8 print:shadow-none print:ring-0">
        <p className="rotulo text-navy/50">IASD Dr. Laurindo · Tatuí/SP</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold">{sessao.nome}</h2>
        <table className="mt-6 w-full text-sm">
          <tbody>
            {linhas.map(({ cargo, nomes }) => (
              <tr key={cargo.id} className="border-b border-papel-200 align-top">
                <td className="w-1/3 py-2 pr-4 font-medium">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: cargo.cor }} />
                  {cargo.nome}
                </td>
                <td className="py-2">{nomes.length ? nomes.join(", ") : <span className="text-navy/40">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
