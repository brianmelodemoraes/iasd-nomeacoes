import { useEffect, useState } from "react";
import { ExternalLink, Loader2, LogOut, Plus, QrCode, RotateCcw, Users, Wand2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, emDemo } from "@/lib/backend";
import { mensagemErro } from "@/lib/api";
import { demoApi } from "@/lib/demoApi";
import { useEstado } from "@/lib/useEstado";
import type { Sessao } from "@/lib/types";
import { FaixaDemo, Marca } from "@/components/Marca";
import { Conduzir, Erro, useAcao } from "./admin/Conduzir";
import { Cargos, Comissao, Final, Membros } from "./admin/Preparar";
import { useAdmin } from "./admin/useAdmin";

const CHAVE_SESSAO = "nomeacoes-sessao-admin";

export default function Admin() {
  const [usuario, setUsuario] = useState<{ email: string | null; admin: boolean } | null>(null);

  const verificar = () => api.usuario().then(setUsuario).catch(() => setUsuario({ email: null, admin: false }));
  useEffect(() => {
    void verificar();
  }, []);

  if (!usuario) return <Centro><Loader2 className="animate-spin" /></Centro>;
  if (!usuario.admin) return <Login email={usuario.email} aoEntrar={verificar} />;
  return <Painel email={usuario.email} aoSair={async () => { await api.sairAdmin(); void verificar(); }} />;
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center bg-papel p-4">{children}</div>;
}

function Login({ email: emailAtual, aoEntrar }: { email: string | null; aoEntrar: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const acao = useAcao();
  return (
    <Centro>
      <form
        className="cartao w-full max-w-sm space-y-4 p-7"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.executar(async () => {
            await api.entrarAdmin(email, senha);
            aoEntrar();
          });
        }}
      >
        <Marca />
        <h1 className="font-serif text-3xl font-semibold">Moderador</h1>
        {emailAtual && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {emailAtual} entrou, mas não é administrador do site da igreja.
          </p>
        )}
        <p className="text-sm text-navy/60">Use a mesma conta de administrador do site da igreja.</p>
        <input className="campo" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <input className="campo" type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        <Erro texto={acao.erro} />
        <button className="btn-primario w-full py-3" disabled={acao.ocupado}>
          {acao.ocupado ? <Loader2 className="animate-spin" /> : "Entrar"}
        </button>
        {!emDemo && (
          <a className="block text-center text-sm text-navy/50 underline" href="/admin?demo=1">Experimentar o modo demonstração</a>
        )}
      </form>
    </Centro>
  );
}

function Painel({ email, aoSair }: { email: string | null; aoSair: () => void }) {
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CHAVE_SESSAO);
    } catch {
      return null;
    }
  });
  const acao = useAcao();

  const carregar = async () => {
    const l = await api.sessoes();
    setSessoes(l);
    setSessaoId((atual) => (atual && l.some((s) => s.id === atual) ? atual : l[0]?.id ?? null));
  };
  useEffect(() => {
    carregar().catch((e) => acao.setErro(mensagemErro(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (sessaoId) localStorage.setItem(CHAVE_SESSAO, sessaoId);
    } catch {
      /* ignora */
    }
  }, [sessaoId]);

  const nova = () => {
    const nome = prompt("Nome da reunião", `Nomeações ${new Date().getFullYear() + 1}`);
    if (!nome?.trim()) return;
    void acao.executar(async () => {
      const s = await api.criarSessao(nome.trim());
      await carregar();
      setSessaoId(s.id);
    });
  };

  const sessao = sessoes?.find((s) => s.id === sessaoId) ?? null;

  return (
    <div className="min-h-dvh bg-papel">
      <FaixaDemo />
      <header className="border-b border-papel-300 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Marca />
          <span className="text-navy/30">/</span>
          {sessoes && sessoes.length > 0 ? (
            <select className="rounded-lg border border-papel-300 bg-white px-3 py-1.5 font-semibold" value={sessaoId ?? ""} onChange={(e) => setSessaoId(e.target.value)}>
              {sessoes.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          ) : (
            <span className="font-semibold">Comissão de Nomeações</span>
          )}
          <button className="btn-claro py-1.5 text-sm" onClick={nova}><Plus size={16} /> Nova reunião</button>
          <div className="ml-auto flex items-center gap-3 text-sm text-navy/60">
            {emDemo && (
              <button className="btn-claro py-1.5 text-sm" onClick={() => confirm("Apagar todos os dados da demonstração e recomeçar?") && demoApi.reiniciarDemo().then(() => window.location.reload())}>
                <RotateCcw size={16} /> Recomeçar demo
              </button>
            )}
            <span className="hidden sm:inline">{email}</span>
            {!emDemo && <button className="rounded-lg p-2 hover:bg-papel-200" onClick={aoSair} title="Sair"><LogOut size={18} /></button>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Erro texto={acao.erro} />
        {sessoes === null ? (
          <div className="grid place-items-center p-20"><Loader2 className="animate-spin" /></div>
        ) : !sessao ? (
          <div className="cartao p-10 text-center">
            <p className="font-serif text-2xl font-semibold">Nenhuma reunião ainda</p>
            <button className="btn-primario mt-4" onClick={nova}><Plus size={18} /> Criar a reunião deste ano</button>
          </div>
        ) : (
          <Sala key={sessao.id} sessao={sessao} aoMudarSessao={carregar} />
        )}
      </div>
    </div>
  );
}

type Aba = "conduzir" | "membros" | "comissao" | "cargos" | "final";
const ABAS: [Aba, string][] = [
  ["conduzir", "Conduzir"],
  ["comissao", "Comissão"],
  ["membros", "Membros da igreja"],
  ["cargos", "Cargos"],
  ["final", "Resultado final"],
];

function Sala({ sessao, aoMudarSessao }: { sessao: Sessao; aoMudarSessao: () => Promise<void> }) {
  const dados = useAdmin(sessao.id);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("conduzir");
  const [qr, setQr] = useState(false);
  const { estado } = useEstado({ codigo });
  const acao = useAcao();

  useEffect(() => {
    api.codigo(sessao.id).then(setCodigo).catch(() => setCodigo(null));
  }, [sessao.id]);

  // Mantém o status da sessão (ex.: encerrada) em dia no seletor.
  useEffect(() => {
    if (estado && estado.sessao.status !== sessao.status) void aoMudarSessao();
  }, [estado, sessao.status, aoMudarSessao]);

  const sufixo = emDemo ? "&demo=1" : "";
  const linkCelular = codigo ? `${window.location.origin}/?c=${codigo}${sufixo}` : "";
  const linkTelao = codigo ? `${window.location.origin}/telao/${codigo}${emDemo ? "?demo=1" : ""}` : "";
  const sessaoAtual = estado ? { ...sessao, status: estado.sessao.status } : sessao;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="cartao flex items-center gap-4 px-5 py-3">
          <div>
            <p className="rotulo text-navy/50">Código da sala</p>
            <p className="font-serif text-2xl font-semibold tracking-[0.2em]">{codigo ?? "…"}</p>
          </div>
          <button className="rounded-lg p-2 hover:bg-papel-200" onClick={() => setQr(!qr)} title="QR code"><QrCode /></button>
        </div>
        <div className="cartao flex items-center gap-2 px-5 py-3">
          <Users size={20} className="text-navy/50" />
          <p><b className="tabular-nums">{estado?.presentes ?? 0}</b> / {estado?.comissao_total ?? 0} presentes</p>
          {emDemo && (
            <button className="btn-claro ml-2 py-1 text-sm" onClick={() => acao.executar(() => demoApi.simularEntradas(sessao.id))}>
              <Wand2 size={14} /> Todos entrarem
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-claro" href={linkTelao} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Abrir telão</a>
          <a className="btn-claro" href={linkCelular} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Abrir tela do celular</a>
        </div>
      </div>

      {qr && codigo && (
        <div className="cartao flex flex-wrap items-center gap-6 p-5 print:hidden">
          <QRCodeSVG value={linkCelular} size={180} />
          <div className="text-sm text-navy/70">
            <p>Link para os membros da comissão:</p>
            <p className="mt-1 break-all font-mono text-navy">{linkCelular}</p>
            <p className="mt-3">Telão (projetor):</p>
            <p className="mt-1 break-all font-mono text-navy">{linkTelao}</p>
          </div>
        </div>
      )}

      <Erro texto={acao.erro} />

      <nav className="flex gap-1 overflow-x-auto border-b border-papel-300 print:hidden">
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 font-semibold transition ${aba === id ? "border-navy text-navy" : "border-transparent text-navy/50 hover:text-navy"}`}
          >
            {nome}
            {id === "membros" && <span className="ml-1.5 text-xs font-normal text-navy/40">{dados.membros.length}</span>}
            {id === "comissao" && <span className="ml-1.5 text-xs font-normal text-navy/40">{dados.comissao.length}</span>}
            {id === "cargos" && <span className="ml-1.5 text-xs font-normal text-navy/40">{dados.cargos.length}</span>}
          </button>
        ))}
      </nav>

      {aba === "conduzir" && <Conduzir sessao={sessaoAtual} dados={dados} estado={estado} />}
      {aba === "membros" && <Membros sessao={sessao} dados={dados} />}
      {aba === "comissao" && <Comissao sessao={sessao} dados={dados} />}
      {aba === "cargos" && <Cargos sessao={sessao} dados={dados} />}
      {aba === "final" && <Final sessao={sessaoAtual} dados={dados} />}
    </div>
  );
}
