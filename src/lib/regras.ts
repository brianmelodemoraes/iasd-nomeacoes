/**
 * Regras da Comissão de Nomeações.
 *
 * 1. Indicação: quem tiver ≥ 80% dos PRESENTES entra direto (aclamação).
 * 2. Se sobrar vaga: votação com todos os indicados restantes.
 *    Entra quem tiver mais de 50% dos presentes.
 * 3. Se ainda sobrar vaga: 2º turno entre os 2 mais votados por vaga
 *    (empate no corte leva todos os empatados). No 2º turno ganha o mais votado;
 *    empate na última vaga → nova rodada só entre os empatados.
 * Família: o mesmo cargo não pode ter duas pessoas do mesmo núcleo familiar.
 * Fica o mais votado da família; o outro é pulado e entra o próximo de outra família.
 */

export interface Contagem {
  membroId: string;
  nome: string;
  familia: string | null;
  votos: number;
}

export interface Contexto {
  /** Base de todas as porcentagens. */
  presentes: number;
  /** Vagas ainda abertas no cargo. */
  vagasRestantes: number;
  /** Famílias de quem já foi eleito para ESTE cargo. */
  familiasOcupadas: Iterable<string | null>;
  /** Limiar de aclamação (0.8 = 80%). */
  limiar?: number;
}

export interface Pulado {
  contagem: Contagem;
  motivo: "familia";
  /** Nome de quem ocupa a família. */
  por: string;
}

export interface ApuracaoIndicacao {
  minimoAclamacao: number;
  eleitos: Contagem[];
  pulados: Pulado[];
  /** Quem vai para a cédula se ainda houver vaga. */
  candidatosVotacao: Contagem[];
  vagasRestantes: number;
}

export interface ApuracaoVotacao {
  minimo: number;
  eleitos: Contagem[];
  pulados: Pulado[];
  /** Finalistas do próximo turno (vazio se não houver mais vaga). */
  proximoTurno: Contagem[];
  /** true quando o próximo turno é desempate de 2º turno. */
  empate: boolean;
  vagasRestantes: number;
}

export function chaveFamilia(f: string | null | undefined): string | null {
  const k = (f ?? "").trim().toLowerCase();
  return k === "" ? null : k;
}

export function ordenar(c: Contagem[]): Contagem[] {
  return [...c].sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Votos mínimos para atingir uma fração dos presentes (≥). */
export function minimoPara(fracao: number, presentes: number): number {
  return Math.max(1, Math.ceil(fracao * presentes - 1e-9));
}

/** Mais da metade dos presentes. */
export function maioriaAbsoluta(presentes: number): number {
  return Math.floor(presentes / 2) + 1;
}

class Familias {
  private donos = new Map<string, string>();
  constructor(ocupadas: Iterable<string | null>) {
    for (const f of ocupadas) {
      const k = chaveFamilia(f);
      if (k) this.donos.set(k, "eleito anteriormente");
    }
  }
  dono(c: Contagem): string | undefined {
    const k = chaveFamilia(c.familia);
    return k ? this.donos.get(k) : undefined;
  }
  ocupar(c: Contagem) {
    const k = chaveFamilia(c.familia);
    if (k) this.donos.set(k, c.nome);
  }
}

/** Escolhe até `vagas` nomes em ordem, pulando famílias repetidas. */
function preencher(ordenados: Contagem[], vagas: number, fam: Familias, pulados: Pulado[]): Contagem[] {
  const eleitos: Contagem[] = [];
  for (const c of ordenados) {
    if (eleitos.length >= vagas) break;
    const dono = fam.dono(c);
    if (dono) {
      pulados.push({ contagem: c, motivo: "familia", por: dono });
      continue;
    }
    fam.ocupar(c);
    eleitos.push(c);
  }
  return eleitos;
}

/**
 * Finalistas: os `quantos` mais votados de famílias diferentes (e diferentes das já ocupadas).
 * Quem empata com o último finalista também entra.
 */
export function finalistas(
  candidatos: Contagem[],
  quantos: number,
  ocupadas: Iterable<string | null>,
): { finalistas: Contagem[]; pulados: Pulado[] } {
  const fam = new Familias(ocupadas);
  const pulados: Pulado[] = [];
  const escolhidos: Contagem[] = [];
  for (const c of ordenar(candidatos)) {
    const ultimo = escolhidos[escolhidos.length - 1];
    if (escolhidos.length >= quantos && (!ultimo || c.votos < ultimo.votos)) break;
    const dono = fam.dono(c);
    if (dono) {
      pulados.push({ contagem: c, motivo: "familia", por: dono });
      continue;
    }
    fam.ocupar(c);
    escolhidos.push(c);
  }
  return { finalistas: escolhidos, pulados };
}

export function apurarIndicacao(contagens: Contagem[], ctx: Contexto): ApuracaoIndicacao {
  const limiar = ctx.limiar ?? 0.8;
  const minimo = minimoPara(limiar, ctx.presentes);
  const ordenados = ordenar(contagens.filter((c) => c.votos > 0));
  const fam = new Familias(ctx.familiasOcupadas);
  const pulados: Pulado[] = [];

  const acima = ordenados.filter((c) => c.votos >= minimo);
  const eleitos = preencher(acima, ctx.vagasRestantes, fam, pulados);
  const vagasRestantes = ctx.vagasRestantes - eleitos.length;

  const eleitosIds = new Set(eleitos.map((e) => e.membroId));
  const candidatosVotacao: Contagem[] = [];
  if (vagasRestantes > 0) {
    for (const c of ordenados) {
      if (eleitosIds.has(c.membroId)) continue;
      const dono = fam.dono(c);
      if (dono) {
        if (!pulados.some((p) => p.contagem.membroId === c.membroId)) {
          pulados.push({ contagem: c, motivo: "familia", por: dono });
        }
        continue;
      }
      candidatosVotacao.push(c);
    }
  }

  return { minimoAclamacao: minimo, eleitos, pulados, candidatosVotacao, vagasRestantes };
}

/**
 * @param contagens TODOS os candidatos da cédula (com 0 para quem não recebeu voto).
 * @param turno 1 = exige maioria absoluta; 2+ = mais votados vencem.
 */
export function apurarVotacao(contagens: Contagem[], ctx: Contexto, turno: number): ApuracaoVotacao {
  const ordenados = ordenar(contagens);
  const fam = new Familias(ctx.familiasOcupadas);
  const pulados: Pulado[] = [];

  if (turno <= 1) {
    const minimo = maioriaAbsoluta(ctx.presentes);
    const acima = ordenados.filter((c) => c.votos >= minimo);
    const eleitos = preencher(acima, ctx.vagasRestantes, fam, pulados);
    const vagasRestantes = ctx.vagasRestantes - eleitos.length;
    let proximoTurno: Contagem[] = [];
    if (vagasRestantes > 0) {
      const ids = new Set(eleitos.map((e) => e.membroId));
      const resto = ordenados.filter((c) => !ids.has(c.membroId));
      const ocupadas = [...ctx.familiasOcupadas, ...eleitos.map((e) => e.familia)];
      const f = finalistas(resto, vagasRestantes * 2, ocupadas);
      proximoTurno = f.finalistas;
      for (const p of f.pulados) {
        if (!pulados.some((x) => x.contagem.membroId === p.contagem.membroId)) pulados.push(p);
      }
    }
    return { minimo, eleitos, pulados, proximoTurno, empate: false, vagasRestantes };
  }

  // 2º turno em diante: mais votados (sem mínimo), respeitando famílias.
  const validos: Contagem[] = [];
  for (const c of ordenados) {
    const dono = fam.dono(c);
    if (dono) {
      pulados.push({ contagem: c, motivo: "familia", por: dono });
      continue;
    }
    validos.push(c);
  }
  // Família repetida entre os próprios finalistas: fica o mais votado.
  const famTurno = new Familias([]);
  const unicos: Contagem[] = [];
  for (const c of validos) {
    const dono = famTurno.dono(c);
    if (dono) {
      pulados.push({ contagem: c, motivo: "familia", por: dono });
      continue;
    }
    famTurno.ocupar(c);
    unicos.push(c);
  }

  const vagas = ctx.vagasRestantes;
  if (unicos.length <= vagas) {
    return { minimo: 1, eleitos: unicos.filter((c) => c.votos > 0), pulados, proximoTurno: [], empate: false, vagasRestantes: vagas - unicos.filter((c) => c.votos > 0).length };
  }
  const corte = unicos[vagas - 1].votos;
  const proximo = unicos[vagas].votos;
  if (corte > proximo && corte > 0) {
    const eleitos = unicos.slice(0, vagas);
    return { minimo: 1, eleitos, pulados, proximoTurno: [], empate: false, vagasRestantes: 0 };
  }
  // Empate na última vaga: elege quem está acima do empate; empatados vão para nova rodada.
  const eleitos = unicos.filter((c) => c.votos > corte);
  const empatados = unicos.filter((c) => c.votos === corte);
  return { minimo: 1, eleitos, pulados, proximoTurno: empatados, empate: true, vagasRestantes: vagas - eleitos.length };
}
