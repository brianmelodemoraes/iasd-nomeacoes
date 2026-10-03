import { emDemo } from "@/lib/backend";

/** Símbolo simplificado (chama sobre o livro aberto) + nome da igreja. */
export function Simbolo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="24" cy="24" r="22" />
      <path d="M24 9c3 5 6 8 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 5 0-4-1-7 0-11Z" />
      <path d="M11 33c5-2 9-1 13 2 4-3 8-4 13-2M13 37c4-1.5 7-1 11 1.5 4-2.5 7-3 11-1.5" />
    </svg>
  );
}

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${claro ? "text-papel" : "text-navy"}`}>
      <Simbolo className="h-8 w-8 opacity-80" />
      <span className="rotulo opacity-70">IASD Dr. Laurindo</span>
    </div>
  );
}

export function FaixaDemo() {
  if (!emDemo) return null;
  return (
    <div className="bg-ouro px-3 py-1 text-center text-xs font-semibold uppercase tracking-widest text-navy-950">
      Modo demonstração · nada aqui é real
    </div>
  );
}
