import type { Api } from "./api";
import { demoApi } from "./demoApi";
import { supabaseApi, supabaseConfigurado } from "./supabaseApi";

const CHAVE_MODO = "nomeacoes-modo-demo";

/** ?demo=1 liga o modo demonstração neste navegador; ?demo=0 desliga. */
function modoDemo(): boolean {
  const q = new URLSearchParams(window.location.search).get("demo");
  try {
    if (q === "1") localStorage.setItem(CHAVE_MODO, "1");
    if (q === "0") localStorage.removeItem(CHAVE_MODO);
    return !supabaseConfigurado || localStorage.getItem(CHAVE_MODO) === "1";
  } catch {
    return !supabaseConfigurado || q === "1";
  }
}

export const api: Api = modoDemo() ? demoApi : supabaseApi;
export const emDemo = api.modo === "demo";
