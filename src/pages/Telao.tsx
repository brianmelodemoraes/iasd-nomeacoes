import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { Maximize } from "lucide-react";
import { useEstado } from "@/lib/useEstado";
import { maioriaAbsoluta, minimoPara } from "@/lib/regras";
import { corClara } from "@/lib/departamentos";
import { emDemo } from "@/lib/backend";
import type { CargoEstado, Estado, RodadaEstado } from "@/lib/types";
import { Simbolo } from "@/components/Marca";

const MAX_BARRAS = 12;

function linkParticipante(codigo: string) {
  return `${window.location.origin}/?c=${codigo}${emDemo ? "&demo=1" : ""}`;
}

export default function Telao() {
  const { codigo = "" } = useParams();
  const { estado, erro } = useEstado({ codigo });

  if (!estado) {
    return (
      <Tela cor="#1B2A44">
        <div className="flex h-full items-center justify-center text-[2vw] text-papel/70">{erro ?? "Conectando…"}</div>
      </Tela>
    );
  }

  const cargo = estado.cargos.find((c) => c.id === estado.sessao.cargo_atual_id) ?? null;
  const rodada = estado.rodada && cargo && estado.rodada.cargo_id === cargo.id ? estado.rodada : null;

  let conteudo: React.ReactNode;
  if (estado.sessao.status === "encerrada") conteudo = <Quadro estado={estado} />;
  else if (!cargo) conteudo = <Abertura estado={estado} />;
  else if (cargo.status === "concluido") conteudo = <Celebracao key={cargo.id} cargo={cargo} />;
  else if (!rodada) conteudo = <ASeguir cargo={cargo} estado={estado} />;
  else if (rodada.status === "aberta") conteudo = <EmAndamento cargo={cargo} rodada={rodada} estado={estado} />;
  else if (rodada.status === "encerrada") conteudo = <Apurando cargo={cargo} rodada={rodada} />;
  else conteudo = <Resultado key={rodada.id} cargo={cargo} rodada={rodada} estado={estado} />;

  return <Tela cor={estado.sessao.status === "encerrada" || !cargo ? "#2f557f" : cargo.cor}>{conteudo}</Tela>;
}

/** Grade da Criação: 6 colunas de conteúdo + 7ª coluna na cor do departamento com o símbolo branco. */
function Tela({ cor, children }: { cor: string; children: React.ReactNode }) {
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const f = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  return (
    <div className="relative grid h-dvh w-screen grid-cols-7 overflow-hidden bg-navy-950 text-papel">
      <main className="col-span-6 h-dvh overflow-hidden px-[4.5vw] py-[4vw]">{children}</main>
      <aside className="flex h-dvh items-end justify-center pb-[4vw] transition-colors duration-700" style={{ background: cor }}>
        <Simbolo className={`h-[5vw] w-[5vw] ${corClara(cor) ? "text-navy-950" : "text-white"}`} />
      </aside>
      {!cheia && (
        <button
          className="absolute right-3 top-3 rounded-lg bg-black/30 p-2 text-white/70 hover:text-white"
          onClick={() => document.documentElement.requestFullscreen?.()}
          title="Tela cheia"
        >
          <Maximize size={18} />
        </button>
      )}
      {emDemo && <div className="absolute left-0 top-0 bg-ouro px-3 py-1 text-xs font-semibold uppercase tracking-widest text-navy-950">Demonstração</div>}
    </div>
  );
}

function Rotulo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span className="rotulo inline-block self-start rounded-full px-[1vw] py-[0.35vw] text-[0.95vw]" style={{ background: cor ?? "rgba(255,255,255,.1)", color: cor && corClara(cor) ? "#0F1A2E" : "#fff" }}>
      {children}
    </span>
  );
}

function CantoQr({ codigo }: { codigo: string }) {
  return (
    <div className="absolute bottom-[4vw] right-[calc(100%/7+1.5vw)] flex items-center gap-[1vw] rounded-2xl bg-white/5 p-[0.8vw] ring-1 ring-white/10">
      <div className="rounded-lg bg-white p-[0.4vw]">
        <QRCodeSVG value={linkParticipante(codigo)} size={256} className="h-[5.5vw] w-[5.5vw]" />
      </div>
      <div>
        <p className="text-[0.8vw] uppercase tracking-widest text-papel/50">Código</p>
        <p className="font-serif text-[2vw] font-semibold tracking-[0.15em]">{codigo}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- telas

function Abertura({ estado }: { estado: Estado }) {
  const feitos = estado.cargos.filter((c) => c.status === "concluido").length;
  return (
    <div className="grid h-full grid-cols-[1.4fr_1fr] items-center gap-[4vw]">
      <div className="animar-entrada">
        <p className="rotulo text-[1vw] text-ouro">IASD Dr. Laurindo</p>
        <h1 className="mt-[1.5vw] font-serif text-[5.2vw] font-semibold leading-[1.02]">Comissão de Nomeações</h1>
        <p className="mt-[1.5vw] text-[1.6vw] text-papel/70">{estado.sessao.nome}</p>
        <div className="mt-[3vw] flex gap-[3vw]">
          <Numero valor={estado.presentes} total={estado.comissao_total} legenda="presentes" />
          <Numero valor={feitos} total={estado.cargos.length} legenda="cargos definidos" />
        </div>
      </div>
      <div className="animar-entrada flex flex-col items-center rounded-[2vw] bg-white p-[2.2vw] text-navy-950">
        <QRCodeSVG value={linkParticipante(estado.sessao.codigo)} size={512} className="h-[20vw] w-[20vw]" />
        <p className="mt-[1.2vw] text-[1.1vw] text-navy/60">Aponte a câmera ou digite o código</p>
        <p className="font-serif text-[4vw] font-semibold tracking-[0.2em]">{estado.sessao.codigo}</p>
      </div>
    </div>
  );
}

function Numero({ valor, total, legenda }: { valor: number; total: number; legenda: string }) {
  return (
    <div>
      <p className="font-serif text-[4vw] font-semibold tabular-nums leading-none">
        {valor}<span className="text-papel/35">/{total}</span>
      </p>
      <p className="mt-[0.5vw] text-[1.1vw] text-papel/60">{legenda}</p>
    </div>
  );
}

function ASeguir({ cargo, estado }: { cargo: CargoEstado; estado: Estado }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="animar-entrada">
        <p className="rotulo text-[1.1vw] text-papel/50">A seguir</p>
        <h1 className="mt-[1vw] font-serif text-[6.5vw] font-semibold leading-none">{cargo.nome}</h1>
        {cargo.vagas > 1 && <p className="mt-[1.5vw] text-[1.8vw] text-papel/70">{cargo.vagas} vagas</p>}
      </div>
      <CantoQr codigo={estado.sessao.codigo} />
    </div>
  );
}

function etapa(r: RodadaEstado) {
  if (r.tipo === "indicacao") return "Indicação";
  return r.turno > 1 ? "Votação · 2º turno" : "Votação";
}

function EmAndamento({ cargo, rodada, estado }: { cargo: CargoEstado; rodada: RodadaEstado; estado: Estado }) {
  const pct = rodada.presentes ? Math.min(1, rodada.votaram / rodada.presentes) : 0;
  const vagasRestantes = cargo.vagas - cargo.eleitos.length;
  const n = rodada.candidatos.length;
  const cedula = rodada.tipo === "votacao";
  // Cédula grande (ex.: anciãos) encolhe para caber numa tela.
  const colunas = n <= 4 ? 2 : n <= 9 ? 3 : n <= 20 ? 4 : 5;
  const fonte = n <= 4 ? "2.6vw" : n <= 9 ? "1.9vw" : n <= 20 ? "1.35vw" : n <= 40 ? "1.05vw" : "0.85vw";
  const contador = (
    <div>
      <p className="font-serif font-semibold tabular-nums leading-none" style={{ fontSize: cedula ? "4vw" : "7vw" }}>
        {rodada.votaram}<span className="text-papel/30">/{rodada.presentes}</span>
      </p>
      <p className="mt-[0.6vw] text-[1.4vw] text-papel/70">já {rodada.tipo === "indicacao" ? "indicaram" : "votaram"}</p>
      <div className="mt-[1vw] h-[0.5vw] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-ouro transition-[width] duration-700 ease-out" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-[3vw]">
        <div>
          <div className="flex items-center gap-[1vw]">
            <Rotulo cor={cargo.cor}>{etapa(rodada)}</Rotulo>
            {rodada.numero > 1 && <span className="text-[1vw] text-papel/50">rodada {rodada.numero}</span>}
          </div>
          <h1 className="mt-[1.2vw] font-serif font-semibold leading-none" style={{ fontSize: cedula ? "4.2vw" : "5.5vw" }}>{cargo.nome}</h1>
          {cargo.vagas > 1 && (
            <p className="mt-[1vw] text-[1.5vw] text-papel/70">
              {vagasRestantes} de {cargo.vagas} vagas em aberto · cada um escolhe até {rodada.max_escolhas}
            </p>
          )}
        </div>
        {cedula && <div className="w-[22vw] shrink-0">{contador}</div>}
      </div>

      {cedula ? (
        <ul className="mt-[2.2vw] grid content-start gap-[0.6vw]" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {rodada.candidatos.map((c) => (
            <li key={c.id} className="animar-entrada truncate rounded-[0.6vw] bg-white/[0.07] px-[1vw] py-[0.5vw] ring-1 ring-white/10" style={{ fontSize: fonte }}>
              {c.nome}
              {c.eleito_para.length > 0 && <span className="ml-[0.5vw] text-ouro-300" style={{ fontSize: "0.75em" }}>· já eleito(a): {c.eleito_para.join(", ")}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="mt-auto max-w-[70%]">{contador}</div>
          <CantoQr codigo={estado.sessao.codigo} />
        </>
      )}
    </div>
  );
}

function Apurando({ cargo, rodada }: { cargo: CargoEstado; rodada: RodadaEstado }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <Rotulo cor={cargo.cor}>{etapa(rodada)}</Rotulo>
      <h1 className="mt-[1.2vw] font-serif text-[5.5vw] font-semibold leading-none">{cargo.nome}</h1>
      <p className="pulsar mt-[3vw] text-[2.4vw] text-papel/80">Apurando…</p>
    </div>
  );
}

function Resultado({ cargo, rodada, estado }: { cargo: CargoEstado; rodada: RodadaEstado; estado: Estado }) {
  const linhas = rodada.resultado ?? [];
  // Na votação, mostra também quem ficou com zero.
  const todas = useMemo(() => {
    if (rodada.tipo !== "votacao") return linhas;
    const zeros = rodada.candidatos.filter((c) => !linhas.some((l) => l.membro_id === c.id)).map((c) => ({ membro_id: c.id, nome: c.nome, votos: 0 }));
    return [...linhas, ...zeros];
  }, [linhas, rodada]);
  const visiveis = todas.slice(0, MAX_BARRAS);
  const escondidos = todas.length - visiveis.length;

  const base = Math.max(1, rodada.presentes);
  const limiar =
    rodada.tipo === "indicacao"
      ? { votos: minimoPara(estado.sessao.limiar_aclamacao, base), texto: `${Math.round(estado.sessao.limiar_aclamacao * 100)}% · entra direto` }
      : rodada.turno <= 1
        ? { votos: maioriaAbsoluta(base), texto: "maioria" }
        : null;
  const eleitos = new Set(cargo.eleitos.map((e) => e.membro_id));

  const [animar, setAnimar] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimar(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-[1vw]">
        <Rotulo cor={cargo.cor}>{etapa(rodada)} · resultado</Rotulo>
        <span className="text-[1vw] text-papel/50">{rodada.votaram} de {rodada.presentes} presentes participaram</span>
      </div>
      <h1 className="mt-[1vw] font-serif text-[4vw] font-semibold leading-none">{cargo.nome}</h1>

      <div className="mt-[2.6vw] flex-1">
        <ul className="flex flex-col gap-[0.55vw]">
          {visiveis.map((l, i) => {
            const eleito = eleitos.has(l.membro_id);
            const larg = animar ? (l.votos / base) * 100 : 0;
            const compacto = visiveis.length > 8;
            return (
              <li key={l.membro_id} className="grid items-center gap-[1vw]" style={{ gridTemplateColumns: "28% 1fr 9%" }}>
                <span className={`truncate text-right ${eleito ? "font-semibold text-white" : "text-papel/85"}`} style={{ fontSize: compacto ? "1.35vw" : "1.7vw" }}>
                  {eleito && <span className="mr-[0.6vw] rounded bg-ouro px-[0.5vw] py-[0.1vw] align-middle text-[0.8vw] font-bold uppercase tracking-wider text-navy-950">eleito</span>}
                  {l.nome}
                </span>
                <span className="relative block rounded-r-[4px] bg-white/[0.04]" style={{ height: compacto ? "1.6vw" : "2.2vw" }}>
                  <span
                    className="block h-full rounded-r-[4px] transition-[width] ease-out"
                    style={{
                      width: `${larg}%`,
                      background: eleito ? "#C9A44C" : cargo.cor,
                      transitionDuration: "1100ms",
                      transitionDelay: `${i * 90}ms`,
                      opacity: eleito || !eleitos.size ? 1 : 0.75,
                    }}
                  />
                  {limiar && (
                    <span
                      className="pointer-events-none absolute -bottom-[0.3vw] -top-[0.3vw] border-l-2 border-dashed border-ouro/80"
                      style={{ left: `${(limiar.votos / base) * 100}%` }}
                    >
                      {i === 0 && (
                        <span className="absolute -top-[1.7vw] -translate-x-1/2 whitespace-nowrap text-[0.9vw] font-semibold uppercase tracking-wider text-ouro">
                          {limiar.votos} votos · {limiar.texto}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span className="text-[1.5vw] font-semibold tabular-nums">
                  {l.votos}
                  <span className="ml-[0.4vw] text-[1vw] font-normal text-papel/50">{Math.round((l.votos / base) * 100)}%</span>
                </span>
              </li>
            );
          })}
        </ul>
        {escondidos > 0 && <p className="mt-[1vw] text-[1.1vw] text-papel/50">+ {escondidos} nome(s) com menos votos</p>}
        {linhas.length === 0 && <p className="text-[2vw] text-papel/60">Nenhum voto registrado.</p>}
      </div>

      {cargo.vagas > 1 && cargo.eleitos.length > 0 && (
        <p className="mt-[1vw] text-[1.3vw] text-papel/70">
          <span className="text-ouro">Eleitos ({cargo.eleitos.length}/{cargo.vagas}):</span> {cargo.eleitos.map((e) => e.nome).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Celebracao({ cargo }: { cargo: CargoEstado }) {
  const disparou = useRef(false);
  useEffect(() => {
    if (disparou.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    disparou.current = true;
    const cores = ["#C9A44C", "#F7F5F0", cargo.cor];
    const fim = Date.now() + 1800;
    const quadro = () => {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: cores });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 0.86, y: 0.75 }, colors: cores });
      if (Date.now() < fim) requestAnimationFrame(quadro);
    };
    quadro();
  }, [cargo.cor]);

  const muitos = cargo.eleitos.length > 3;
  return (
    <div className="flex h-full flex-col justify-center">
      <Rotulo cor={cargo.cor}>{cargo.nome}</Rotulo>
      <p className="mt-[2vw] text-[1.6vw] uppercase tracking-[0.3em] text-ouro">
        {cargo.eleitos.length > 1 ? "Eleitos" : "Eleito(a)"}
      </p>
      {muitos ? (
        <ul className="mt-[1.5vw] grid grid-cols-2 gap-x-[3vw] gap-y-[0.8vw]">
          {cargo.eleitos.map((e, i) => (
            <li key={e.membro_id} className="animar-entrada font-serif text-[2.3vw] font-semibold" style={{ animationDelay: `${i * 80}ms` }}>
              {e.nome}
            </li>
          ))}
        </ul>
      ) : (
        cargo.eleitos.map((e, i) => (
          <h1 key={e.membro_id} className="animar-entrada mt-[1vw] font-serif text-[6vw] font-semibold leading-[1.05]" style={{ animationDelay: `${i * 150}ms` }}>
            {e.nome}
          </h1>
        ))
      )}
      {cargo.eleitos.length === 0 && <h1 className="mt-[1vw] font-serif text-[4vw] text-papel/60">Sem eleito</h1>}
    </div>
  );
}

function Quadro({ estado }: { estado: Estado }) {
  const ancioes = estado.cargos.filter((c) => c.vagas > 1);
  const demais = estado.cargos.filter((c) => c.vagas === 1);
  return (
    <div className="flex h-full flex-col">
      <p className="rotulo text-[0.9vw] text-ouro">{estado.sessao.nome}</p>
      <h1 className="mt-[0.5vw] font-serif text-[3vw] font-semibold leading-none">Nova liderança</h1>
      <div className="mt-[1.8vw] grid flex-1 grid-cols-[1fr_3.4fr] gap-[3vw] overflow-hidden">
        <div>
          {ancioes.map((c) => (
            <div key={c.id}>
              <p className="border-b border-white/15 pb-[0.4vw] text-[1vw] uppercase tracking-widest text-papel/60">{c.nome}</p>
              <ul className="mt-[0.6vw] space-y-[0.25vw] text-[1.15vw]">
                {c.eleitos.map((e) => <li key={e.membro_id}>{e.nome}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <ul className="grid auto-rows-min grid-cols-3 gap-x-[2vw] gap-y-[0.9vw]">
          {demais.map((c) => (
            <li key={c.id} className="border-b border-white/10 pb-[0.5vw]">
              <p className="flex items-center gap-[0.5vw] text-[0.85vw] uppercase tracking-wider text-papel/55">
                <span className="h-[0.6vw] w-[0.6vw] shrink-0 rounded-full" style={{ background: c.cor }} />
                <span className="min-w-0 truncate">{c.nome}</span>
              </p>
              <p className="mt-[0.2vw] truncate text-[1.25vw] font-medium">{c.eleitos.map((e) => e.nome).join(", ") || "—"}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
