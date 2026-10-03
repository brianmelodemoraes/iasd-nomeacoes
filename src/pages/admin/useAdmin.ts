import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/backend";
import type { Cargo, Eleito, Membro, MembroComissao } from "@/lib/types";

/** Dados do moderador para uma sessão, atualizados ao vivo. */
export function useAdmin(sessaoId: string) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [comissao, setComissao] = useState<MembroComissao[]>([]);
  const [eleitos, setEleitos] = useState<Eleito[]>([]);
  const [versao, setVersao] = useState(0);
  const pendente = useRef<number | null>(null);

  const recarregar = useCallback(async () => {
    const [cg, cm, el] = await Promise.all([api.cargos(sessaoId), api.comissao(sessaoId), api.eleitos(sessaoId)]);
    setCargos(cg);
    setComissao(cm);
    setEleitos(el);
    setVersao((v) => v + 1);
  }, [sessaoId]);

  const recarregarMembros = useCallback(async () => {
    setMembros(await api.membros(sessaoId));
  }, [sessaoId]);

  useEffect(() => {
    void recarregar();
    void recarregarMembros();
    return api.assinar(sessaoId, () => {
      if (pendente.current) window.clearTimeout(pendente.current);
      pendente.current = window.setTimeout(() => void recarregar(), 150);
    });
  }, [sessaoId, recarregar, recarregarMembros]);

  return { cargos, membros, comissao, eleitos, versao, recarregar, recarregarMembros };
}

export type DadosAdmin = ReturnType<typeof useAdmin>;
