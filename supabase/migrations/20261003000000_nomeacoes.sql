-- =====================================================================
-- Comissão de Nomeações — IASD Dr. Laurindo
-- Tabelas com prefixo nom_ (isoladas do resto do site).
--
-- Sigilo do voto: nom_votou registra QUEM já votou numa rodada;
-- nom_votos registra EM QUEM se votou, sem nenhuma ligação com o votante
-- (sem comissao_id e sem horário). Ninguém consegue cruzar as duas.
--
-- Escrita dos membros da comissão: só pelas funções nom_entrar / nom_votar
-- (security definer), autenticadas por um token guardado no celular.
-- Escrita do moderador: usuário logado com papel 'admin' (has_role).
-- =====================================================================

-- ---------- Tabelas ----------

create table public.nom_sessoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'preparando'
    check (status in ('preparando', 'aberta', 'encerrada')),
  cargo_atual_id uuid,
  rodada_atual_id uuid,
  limiar_aclamacao numeric not null default 0.8
    check (limiar_aclamacao > 0 and limiar_aclamacao <= 1),
  created_at timestamptz not null default now()
);

-- Código da sala separado: a tabela de sessões é pública (realtime),
-- o código não pode ser.
create table public.nom_sessao_codigos (
  sessao_id uuid primary key references public.nom_sessoes(id) on delete cascade,
  codigo text not null unique
);

-- Membros da igreja (quem pode ser indicado). familia = chave do núcleo familiar.
create table public.nom_membros (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  nome text not null,
  familia text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index nom_membros_sessao_idx on public.nom_membros (sessao_id);

-- Membros da comissão (quem vota).
create table public.nom_comissao (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  nome text not null,
  presente boolean not null default false,
  entrou_em timestamptz,
  created_at timestamptz not null default now()
);
create index nom_comissao_sessao_idx on public.nom_comissao (sessao_id);

create table public.nom_comissao_tokens (
  comissao_id uuid primary key references public.nom_comissao(id) on delete cascade,
  token_hash text not null unique
);

create table public.nom_cargos (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  ordem integer not null default 0,
  nome text not null,
  cor text not null default '#1B2A44',
  vagas integer not null default 1 check (vagas >= 1),
  max_indicacoes integer not null default 1 check (max_indicacoes >= 1),
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido')),
  created_at timestamptz not null default now()
);
create index nom_cargos_sessao_idx on public.nom_cargos (sessao_id, ordem);

create table public.nom_rodadas (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  cargo_id uuid not null references public.nom_cargos(id) on delete cascade,
  numero integer not null,
  tipo text not null check (tipo in ('indicacao', 'votacao')),
  turno integer not null default 1,
  status text not null default 'aberta'
    check (status in ('aberta', 'encerrada', 'revelada')),
  candidatos uuid[] not null default '{}',
  max_escolhas integer not null default 1 check (max_escolhas >= 1),
  presentes integer not null default 0,
  created_at timestamptz not null default now(),
  encerrada_em timestamptz
);
create index nom_rodadas_cargo_idx on public.nom_rodadas (cargo_id, numero);

alter table public.nom_sessoes
  add constraint nom_sessoes_cargo_fk foreign key (cargo_atual_id)
    references public.nom_cargos(id) on delete set null,
  add constraint nom_sessoes_rodada_fk foreign key (rodada_atual_id)
    references public.nom_rodadas(id) on delete set null;

-- Quem já votou (sem horário, para não permitir cruzamento).
create table public.nom_votou (
  rodada_id uuid not null references public.nom_rodadas(id) on delete cascade,
  comissao_id uuid not null references public.nom_comissao(id) on delete cascade,
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  primary key (rodada_id, comissao_id)
);

-- Em quem se votou (sem votante, sem horário).
create table public.nom_votos (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.nom_rodadas(id) on delete cascade,
  membro_id uuid not null references public.nom_membros(id) on delete cascade
);
create index nom_votos_rodada_idx on public.nom_votos (rodada_id);

create table public.nom_eleitos (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.nom_sessoes(id) on delete cascade,
  cargo_id uuid not null references public.nom_cargos(id) on delete cascade,
  membro_id uuid not null references public.nom_membros(id) on delete cascade,
  forma text not null check (forma in ('aclamacao', 'votacao', 'manual')),
  created_at timestamptz not null default now(),
  unique (cargo_id, membro_id)
);

-- ---------- RLS ----------

alter table public.nom_sessoes enable row level security;
alter table public.nom_sessao_codigos enable row level security;
alter table public.nom_membros enable row level security;
alter table public.nom_comissao enable row level security;
alter table public.nom_comissao_tokens enable row level security;
alter table public.nom_cargos enable row level security;
alter table public.nom_rodadas enable row level security;
alter table public.nom_votou enable row level security;
alter table public.nom_votos enable row level security;
alter table public.nom_eleitos enable row level security;

-- Leitura pública só do que não é sensível (alimenta o realtime).
create policy "nom leitura publica" on public.nom_sessoes for select using (true);
create policy "nom leitura publica" on public.nom_comissao for select using (true);
create policy "nom leitura publica" on public.nom_cargos for select using (true);
create policy "nom leitura publica" on public.nom_rodadas for select using (true);
create policy "nom leitura publica" on public.nom_votou for select using (true);
create policy "nom leitura publica" on public.nom_eleitos for select using (true);

-- Moderador (admin) gerencia tudo.
create policy "nom admin" on public.nom_sessoes for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_sessao_codigos for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_membros for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_comissao for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_comissao_tokens for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_cargos for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_rodadas for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_votou for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
-- Votos: o admin só pode apagar (refazer rodada). A contagem sai por nom_resultado.
create policy "nom admin" on public.nom_votos for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "nom admin" on public.nom_eleitos for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ---------- Funções auxiliares ----------

create or replace function public.nom_hash(p_token text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

create or replace function public.nom_eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.has_role(auth.uid(), 'admin'), false)
$$;

create or replace function public.nom_exigir_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nom_eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
end $$;

-- Participante dono do token (ou null).
create or replace function public.nom_participante(p_token text)
returns public.nom_comissao language sql stable security definer set search_path = public as $$
  select c.* from public.nom_comissao c
  join public.nom_comissao_tokens t on t.comissao_id = c.id
  where t.token_hash = public.nom_hash(p_token)
$$;

-- Cargos para os quais um membro já foi eleito nesta sessão.
create or replace function public.nom_eleito_para(p_membro_id uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.nome order by c.ordem), '{}')
  from public.nom_eleitos e join public.nom_cargos c on c.id = e.cargo_id
  where e.membro_id = p_membro_id
$$;

create or replace function public.nom_gerar_codigo()
returns text language plpgsql volatile set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I
  v text;
begin
  loop
    v := '';
    for i in 1..6 loop
      v := v || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.nom_sessao_codigos where codigo = v);
  end loop;
  return v;
end $$;

-- ---------- Funções públicas (membro da comissão / telão) ----------

-- Tela de entrada: dados da sala + lista de nomes da comissão.
create or replace function public.nom_sala(p_codigo text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.nom_sessoes;
begin
  select ss.* into s from public.nom_sessoes ss
  join public.nom_sessao_codigos sc on sc.sessao_id = ss.id
  where sc.codigo = upper(trim(p_codigo));
  if s.id is null then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  return json_build_object(
    'sessao_id', s.id,
    'nome', s.nome,
    'status', s.status,
    'comissao', coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'nome', c.nome,
        'ocupado', exists (select 1 from public.nom_comissao_tokens t where t.comissao_id = c.id)
      ) order by c.nome)
      from public.nom_comissao c where c.sessao_id = s.id
    ), '[]'::json)
  );
end $$;

-- Membro da comissão escolhe o próprio nome. Devolve um token que fica no celular.
-- Se o nome já está em uso, só entra de novo com o mesmo token.
create or replace function public.nom_entrar(p_codigo text, p_comissao_id uuid, p_token text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s public.nom_sessoes;
  c public.nom_comissao;
  v_hash text;
  v_token text;
begin
  select ss.* into s from public.nom_sessoes ss
  join public.nom_sessao_codigos sc on sc.sessao_id = ss.id
  where sc.codigo = upper(trim(p_codigo));
  if s.id is null then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  if s.status = 'encerrada' then
    raise exception 'SALA_ENCERRADA';
  end if;

  select * into c from public.nom_comissao where id = p_comissao_id and sessao_id = s.id for update;
  if c.id is null then
    raise exception 'NOME_NAO_ENCONTRADO';
  end if;

  select token_hash into v_hash from public.nom_comissao_tokens where comissao_id = c.id;
  if v_hash is not null then
    if p_token is not null and v_hash = public.nom_hash(p_token) then
      v_token := p_token;
    else
      raise exception 'NOME_EM_USO';
    end if;
  else
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.nom_comissao_tokens (comissao_id, token_hash)
    values (c.id, public.nom_hash(v_token));
  end if;

  update public.nom_comissao set presente = true, entrou_em = coalesce(entrou_em, now())
  where id = c.id;

  return json_build_object('token', v_token, 'comissao_id', c.id, 'sessao_id', s.id, 'nome', c.nome);
end $$;

-- Lista de membros para a busca no celular (com aviso "já eleito para ...").
create or replace function public.nom_lista_membros(p_token text)
returns table (id uuid, nome text, eleito_para text[])
language plpgsql stable security definer set search_path = public as $$
declare
  c public.nom_comissao;
begin
  c := public.nom_participante(p_token);
  if c.id is null then
    raise exception 'TOKEN_INVALIDO';
  end if;
  return query
    select m.id, m.nome, public.nom_eleito_para(m.id)
    from public.nom_membros m
    where m.sessao_id = c.sessao_id and m.ativo
    order by m.nome;
end $$;

-- Registra indicação ou voto. Secreto: grava "votou" e "votos" em tabelas separadas.
create or replace function public.nom_votar(p_token text, p_rodada_id uuid, p_membros uuid[])
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  c public.nom_comissao;
  r public.nom_rodadas;
  v_n integer;
begin
  c := public.nom_participante(p_token);
  if c.id is null then
    raise exception 'TOKEN_INVALIDO';
  end if;
  if not c.presente then
    raise exception 'NAO_PRESENTE';
  end if;

  select * into r from public.nom_rodadas where id = p_rodada_id;
  if r.id is null or r.sessao_id <> c.sessao_id then
    raise exception 'RODADA_NAO_ENCONTRADA';
  end if;
  if r.status <> 'aberta' then
    raise exception 'RODADA_FECHADA';
  end if;

  v_n := coalesce(array_length(p_membros, 1), 0);
  if v_n = 0 then
    raise exception 'ESCOLHA_OBRIGATORIA';
  end if;
  if v_n > r.max_escolhas then
    raise exception 'ESCOLHAS_DEMAIS';
  end if;
  if (select count(distinct x) from unnest(p_membros) x) <> v_n then
    raise exception 'ESCOLHA_REPETIDA';
  end if;

  if r.tipo = 'votacao' then
    if not (p_membros <@ r.candidatos) then
      raise exception 'CANDIDATO_INVALIDO';
    end if;
  else
    if (select count(*) from public.nom_membros m
        where m.id = any(p_membros) and m.sessao_id = c.sessao_id and m.ativo) <> v_n then
      raise exception 'CANDIDATO_INVALIDO';
    end if;
  end if;

  begin
    insert into public.nom_votou (rodada_id, comissao_id, sessao_id) values (r.id, c.id, r.sessao_id);
  exception when unique_violation then
    raise exception 'JA_VOTOU';
  end;

  insert into public.nom_votos (rodada_id, membro_id)
  select r.id, x from unnest(p_membros) x order by random();
end $$;

-- Estado completo da sala (telão e celular). Resultado só aparece depois de revelado.
create or replace function public.nom_estado(p_codigo text default null, p_token text default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.nom_sessoes;
  c public.nom_comissao;
  r public.nom_rodadas;
  v_codigo text;
  v_presentes integer;
  v_votaram integer;
  v_rodada json;
  v_eu json;
begin
  if p_token is not null then
    c := public.nom_participante(p_token);
    if c.id is null then
      raise exception 'TOKEN_INVALIDO';
    end if;
    select * into s from public.nom_sessoes where id = c.sessao_id;
  else
    select ss.* into s from public.nom_sessoes ss
    join public.nom_sessao_codigos sc on sc.sessao_id = ss.id
    where sc.codigo = upper(trim(p_codigo));
  end if;
  if s.id is null then
    raise exception 'SALA_NAO_ENCONTRADA';
  end if;
  select codigo into v_codigo from public.nom_sessao_codigos where sessao_id = s.id;

  select count(*) into v_presentes from public.nom_comissao where sessao_id = s.id and presente;

  if s.rodada_atual_id is not null then
    select * into r from public.nom_rodadas where id = s.rodada_atual_id;
    select count(*) into v_votaram from public.nom_votou where rodada_id = r.id;
    v_rodada := json_build_object(
      'id', r.id,
      'cargo_id', r.cargo_id,
      'numero', r.numero,
      'tipo', r.tipo,
      'turno', r.turno,
      'status', r.status,
      'max_escolhas', r.max_escolhas,
      'presentes', case when r.status = 'aberta' then v_presentes else r.presentes end,
      'votaram', v_votaram,
      'candidatos', coalesce((
        select json_agg(json_build_object(
          'id', m.id, 'nome', m.nome, 'eleito_para', public.nom_eleito_para(m.id)
        ) order by m.nome)
        from public.nom_membros m where m.id = any(r.candidatos)
      ), '[]'::json),
      'resultado', case when r.status = 'revelada' then coalesce((
        select json_agg(json_build_object('membro_id', x.membro_id, 'nome', m.nome, 'votos', x.votos)
                        order by x.votos desc, m.nome)
        from (select v.membro_id, count(*)::int as votos from public.nom_votos v
              where v.rodada_id = r.id group by v.membro_id) x
        join public.nom_membros m on m.id = x.membro_id
      ), '[]'::json) else null end
    );
  end if;

  if c.id is not null then
    v_eu := json_build_object(
      'comissao_id', c.id,
      'nome', c.nome,
      'presente', c.presente,
      'ja_votou', r.id is not null and exists (
        select 1 from public.nom_votou where rodada_id = r.id and comissao_id = c.id)
    );
  end if;

  return json_build_object(
    'sessao', json_build_object(
      'id', s.id, 'nome', s.nome, 'status', s.status, 'codigo', v_codigo,
      'cargo_atual_id', s.cargo_atual_id, 'limiar_aclamacao', s.limiar_aclamacao
    ),
    'comissao_total', (select count(*) from public.nom_comissao where sessao_id = s.id),
    'presentes', v_presentes,
    'cargos', coalesce((
      select json_agg(json_build_object(
        'id', cg.id, 'ordem', cg.ordem, 'nome', cg.nome, 'cor', cg.cor,
        'vagas', cg.vagas, 'max_indicacoes', cg.max_indicacoes, 'status', cg.status,
        'eleitos', coalesce((
          select json_agg(json_build_object('membro_id', m.id, 'nome', m.nome, 'forma', e.forma)
                          order by e.created_at)
          from public.nom_eleitos e join public.nom_membros m on m.id = e.membro_id
          where e.cargo_id = cg.id
        ), '[]'::json)
      ) order by cg.ordem, cg.nome)
      from public.nom_cargos cg where cg.sessao_id = s.id
    ), '[]'::json),
    'rodada', v_rodada,
    'eu', v_eu
  );
end $$;

-- ---------- Funções do moderador ----------

create or replace function public.nom_criar_sessao(p_nome text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid;
  v_codigo text;
begin
  perform public.nom_exigir_admin();
  insert into public.nom_sessoes (nome) values (p_nome) returning id into v_id;
  v_codigo := public.nom_gerar_codigo();
  insert into public.nom_sessao_codigos (sessao_id, codigo) values (v_id, v_codigo);
  return json_build_object('id', v_id, 'codigo', v_codigo);
end $$;

-- Contagem (só admin), depois de encerrar e antes de revelar no telão.
-- Com a rodada aberta a contagem fica bloqueada até para o moderador: senão ele
-- poderia cruzar "fulano acabou de votar" com o número que subiu.
create or replace function public.nom_resultado(p_rodada_id uuid)
returns table (membro_id uuid, nome text, familia text, votos integer, eleito_para text[])
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.nom_exigir_admin();
  if exists (select 1 from public.nom_rodadas r where r.id = p_rodada_id and r.status = 'aberta') then
    raise exception 'RODADA_ABERTA';
  end if;
  return query
    select m.id, m.nome, m.familia, count(*)::int, public.nom_eleito_para(m.id)
    from public.nom_votos v join public.nom_membros m on m.id = v.membro_id
    where v.rodada_id = p_rodada_id
    group by m.id, m.nome, m.familia
    order by count(*) desc, m.nome;
end $$;

create or replace function public.nom_abrir_rodada(
  p_cargo_id uuid, p_tipo text, p_turno integer, p_candidatos uuid[], p_max_escolhas integer
) returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  cg public.nom_cargos;
  v_id uuid;
  v_numero integer;
begin
  perform public.nom_exigir_admin();
  select * into cg from public.nom_cargos where id = p_cargo_id;
  if cg.id is null then
    raise exception 'CARGO_NAO_ENCONTRADO';
  end if;
  if p_tipo = 'votacao' and coalesce(array_length(p_candidatos, 1), 0) = 0 then
    raise exception 'SEM_CANDIDATOS';
  end if;

  -- Fecha qualquer rodada ainda aberta da sessão.
  update public.nom_rodadas set status = 'encerrada', encerrada_em = now()
  where sessao_id = cg.sessao_id and status = 'aberta';

  select coalesce(max(numero), 0) + 1 into v_numero from public.nom_rodadas where cargo_id = cg.id;

  insert into public.nom_rodadas (sessao_id, cargo_id, numero, tipo, turno, candidatos, max_escolhas, presentes)
  values (cg.sessao_id, cg.id, v_numero, p_tipo, coalesce(p_turno, 1),
          case when p_tipo = 'votacao' then p_candidatos else '{}' end,
          greatest(1, p_max_escolhas),
          (select count(*) from public.nom_comissao where sessao_id = cg.sessao_id and presente))
  returning id into v_id;

  update public.nom_cargos set status = 'em_andamento' where id = cg.id and status = 'pendente';
  update public.nom_sessoes set cargo_atual_id = cg.id, rodada_atual_id = v_id, status = 'aberta'
  where id = cg.sessao_id;
  return v_id;
end $$;

-- Encerra: congela o total de presentes (base dos 80%).
create or replace function public.nom_encerrar_rodada(p_rodada_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  r public.nom_rodadas;
begin
  perform public.nom_exigir_admin();
  select * into r from public.nom_rodadas where id = p_rodada_id for update;
  if r.id is null then
    raise exception 'RODADA_NAO_ENCONTRADA';
  end if;
  if r.status = 'aberta' then
    update public.nom_rodadas set
      status = 'encerrada',
      encerrada_em = now(),
      presentes = greatest(
        (select count(*) from public.nom_comissao where sessao_id = r.sessao_id and presente),
        (select count(*) from public.nom_votou where rodada_id = r.id))
    where id = r.id;
  end if;
end $$;

create or replace function public.nom_revelar_rodada(p_rodada_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.nom_encerrar_rodada(p_rodada_id);
  update public.nom_rodadas set status = 'revelada' where id = p_rodada_id;
end $$;

-- Grava eleitos de um cargo (adiciona). p_concluir marca o cargo como concluído.
create or replace function public.nom_eleger(p_cargo_id uuid, p_membros uuid[], p_forma text, p_concluir boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  cg public.nom_cargos;
begin
  perform public.nom_exigir_admin();
  select * into cg from public.nom_cargos where id = p_cargo_id;
  if cg.id is null then
    raise exception 'CARGO_NAO_ENCONTRADO';
  end if;
  insert into public.nom_eleitos (sessao_id, cargo_id, membro_id, forma)
  select cg.sessao_id, cg.id, x, p_forma from unnest(coalesce(p_membros, '{}')) x
  on conflict (cargo_id, membro_id) do nothing;
  if (select count(*) from public.nom_eleitos where cargo_id = cg.id) > cg.vagas then
    raise exception 'VAGAS_EXCEDIDAS';
  end if;
  if p_concluir then
    update public.nom_cargos set status = 'concluido' where id = cg.id;
  end if;
end $$;

-- Desfaz um cargo inteiro (eleito recusou, erro etc.): apaga eleitos e rodadas.
create or replace function public.nom_reiniciar_cargo(p_cargo_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  cg public.nom_cargos;
begin
  perform public.nom_exigir_admin();
  select * into cg from public.nom_cargos where id = p_cargo_id;
  update public.nom_sessoes set rodada_atual_id = null
  where id = cg.sessao_id and rodada_atual_id in (select id from public.nom_rodadas where cargo_id = cg.id);
  delete from public.nom_eleitos where cargo_id = cg.id;
  delete from public.nom_rodadas where cargo_id = cg.id;
  update public.nom_cargos set status = 'pendente' where id = cg.id;
end $$;

-- Mostra um cargo no telão sem abrir rodada.
create or replace function public.nom_selecionar_cargo(p_cargo_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  cg public.nom_cargos;
  v_rodada uuid;
begin
  perform public.nom_exigir_admin();
  select * into cg from public.nom_cargos where id = p_cargo_id;
  if cg.id is null then
    raise exception 'CARGO_NAO_ENCONTRADO';
  end if;
  select id into v_rodada from public.nom_rodadas where cargo_id = cg.id order by numero desc limit 1;
  update public.nom_sessoes set cargo_atual_id = cg.id, rodada_atual_id = v_rodada where id = cg.sessao_id;
end $$;

-- Libera um nome (pessoa trocou de celular ou alguém escolheu o nome errado).
create or replace function public.nom_liberar_participante(p_comissao_id uuid, p_ausente boolean default true)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.nom_exigir_admin();
  delete from public.nom_comissao_tokens where comissao_id = p_comissao_id;
  if p_ausente then
    update public.nom_comissao set presente = false where id = p_comissao_id;
  end if;
end $$;

create or replace function public.nom_codigo(p_sessao_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  perform public.nom_exigir_admin();
  return (select codigo from public.nom_sessao_codigos where sessao_id = p_sessao_id);
end $$;

-- Funções internas não ficam expostas na API.
revoke execute on function public.nom_participante(text) from public, anon, authenticated;
revoke execute on function public.nom_gerar_codigo() from public, anon, authenticated;

-- ---------- Realtime ----------
alter table public.nom_sessoes replica identity full;
alter table public.nom_rodadas replica identity full;
alter publication supabase_realtime add table
  public.nom_sessoes, public.nom_comissao, public.nom_cargos,
  public.nom_rodadas, public.nom_votou, public.nom_eleitos;
