-- Complemento aditivo. Aplicado somente após conferir as linhas existentes.
-- Nenhum snapshot existente é atualizado ou excluído.
begin;
create or replace function private.valid_asg_payload(p jsonb, ref date) returns boolean
language plpgsql immutable set search_path = '' as $$
declare n text; r jsonb; c jsonb; k integer; ids text[]; found integer; v text; d text; expected numeric; stat text; points numeric;
begin
 if pg_catalog.jsonb_typeof(p)<>'object' or pg_catalog.pg_column_size(p)>10485760 then return false; end if;
 foreach n in array array['Indicadores','Contratos_ASG','Parâmetros','Investidores','Canal_Denuncias','Riscos_Integridade','Comparativo_Empresas','Matriz_Materialidade'] loop
  if pg_catalog.jsonb_typeof(p->n) is distinct from 'array' then return false; end if;
  for r in select value from pg_catalog.jsonb_array_elements(p->n) loop
   if pg_catalog.jsonb_typeof(r)<>'array' then return false; end if;
  end loop;
 end loop;
 select count(*) into found from pg_catalog.jsonb_array_elements(p->'Parâmetros') as e(value) where e.value->>1='Data-base' and e.value->>2=ref::text;
 if found<>1 then return false; end if;
 foreach n in array array['Atende','Atenção','Crítico','Total de colaboradores','Receita líquida do período (R$ milhões)','Membros do conselho de administração','Horas trabalhadas no período','Médio a partir de (score residual)','Alto a partir de (score residual)','Crítico a partir de (score residual)','Prazo máximo de apuração (dias)','Prazo crítico / backlog (dias)'] loop
  select count(*) into found from pg_catalog.jsonb_array_elements(p->'Parâmetros') as e(value) where e.value->>1=n and pg_catalog.jsonb_typeof(e.value->2)='number' and (e.value->>2)::numeric>=0;
  if found<>1 then return false;end if;
 end loop;
 if p->'Contratos_ASG'->3->>0 is distinct from 'ID contrato' then return false; end if;
 ids:=array[]::text[];found:=0;
 for r in select value from pg_catalog.jsonb_array_elements(p->'Indicadores') where value->>0 like 'IND-%' loop
  found:=found+1;v:=r->>0;
  if v !~ '^IND-[0-9]+$' or v=any(ids) then return false; end if;ids:=array_append(ids,v);
  if coalesce(r->>3,'')='' or coalesce(r->>4,'')='' or coalesce(r->>5,'') not in ('A','A ÷ B','A ÷ B × 1.000','A ÷ B × 1.000.000') or coalesce(r->>12,'') not in ('Maior é melhor','Menor é melhor') then return false; end if;
  foreach k in array array[7,9,10,11,13,14,19] loop
   if r->k is not null and r->k<>'null'::jsonb and pg_catalog.jsonb_typeof(r->k)<>'number' then return false; end if;
  end loop;
  foreach k in array array[13,14,19] loop if pg_catalog.jsonb_typeof(r->k) is distinct from 'number' then return false; end if;end loop;
  if (r->>19)::numeric<0 then return false;end if;
  if (r->>12='Maior é melhor' and (r->>13)::numeric<(r->>14)::numeric) or (r->>12='Menor é melhor' and (r->>13)::numeric>(r->>14)::numeric) then return false;end if;
  if r->>26 is not null and r->>26 not in ('Ambiental (E)','Social (S)','Governança (G)') then return false;end if;
  expected:=null;
  if r->>7 is not null then
   if r->>5='A' then expected:=(r->>7)::numeric;
   elsif r->>9 is not null and (r->>9)::numeric<>0 then expected:=(r->>7)::numeric/(r->>9)::numeric*(case r->>5 when 'A ÷ B × 1.000' then 1000 when 'A ÷ B × 1.000.000' then 1000000 else 1 end);
   end if;
  end if;
  if (expected is null) is distinct from (r->>10 is null) then return false;end if;
  if expected is not null and abs(expected-(r->>10)::numeric)>0.000000001*(1+abs(expected)) then return false;end if;
  stat:=case when expected is null then 'Não calculável' when r->>12='Maior é melhor' then case when expected>=(r->>13)::numeric then 'Atende' when expected>=(r->>14)::numeric then 'Atenção' else 'Crítico' end else case when expected<=(r->>13)::numeric then 'Atende' when expected<=(r->>14)::numeric then 'Atenção' else 'Crítico' end end;
  if r->>15 is distinct from stat then return false;end if;
  points:=null;
  if expected is not null then select (e.value->>2)::numeric into points from pg_catalog.jsonb_array_elements(p->'Parâmetros') as e(value) where e.value->>1=stat;end if;
  if (r->>18)::numeric is distinct from points then return false;end if;

 end loop;
 if found=0 then return false;end if;
 ids:=array[]::text[];
 for r in select value from pg_catalog.jsonb_array_elements(p->'Contratos_ASG') where value->>0 like 'CT-%' loop
  v:=r->>0;
  if v=any(ids) or coalesce(r->>1,'')='' or coalesce(r->>2,'')='' or coalesce(r->>3,'') !~ '^[A-Z]{2}$' then return false;end if;ids:=array_append(ids,v);
  if pg_catalog.jsonb_typeof(r->4) is distinct from 'number' or (r->>4)::numeric<0 then return false;end if;
  if r->>14 is not null and (pg_catalog.jsonb_typeof(r->14)<>'number' or (r->>14)::numeric<0 or (r->>14)::numeric>100) then return false;end if;
  if r->>15 is not null and (pg_catalog.jsonb_typeof(r->15)<>'number' or (r->>15)::numeric<0 or (r->>15)::numeric<>floor((r->>15)::numeric)) then return false;end if;
  foreach k in array array[6,7,8,9,10,11,12,13] loop if r->>k is not null and r->>k not in ('Sim','Não') then return false;end if;end loop;
  d:=r->>16;if d is null or d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (d::date)::text<>d then return false;end if;
 end loop;
 ids:=array[]::text[];
 for r in select value from pg_catalog.jsonb_array_elements(p->'Comparativo_Empresas') where value->>0 like 'CT-%' loop
  v:=r->>0;if v=any(ids) then return false;end if;ids:=array_append(ids,v);
  select value into c from pg_catalog.jsonb_array_elements(p->'Contratos_ASG') where value->>0=v;
  if c is null then return false;end if;
  foreach k in array array[1,2,3,4] loop if r->k is distinct from c->k then return false;end if;end loop;
  if r->5 is distinct from c->14 or r->7 is distinct from c->6 or r->8 is distinct from c->12 or r->9 is distinct from c->13 or r->10 is distinct from c->5 then return false;end if;
  if r->>6 is distinct from (case when c->>14 is null then null when (c->>14)::numeric>=85 then 'Excelente' when (c->>14)::numeric>=70 then 'Adequado' else 'Crítico' end) then return false;end if;
 end loop;
 select count(*) into found from pg_catalog.jsonb_array_elements(p->'Contratos_ASG') where value->>0 like 'CT-%';
 if coalesce(array_length(ids,1),0)<>found then return false;end if;
 foreach n in array array['Investidores','Canal_Denuncias','Riscos_Integridade','Matriz_Materialidade'] loop
  ids:=array[]::text[];
  for r in select value from pg_catalog.jsonb_array_elements(p->n) where value->>0 ~ '^(INV-|DN-|RI-|TM-)' loop
   v:=r->>0;if v=any(ids) then return false;end if;ids:=array_append(ids,v);
   if n='Investidores' then
    foreach k in array array[3,4,9] loop if pg_catalog.jsonb_typeof(r->k) is distinct from 'number' or (r->>k)::numeric<0 then return false;end if;end loop;
    foreach k in array array[5,6,7,8] loop if r->>k is not null and r->>k not in ('Sim','Não') then return false;end if;end loop;
    if r->>10 is null or ((r->>10)::date)::text<>r->>10 then return false;end if;
   elsif n='Canal_Denuncias' then
    if r->>1 is null or ((r->>1)::date)::text<>r->>1 or (r->>1)::date>ref then return false;end if;
    if r->>7 is not null and (((r->>7)::date)::text<>r->>7 or (r->>7)::date<(r->>1)::date or (r->>7)::date>ref) then return false;end if;
    if r->>6='Concluída' and r->>7 is null then return false;end if;
   elsif n='Riscos_Integridade' then
    foreach k in array array[3,4] loop if pg_catalog.jsonb_typeof(r->k) is distinct from 'number' or (r->>k)::numeric not between 1 and 5 then return false;end if;end loop;
    if pg_catalog.jsonb_typeof(r->6) is distinct from 'number' or (r->>6)::numeric not between 0 and 1 or r->>11 is null or ((r->>11)::date)::text<>r->>11 then return false;end if;
   elsif n='Matriz_Materialidade' then
    foreach k in array array[4,5] loop if pg_catalog.jsonb_typeof(r->k) is distinct from 'number' or (r->>k)::numeric not between 1 and 5 then return false;end if;end loop;
    if coalesce(r->>8,'') not in ('Ambiental (E)','Social (S)','Governança (G)') then return false;end if;
    if r->>6 is distinct from (case when (r->>4)::numeric*(r->>5)::numeric>=20 then 'Alta' when (r->>4)::numeric*(r->>5)::numeric>=12 then 'Média' else 'Baixa' end) then return false;end if;
   end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
commit;
