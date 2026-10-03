import type {
  Cargo, Eleito, Entrada, Estado, FormaEleicao, LinhaResultado, Membro, MembroComissao,
  MembroLista, NovoCargo, Rodada, Sala, Sessao, TipoRodada,
} from "./types";

/**
 * Tudo que as telas precisam do backend. Duas implementações:
 * - supabaseApi: produção (Supabase do site da igreja)
 * - demoApi: tudo no navegador, sincronizado entre abas — para testar e treinar.
 */
export interface Api {
  modo: "supabase" | "demo";

  // ----- Público (celular e telão) -----
  sala(codigo: string): Promise<Sala>;
  entrar(codigo: string, comissaoId: string, token?: string | null): Promise<Entrada>;
  estado(p: { codigo?: string; token?: string }): Promise<Estado>;
  listaMembros(token: string): Promise<MembroLista[]>;
  votar(token: string, rodadaId: string, membros: string[]): Promise<void>;
  /** Avisa quando algo da sessão muda. Devolve a função para cancelar. */
  assinar(sessaoId: string, aoMudar: () => void): () => void;

  // ----- Moderador -----
  usuario(): Promise<{ email: string | null; admin: boolean }>;
  entrarAdmin(email: string, senha: string): Promise<void>;
  sairAdmin(): Promise<void>;

  sessoes(): Promise<Sessao[]>;
  criarSessao(nome: string): Promise<{ id: string; codigo: string }>;
  atualizarSessao(id: string, p: Partial<Pick<Sessao, "nome" | "status" | "limiar_aclamacao">>): Promise<void>;
  codigo(sessaoId: string): Promise<string>;

  membros(sessaoId: string): Promise<Membro[]>;
  adicionarMembros(sessaoId: string, linhas: { nome: string; familia: string | null }[]): Promise<void>;
  atualizarMembro(id: string, p: Partial<Pick<Membro, "nome" | "familia" | "ativo">>): Promise<void>;
  removerMembros(ids: string[]): Promise<void>;

  comissao(sessaoId: string): Promise<MembroComissao[]>;
  adicionarComissao(sessaoId: string, nomes: string[]): Promise<void>;
  atualizarComissao(id: string, p: Partial<Pick<MembroComissao, "nome" | "presente">>): Promise<void>;
  removerComissao(id: string): Promise<void>;
  liberarParticipante(comissaoId: string, ausente: boolean): Promise<void>;

  cargos(sessaoId: string): Promise<Cargo[]>;
  adicionarCargos(sessaoId: string, cargos: NovoCargo[]): Promise<void>;
  atualizarCargo(id: string, p: Partial<NovoCargo>): Promise<void>;
  removerCargo(id: string): Promise<void>;

  rodadas(cargoId: string): Promise<Rodada[]>;
  eleitos(sessaoId: string): Promise<Eleito[]>;
  quemVotou(rodadaId: string): Promise<string[]>;
  abrirRodada(cargoId: string, tipo: TipoRodada, turno: number, candidatos: string[], maxEscolhas: number): Promise<string>;
  encerrarRodada(rodadaId: string): Promise<void>;
  revelarRodada(rodadaId: string): Promise<void>;
  resultado(rodadaId: string): Promise<LinhaResultado[]>;
  eleger(cargoId: string, membros: string[], forma: FormaEleicao, concluir: boolean): Promise<void>;
  removerEleito(cargoId: string, membroId: string): Promise<void>;
  concluirCargo(cargoId: string, concluido: boolean): Promise<void>;
  reiniciarCargo(cargoId: string): Promise<void>;
  selecionarCargo(cargoId: string): Promise<void>;
}

/** Mensagens de erro do banco → português simples. */
const MENSAGENS: Record<string, string> = {
  SALA_NAO_ENCONTRADA: "Código não encontrado. Confira as letras com o telão.",
  SALA_ENCERRADA: "Esta reunião já foi encerrada.",
  NOME_NAO_ENCONTRADO: "Nome não encontrado na comissão.",
  NOME_EM_USO: "Esse nome já entrou em outro celular. Peça ao moderador para liberar.",
  TOKEN_INVALIDO: "Seu acesso expirou. Entre de novo com o código da sala.",
  NAO_PRESENTE: "Você está marcado como ausente. Fale com o moderador.",
  RODADA_NAO_ENCONTRADA: "Rodada não encontrada.",
  RODADA_FECHADA: "Esta rodada já foi encerrada.",
  ESCOLHA_OBRIGATORIA: "Escolha pelo menos um nome.",
  ESCOLHAS_DEMAIS: "Você escolheu nomes demais para esta rodada.",
  ESCOLHA_REPETIDA: "Um nome foi escolhido duas vezes.",
  CANDIDATO_INVALIDO: "Um dos nomes não pode ser escolhido nesta rodada.",
  JA_VOTOU: "Seu voto desta rodada já foi registrado.",
  SEM_PERMISSAO: "Você não tem permissão de moderador.",
  RODADA_ABERTA: "Encerre a rodada para ver a contagem.",
  VAGAS_EXCEDIDAS: "Esse cargo já tem todas as vagas preenchidas.",
  SEM_CANDIDATOS: "Escolha pelo menos um candidato para a votação.",
  CARGO_NAO_ENCONTRADO: "Cargo não encontrado.",
};

export function mensagemErro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  for (const [codigo, msg] of Object.entries(MENSAGENS)) {
    if (bruto.includes(codigo)) return msg;
  }
  if (/fetch|network|Failed to fetch/i.test(bruto)) return "Sem conexão. Verifique a internet e tente de novo.";
  if (/Invalid login/i.test(bruto)) return "E-mail ou senha incorretos.";
  return bruto || "Algo deu errado. Tente de novo.";
}

export class ErroApi extends Error {}
