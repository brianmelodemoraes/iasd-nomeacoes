# Comissão de Nomeações · IASD Dr. Laurindo

Sistema ao vivo para a comissão de nomeações escolher os líderes do ano: indicação e votação
pelo celular, telão que reage em tempo real e painel do moderador.

| Tela | Endereço | Quem usa |
|---|---|---|
| Celular | `/?c=CÓDIGO` (QR code no telão) | Membros da comissão |
| Telão | `/telao/CÓDIGO` | Projetor (aperte o botão de tela cheia) |
| Moderador | `/admin` | Conta de administrador do site da igreja |

**Modo demonstração:** acrescente `?demo=1` a qualquer endereço (ex.: `/admin?demo=1`). Tudo roda no
navegador, sem banco. Abra moderador, telão e celular em abas do mesmo navegador: elas se sincronizam.
Use os botões "Todos entrarem" e "Simular votos" para ensaiar. `?demo=0` volta ao modo real.

## Regras

1. **Anciãos primeiro** (14 vagas; cada membro indica até 14 nomes; ajustável na aba Cargos).
2. **Indicação:** quem tiver **≥ 80% dos presentes** entra direto.
3. Sobrou vaga → **votação com todos os indicados** (o moderador pode tirar quem recusou).
   Entra quem tiver **mais de 50% dos presentes**.
4. Ainda sobrou vaga → **2º turno** entre os 2 mais votados por vaga (empatados no corte também entram).
   No 2º turno vence o mais votado; empate → nova rodada só entre os empatados.
5. **Família:** o mesmo cargo não pode ter duas pessoas do mesmo núcleo familiar. Fica o mais votado;
   o outro é pulado e entra o próximo de outra família.
6. **Já eleito para outro cargo:** pode ser indicado e votado, mas aparece o aviso "Já eleito(a): …".
7. **Voto secreto:** o banco guarda *quem já votou* e *em quem se votou* em tabelas separadas, sem ligação.
   Nem o moderador vê a contagem com a rodada aberta. Sem voto em branco.

As regras ficam em `src/lib/regras.ts` (testes em `src/lib/regras.test.ts`).

## Na reunião

1. **Antes:** em `/admin`, crie a reunião, importe os membros da igreja (`Nome; Família`, um por linha),
   cadastre a comissão e carregue os cargos padrão.
2. Projete `/telao/CÓDIGO`. Cada membro aponta a câmera para o QR code e toca no próprio nome.
3. Em **Conduzir**: *Abrir indicação* → *Encerrar rodada* → *Revelar no telão* → *Confirmar eleitos* →
   (*Abrir votação* / *2º turno*) → *Próximo cargo*.
4. No fim, a aba **Resultado final** exporta a planilha ou o PDF e mostra o quadro da nova liderança no telão.

Se alguém trocar de celular: aba **Comissão** → *Liberar celular*. Quem sai da reunião: desmarque *presente*.
A base dos 80% é o número de presentes.

## Técnica

- React + Vite + Tailwind. Backend: Supabase do projeto Lovable "Site & Boletim IASD Laurindo"
  (tabelas com prefixo `nom_`, sem mexer no resto do site).
- Banco: `supabase/migrations/20261003000000_nomeacoes.sql`. Testes do banco num Postgres local:
  `npm run test:sql` (precisa de `psql` com um usuário superusuário).
- Testes das regras: `npm test`. Verificação de tipos: `npm run typecheck`.

### Publicar no Cloudflare Pages

Ligue o repositório no Cloudflare Pages com:

- Build command: `npm run build`
- Output directory: `dist`
- Variáveis (já estão no `.env`, que é público por natureza): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

O arquivo `public/_redirects` faz as rotas `/telao/…` e `/admin` funcionarem.
