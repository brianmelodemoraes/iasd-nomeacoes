#!/usr/bin/env bash
# Testa a migração num banco descartável: ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=nom_teste_$$
psql -q -v ON_ERROR_STOP=1 -c "create database $DB" postgres
trap 'psql -q -c "drop database if exists $DB" postgres >/dev/null' EXIT
psql -q -v ON_ERROR_STOP=1 -f supabase/tests/00_stub_supabase.sql "$DB"
psql -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261003000000_nomeacoes.sql "$DB"
psql -v ON_ERROR_STOP=1 -f supabase/tests/10_fluxo.sql "$DB"
