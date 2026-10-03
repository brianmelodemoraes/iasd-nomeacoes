import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./backend";
import { mensagemErro } from "./api";
import type { Estado } from "./types";

/**
 * Estado ao vivo da sala. Busca uma vez e de novo a cada mudança no banco
 * (realtime), agrupando rajadas de eventos.
 */
export function useEstado(p: { codigo?: string | null; token?: string | null }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { codigo, token } = p;
  const pendente = useRef<number | null>(null);

  const buscar = useCallback(async () => {
    if (!codigo && !token) return;
    try {
      const e = await api.estado({ codigo: codigo ?? undefined, token: token ?? undefined });
      setEstado(e);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [codigo, token]);

  useEffect(() => {
    setEstado(null);
    void buscar();
  }, [buscar]);

  const sessaoId = estado?.sessao.id;
  useEffect(() => {
    if (!sessaoId) return;
    return api.assinar(sessaoId, () => {
      if (pendente.current) window.clearTimeout(pendente.current);
      pendente.current = window.setTimeout(() => void buscar(), 120);
    });
  }, [sessaoId, buscar]);

  return { estado, erro, recarregar: buscar };
}
