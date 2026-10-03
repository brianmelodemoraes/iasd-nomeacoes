import { describe, expect, it } from "vitest";
import { apurarIndicacao, apurarVotacao, finalistas, minimoPara, maioriaAbsoluta, type Contagem } from "./regras";

const c = (nome: string, votos: number, familia: string | null = nome): Contagem => ({
  membroId: nome, nome, familia, votos,
});
const nomes = (l: Contagem[]) => l.map((x) => x.nome);

describe("limiares", () => {
  it("80% dos presentes", () => {
    expect(minimoPara(0.8, 20)).toBe(16);
    expect(minimoPara(0.8, 19)).toBe(16); // 15.2 → 16
    expect(minimoPara(0.8, 5)).toBe(4);
    expect(minimoPara(0.8, 15)).toBe(12);
  });
  it("maioria absoluta", () => {
    expect(maioriaAbsoluta(20)).toBe(11);
    expect(maioriaAbsoluta(19)).toBe(10);
  });
});

describe("indicação (cargo de 1 vaga)", () => {
  const ctx = { presentes: 20, vagasRestantes: 1, familiasOcupadas: [] };

  it("≥80% entra direto", () => {
    const r = apurarIndicacao([c("Ana", 16), c("Bia", 4)], ctx);
    expect(nomes(r.eleitos)).toEqual(["Ana"]);
    expect(r.candidatosVotacao).toEqual([]);
  });

  it("80% é sobre os presentes, não sobre quem indicou", () => {
    // 18 indicaram, 15 na Ana = 83% de quem indicou, mas 75% dos presentes
    const r = apurarIndicacao([c("Ana", 15), c("Bia", 3)], ctx);
    expect(r.eleitos).toEqual([]);
    expect(nomes(r.candidatosVotacao)).toEqual(["Ana", "Bia"]);
  });

  it("sem 80%: todos os indicados vão para votação", () => {
    const r = apurarIndicacao([c("Ana", 9), c("Bia", 6), c("Caio", 5), c("Zé", 0)], ctx);
    expect(nomes(r.candidatosVotacao)).toEqual(["Ana", "Bia", "Caio"]);
  });
});

describe("indicação dos anciãos (várias vagas)", () => {
  it("elege quem passou dos 80% e manda o resto para votação", () => {
    const r = apurarIndicacao(
      [c("A", 20), c("B", 18), c("C", 16), c("D", 10), c("E", 3)],
      { presentes: 20, vagasRestantes: 14, familiasOcupadas: [] },
    );
    expect(nomes(r.eleitos)).toEqual(["A", "B", "C"]);
    expect(r.vagasRestantes).toBe(11);
    expect(nomes(r.candidatosVotacao)).toEqual(["D", "E"]);
  });

  it("dois da mesma família acima de 80%: fica o mais votado", () => {
    const r = apurarIndicacao(
      [c("João Silva", 19, "silva"), c("Maria Silva", 17, "silva"), c("Paulo", 16)],
      { presentes: 20, vagasRestantes: 14, familiasOcupadas: [] },
    );
    expect(nomes(r.eleitos)).toEqual(["João Silva", "Paulo"]);
    expect(r.pulados.map((p) => [p.contagem.nome, p.por])).toEqual([["Maria Silva", "João Silva"]]);
    // e ela também não vai para a cédula do mesmo cargo
    expect(nomes(r.candidatosVotacao)).not.toContain("Maria Silva");
  });

  it("família já ocupada no cargo por eleito anterior", () => {
    const r = apurarIndicacao([c("Maria Silva", 20, "Silva ")], {
      presentes: 20, vagasRestantes: 3, familiasOcupadas: ["silva"],
    });
    expect(r.eleitos).toEqual([]);
    expect(r.pulados).toHaveLength(1);
  });

  it("não elege mais que as vagas", () => {
    const r = apurarIndicacao([c("A", 20), c("B", 20), c("C", 20)], {
      presentes: 20, vagasRestantes: 2, familiasOcupadas: [],
    });
    expect(nomes(r.eleitos)).toEqual(["A", "B"]);
    expect(r.vagasRestantes).toBe(0);
    expect(r.candidatosVotacao).toEqual([]);
  });

  it("família sem cadastro nunca conflita", () => {
    const r = apurarIndicacao([c("A", 20, null), c("B", 20, null)], {
      presentes: 20, vagasRestantes: 2, familiasOcupadas: [null],
    });
    expect(nomes(r.eleitos)).toEqual(["A", "B"]);
  });
});

describe("votação 1º turno", () => {
  const ctx = { presentes: 20, vagasRestantes: 1, familiasOcupadas: [] };

  it("mais de 50% dos presentes elege", () => {
    const r = apurarVotacao([c("Ana", 11), c("Bia", 9)], ctx, 1);
    expect(nomes(r.eleitos)).toEqual(["Ana"]);
    expect(r.proximoTurno).toEqual([]);
  });

  it("exatamente 50% não elege → 2º turno entre os 2 primeiros", () => {
    const r = apurarVotacao([c("Ana", 10), c("Bia", 6), c("Caio", 4)], ctx, 1);
    expect(r.eleitos).toEqual([]);
    expect(nomes(r.proximoTurno)).toEqual(["Ana", "Bia"]);
  });

  it("empate no 2º lugar leva todos os empatados", () => {
    const r = apurarVotacao([c("Ana", 8), c("Bia", 6), c("Caio", 6)], ctx, 1);
    expect(nomes(r.proximoTurno)).toEqual(["Ana", "Bia", "Caio"]);
  });

  it("finalistas da mesma família: pula para o próximo de outra família", () => {
    const r = apurarVotacao(
      [c("João Silva", 9, "silva"), c("Maria Silva", 7, "silva"), c("Paulo", 4)],
      ctx, 1,
    );
    expect(nomes(r.proximoTurno)).toEqual(["João Silva", "Paulo"]);
    expect(r.pulados[0].contagem.nome).toBe("Maria Silva");
  });

  it("anciãos: completa vagas e manda 2× as restantes para o 2º turno", () => {
    const r = apurarVotacao(
      [c("D", 15), c("E", 12), c("F", 9), c("G", 8), c("H", 7), c("I", 2)],
      { presentes: 20, vagasRestantes: 3, familiasOcupadas: [] },
      1,
    );
    expect(nomes(r.eleitos)).toEqual(["D", "E"]);
    expect(r.vagasRestantes).toBe(1);
    expect(nomes(r.proximoTurno)).toEqual(["F", "G"]);
  });
});

describe("votação 2º turno", () => {
  const ctx = { presentes: 20, vagasRestantes: 1, familiasOcupadas: [] };

  it("o mais votado vence, sem mínimo", () => {
    const r = apurarVotacao([c("Ana", 10), c("Bia", 9)], ctx, 2);
    expect(nomes(r.eleitos)).toEqual(["Ana"]);
    expect(r.empate).toBe(false);
  });

  it("empate → nova rodada entre os empatados", () => {
    const r = apurarVotacao([c("Ana", 10), c("Bia", 10)], ctx, 2);
    expect(r.eleitos).toEqual([]);
    expect(r.empate).toBe(true);
    expect(nomes(r.proximoTurno)).toEqual(["Ana", "Bia"]);
  });

  it("várias vagas com empate só na última", () => {
    const r = apurarVotacao(
      [c("A", 12), c("B", 8), c("C", 8), c("D", 2)],
      { presentes: 20, vagasRestantes: 2, familiasOcupadas: [] },
      2,
    );
    expect(nomes(r.eleitos)).toEqual(["A"]);
    expect(nomes(r.proximoTurno)).toEqual(["B", "C"]);
    expect(r.vagasRestantes).toBe(1);
  });
});

describe("finalistas()", () => {
  it("respeita famílias já ocupadas", () => {
    const f = finalistas([c("A", 5, "x"), c("B", 4, "y"), c("C", 3, "z")], 2, ["x"]);
    expect(nomes(f.finalistas)).toEqual(["B", "C"]);
  });
});
