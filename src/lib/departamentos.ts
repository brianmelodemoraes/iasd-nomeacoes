import type { NovoCargo } from "./types";

/**
 * Cargos padrão: anciãos primeiro, depois um líder por departamento.
 * Cores da paleta oficial do Manual de Marca IASD (mesma do gerador de artes).
 */
const DEPARTAMENTOS: [string, string][] = [
  ["Tesouraria", "#4d7549"],
  ["Secretaria", "#2f557f"],
  ["Diaconato Masculino", "#5e3929"],
  ["Diaconato Feminino", "#7f264a"],
  ["Escola Sabatina", "#3e8391"],
  ["Ministério da Criança", "#ffa92d"],
  ["Ministério dos Adolescentes", "#e36520"],
  ["Ministério Pessoal", "#003366"],
  ["Departamento de Música", "#4b207f"],
  ["Comunicação", "#3e8391"],
  ["Sonoplastia", "#2f557f"],
  ["Ministério Jovem", "#4b207f"],
  ["Desbravadores", "#448d21"],
  ["Aventureiros", "#ffa92d"],
  ["Ação Solidária", "#e36520"],
  ["Ministério da Mulher", "#7f264a"],
  ["Ministério do Acolhimento", "#3e8391"],
  ["Expansão Patrimonial", "#5e3929"],
  ["Mordomia Cristã", "#4d7549"],
  ["Espírito de Profecia", "#003366"],
  ["Educação", "#2f557f"],
  ["Ministério da Família / Melhor Idade", "#7f264a"],
  ["Saúde / Temperança", "#448d21"],
];

export const CARGOS_PADRAO: NovoCargo[] = [
  { ordem: 1, nome: "Anciãos", cor: "#2f557f", vagas: 14, max_indicacoes: 14 },
  ...DEPARTAMENTOS.map(([nome, cor], i) => ({ ordem: i + 2, nome, cor, vagas: 1, max_indicacoes: 1 })),
];

/** Cor clara (amarelo/laranja claro) pede texto escuro por cima. */
export function corClara(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}
