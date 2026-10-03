\set ON_ERROR_STOP 1
-- Helpers de teste
create or replace function pg_temp.espera_erro(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlerrm like '%' || p_msg || '%' then raise notice 'OK erro esperado: %', p_msg; return; end if;
    raise exception 'erro errado: % (esperado %)', sqlerrm, p_msg;
  end;
  raise exception 'esperava erro % mas passou', p_msg;
end $$;

-- 1) Anônimo não cria sessão
set role anon; reset request.uid;
select pg_temp.espera_erro($$select public.nom_criar_sessao('X')$$, 'SEM_PERMISSAO');
reset role;

-- 2) Admin cria sessão, membros, comissão, cargos
set role authenticated; set request.uid = '00000000-0000-0000-0000-00000000000a';
create temp table t as select (public.nom_criar_sessao('Nomeações 2027'))::jsonb as s;
reset role;
grant select on t to anon, authenticated;
set role authenticated;
insert into nom_membros (sessao_id, nome, familia)
  select (s->>'id')::uuid, n, f from t, (values ('Ana Souza','souza'),('Bruno Souza','souza'),('Carla Lima','lima'),('Davi Rocha','rocha'),('Eva Prado','prado')) v(n,f);
insert into nom_comissao (sessao_id, nome) select (s->>'id')::uuid, 'Votante ' || g from t, generate_series(1,5) g;
insert into nom_cargos (sessao_id, ordem, nome, vagas, max_indicacoes) select (s->>'id')::uuid, 1, 'Anciãos', 2, 2 from t;
insert into nom_cargos (sessao_id, ordem, nome) select (s->>'id')::uuid, 2, 'Música' from t;
reset role;

-- 3) Anônimo não lê membros nem códigos nem votos
set role anon; reset request.uid;
do $$ begin
  if (select count(*) from nom_membros) <> 0 then raise exception 'anon leu membros'; end if;
  if (select count(*) from nom_sessao_codigos) <> 0 then raise exception 'anon leu codigo'; end if;
  if (select count(*) from nom_comissao) <> 5 then raise exception 'anon deveria ler comissao'; end if;
end $$;
select pg_temp.espera_erro($$insert into nom_cargos (sessao_id, nome) select (s->>'id')::uuid, 'hack' from t$$, 'row-level security');

-- 4) Entrar na sala
select pg_temp.espera_erro($$select public.nom_sala('ZZZZZZ')$$, 'SALA_NAO_ENCONTRADA');
create temp table tk (n int, token text);
do $$ declare v json; c record; i int := 0; codigo text := (select s->>'codigo' from t); begin
  for c in select id from nom_comissao order by nome loop
    i := i + 1;
    v := public.nom_entrar(lower(codigo), c.id, null);
    insert into tk values (i, v->>'token');
  end loop;
end $$;
-- nome já em uso sem token
select pg_temp.espera_erro(format($$select public.nom_entrar(%L, (select id from nom_comissao order by nome limit 1), null)$$, (select s->>'codigo' from t)), 'NOME_EM_USO');
-- reconectar com token ok
select (public.nom_entrar((select s->>'codigo' from t), (select id from nom_comissao order by nome limit 1), (select token from tk where n=1)))->>'nome' as reconectou;
do $$ begin if (select count(*) from public.nom_lista_membros((select token from tk where n=1))) <> 5 then raise exception 'lista'; end if; end $$;
select pg_temp.espera_erro($$select * from public.nom_lista_membros('falso')$$, 'TOKEN_INVALIDO');
reset role;

-- 5) Admin abre indicação dos anciãos (até 2 nomes)
set role authenticated; set request.uid = '00000000-0000-0000-0000-00000000000a';
create temp table rd as select public.nom_abrir_rodada((select id from nom_cargos where nome='Anciãos'), 'indicacao', 1, '{}', 2) as id;
reset role; grant select on rd to anon, authenticated; set role anon; reset request.uid;

-- 6) Votos
create temp table mb as select id, nome from public.nom_lista_membros((select token from tk where n=1));
select public.nom_votar((select token from tk where n=1), (select id from rd), array[(select id from mb where nome='Ana Souza'), (select id from mb where nome='Carla Lima')]);
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=1), (select id from rd), array[(select id from mb where nome='Ana Souza')])$$, 'JA_VOTOU');
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=2), (select id from rd), '{}')$$, 'ESCOLHA_OBRIGATORIA');
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=2), (select id from rd), array(select id from mb limit 3))$$, 'ESCOLHAS_DEMAIS');
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=2), (select id from rd), array[(select id from mb where nome='Ana Souza'),(select id from mb where nome='Ana Souza')])$$, 'ESCOLHA_REPETIDA');
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=2), (select id from rd), array[gen_random_uuid()])$$, 'CANDIDATO_INVALIDO');
select public.nom_votar((select token from tk where n=2), (select id from rd), array[(select id from mb where nome='Ana Souza'), (select id from mb where nome='Bruno Souza')]);
select public.nom_votar((select token from tk where n=3), (select id from rd), array[(select id from mb where nome='Ana Souza'), (select id from mb where nome='Bruno Souza')]);
select public.nom_votar((select token from tk where n=4), (select id from rd), array[(select id from mb where nome='Ana Souza'), (select id from mb where nome='Davi Rocha')]);
-- telão: contador sem resultado
do $$ declare e json := public.nom_estado((select s->>'codigo' from t)); begin
  if (e->'rodada'->>'votaram')::int <> 4 or (e->'rodada'->>'presentes')::int <> 5 then raise exception 'contador %', e; end if;
  if e->'rodada'->'resultado' is not null and json_typeof(e->'rodada'->'resultado') <> 'null' then raise exception 'vazou resultado'; end if;
end $$;
do $$ begin if (public.nom_estado(null, (select token from tk where n=4))->'eu'->>'ja_votou')::boolean is not true then raise exception 'ja_votou'; end if; end $$;
-- anônimo não lê votos e não chama resultado
do $$ begin if (select count(*) from nom_votos) <> 0 then raise exception 'anon leu votos'; end if; end $$;
select pg_temp.espera_erro($$select * from public.nom_resultado((select id from rd))$$, 'SEM_PERMISSAO');
reset role;

-- 7) Admin: contagem bloqueada com rodada aberta; encerra; vê; revela
set role authenticated; set request.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.espera_erro($$select * from public.nom_resultado((select id from rd))$$, 'RODADA_ABERTA');
select public.nom_encerrar_rodada((select id from rd));
select nome, votos from public.nom_resultado((select id from rd));
do $$ begin if (select count(*) from nom_votos) <> 0 then raise exception 'admin nao deveria ler votos direto'; end if; end $$;
reset role;
set role anon; reset request.uid;
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=5), (select id from rd), array[(select id from mb where nome='Ana Souza')])$$, 'RODADA_FECHADA');
reset role;
set role authenticated; set request.uid = '00000000-0000-0000-0000-00000000000a';
select public.nom_revelar_rodada((select id from rd));
select json_array_length(public.nom_estado((select s->>'codigo' from t))->'rodada'->'resultado') as itens_revelados;
-- elege Ana por aclamação (4/5 = 80%)
select public.nom_eleger((select id from nom_cargos where nome='Anciãos'), array[(select id from nom_membros where nome='Ana Souza')], 'aclamacao', false);
select pg_temp.espera_erro($$select public.nom_eleger((select id from nom_cargos where nome='Anciãos'), array(select id from nom_membros where nome in ('Carla Lima','Davi Rocha')), 'votacao', true)$$, 'VAGAS_EXCEDIDAS');
-- votação com candidatos
create temp table rv as select public.nom_abrir_rodada((select id from nom_cargos where nome='Anciãos'), 'votacao', 1, array(select id from nom_membros where nome in ('Carla Lima','Davi Rocha')), 1) as id;
reset role; grant select on rv to anon; set role anon; reset request.uid;
select pg_temp.espera_erro($$select public.nom_votar((select token from tk where n=1), (select id from rv), array[(select id from mb where nome='Eva Prado')])$$, 'CANDIDATO_INVALIDO');
select public.nom_votar((select token from tk where n=1), (select id from rv), array[(select id from mb where nome='Carla Lima')]);
do $$ declare e json := public.nom_estado((select s->>'codigo' from t)); begin
  if (e->'rodada'->>'numero')::int <> 2 or json_array_length(e->'rodada'->'candidatos') <> 2 then raise exception 'rodada 2 %', e; end if;
  if (select count(*) from json_array_elements(e->'cargos') c where c->>'nome'='Anciãos' and json_array_length(c->'eleitos')=1) <> 1 then raise exception 'eleitos'; end if;
end $$;
-- eleito_para aparece na lista
do $$ begin if not exists (select 1 from public.nom_lista_membros((select token from tk where n=1)) where nome='Ana Souza' and eleito_para = array['Anciãos']) then raise exception 'eleito_para'; end if; end $$;
reset role;

-- 8) Liberar participante e reiniciar cargo
set role authenticated; set request.uid = '00000000-0000-0000-0000-00000000000a';
select public.nom_liberar_participante((select id from nom_comissao order by nome limit 1), true);
select public.nom_reiniciar_cargo((select id from nom_cargos where nome='Anciãos'));
do $$ begin
  if exists (select 1 from nom_eleitos) or exists (select 1 from nom_rodadas) then raise exception 'reiniciar'; end if;
end $$;
reset role;
set role anon; reset request.uid;
select pg_temp.espera_erro($$select public.nom_estado(null, (select token from tk where n=1))$$, 'TOKEN_INVALIDO');
reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
