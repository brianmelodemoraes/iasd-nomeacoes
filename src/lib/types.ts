export type StatusSessao = "preparando" | "aberta" | "encerrada";
export type StatusCargo = "pendente" | "em_andamento" | "concluido";
export type TipoRodada = "indicacao" | "votacao";
export type StatusRodada = "aberta" | "encerrada" | "revelada";
export type FormaEleicao = "aclamacao" | "votacao" | "manual";

export interface EleitoResumo {
  membro_id: string;
  nome: string;
  forma: FormaEleicao;
}

export interface CargoEstado {
  id: string;
  ordem: number;
  nome: string;
  cor: string;
  vagas: number;
  max_indicacoes: number;
  status: StatusCargo;
  eleitos: EleitoResumo[];
}

export interface CandidatoEstado {
  id: string;
  nome: string;
  eleito_para: string[];
}

export interface ResultadoPublico {
  membro_id: string;
  nome: string;
  votos: number;
}

export interface RodadaEstado {
  id: string;
  cargo_id: string;
  numero: number;
  tipo: TipoRodada;
  turno: number;
  status: StatusRodada;
  max_escolhas: number;
  presentes: number;
  votaram: number;
  candidatos: CandidatoEstado[];
  resultado: ResultadoPublico[] | null;
}

export interface Estado {
  sessao: {
    id: string;
    nome: string;
    status: StatusSessao;
    codigo: string;
    cargo_atual_id: string | null;
    limiar_aclamacao: number;
  };
  comissao_total: number;
  presentes: number;
  cargos: CargoEstado[];
  rodada: RodadaEstado | null;
  eu: { comissao_id: string; nome: string; presente: boolean; ja_votou: boolean } | null;
}

export interface Sala {
  sessao_id: string;
  nome: string;
  status: StatusSessao;
  comissao: { id: string; nome: string; ocupado: boolean }[];
}

export interface Entrada {
  token: string;
  comissao_id: string;
  sessao_id: string;
  nome: string;
}

export interface MembroLista {
  id: string;
  nome: string;
  eleito_para: string[];
}

// ---------- Moderador ----------

export interface Sessao {
  id: string;
  nome: string;
  status: StatusSessao;
  cargo_atual_id: string | null;
  rodada_atual_id: string | null;
  limiar_aclamacao: number;
  created_at: string;
}

export interface Membro {
  id: string;
  sessao_id: string;
  nome: string;
  familia: string | null;
  ativo: boolean;
}

export interface MembroComissao {
  id: string;
  sessao_id: string;
  nome: string;
  presente: boolean;
  entrou_em: string | null;
}

export interface Cargo {
  id: string;
  sessao_id: string;
  ordem: number;
  nome: string;
  cor: string;
  vagas: number;
  max_indicacoes: number;
  status: StatusCargo;
}

export interface Rodada {
  id: string;
  sessao_id: string;
  cargo_id: string;
  numero: number;
  tipo: TipoRodada;
  turno: number;
  status: StatusRodada;
  candidatos: string[];
  max_escolhas: number;
  presentes: number;
  created_at: string;
}

export interface Eleito {
  id: string;
  cargo_id: string;
  membro_id: string;
  forma: FormaEleicao;
  created_at: string;
}

export interface LinhaResultado {
  membro_id: string;
  nome: string;
  familia: string | null;
  votos: number;
  eleito_para: string[];
}

export type NovoCargo = Pick<Cargo, "ordem" | "nome" | "cor" | "vagas" | "max_indicacoes">;
