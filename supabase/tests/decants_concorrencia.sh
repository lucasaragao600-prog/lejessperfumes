#!/usr/bin/env bash
# Duas sessões pedem código FR ao mesmo tempo; nenhum código pode repetir. Nada é gravado (rollback).
set -e
for i in 1 2 3 4; do
  psql -Atq -c "BEGIN; SELECT 'FR-'||lpad(nextval('public.decant_frasco_seq')::text,6,'0'); ROLLBACK;" &
done | sort > /tmp/fr_codes.txt
wait
total=$(wc -l < /tmp/fr_codes.txt); unicos=$(sort -u /tmp/fr_codes.txt | wc -l)
echo "codigos=$total unicos=$unicos"
[ "$total" = "$unicos" ] && echo "CONCORRENCIA OK" || { echo "DUPLICADO"; exit 1; }
