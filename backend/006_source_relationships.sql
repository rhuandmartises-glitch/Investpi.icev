begin;
create function private.valid_asg_relationships(p jsonb,ref date) returns boolean language plpgsql immutable set search_path='' as $$
declare prm jsonb; inputs jsonb:='{}'; r jsonb; key text; k integer; a numeric; b numeric; expected numeric; label text;
begin
 select jsonb_object_agg(e.value->>1,e.value->2) into prm from jsonb_array_elements(p->'Parâmetros') as e(value) where e.value->>1 is not null;
 if (select count(*) from jsonb_array_elements(p->'Parâmetros') as e(value) where e.value->>1 is not null)<>(select count(*) from jsonb_object_keys(prm)) then return false;end if;
 if coalesce(prm->>'Organização (fictícia)','')='' or coalesce(prm->>'Período de referência','')='' then return false;end if;
 for r in select value from jsonb_array_elements(p->'Indicadores') where value->>0 like 'IND%' loop if r->>0 !~ '^IND-[0-9]+$' then return false;end if;end loop;
 for r in select value from jsonb_array_elements(p->'Contratos_ASG') where value->>0 like 'CT%' loop if r->>0 !~ '^CT-[A-Za-z0-9_-]+$' then return false;end if;end loop;
 for k in 27..33 loop
  select case when count(*) filter(where e.value->>(k-21) is null)>0 then null else count(*) filter(where e.value->>(k-21)='Sim') end,count(*) into a,b from jsonb_array_elements(p->'Contratos_ASG') as e(value) where e.value->>0 like 'CT-%';
  inputs:=inputs||jsonb_build_object('IND-'||k,jsonb_build_array(a,b));
 end loop;
 select case when count(*) filter(where e.value->>7 is null)>0 then null else coalesce(sum((e.value->>4)::numeric) filter(where e.value->>7='Sim'),0) end,coalesce(sum((e.value->>4)::numeric),0) into a,b from jsonb_array_elements(p->'Contratos_ASG') as e(value) where e.value->>0 like 'CT-%';
 inputs:=inputs||jsonb_build_object('IND-34',jsonb_build_array(a,b));
 select case when count(*) filter(where e.value->>5='Alto' and e.value->>13 is null)>0 then null else count(*) filter(where e.value->>5='Alto' and e.value->>13='Sim') end,count(*) filter(where e.value->>5='Alto') into a,b from jsonb_array_elements(p->'Contratos_ASG') as e(value) where e.value->>0 like 'CT-%';
 inputs:=inputs||jsonb_build_object('IND-35',jsonb_build_array(a,b));
 select case when count(*) filter(where e.value->>15 is null)>0 then null else coalesce(sum((e.value->>15)::numeric),0) end into a from jsonb_array_elements(p->'Contratos_ASG') as e(value) where e.value->>0 like 'CT-%';
 inputs:=inputs||jsonb_build_object('IND-36',jsonb_build_array(a,null));
 select coalesce(sum((e.value->>4)::numeric*(e.value->>14)::numeric) filter(where e.value->>14 is not null),0),coalesce(sum((e.value->>4)::numeric) filter(where e.value->>14 is not null),0) into a,b from jsonb_array_elements(p->'Contratos_ASG') as e(value) where e.value->>0 like 'CT-%';
 inputs:=inputs||jsonb_build_object('IND-37',jsonb_build_array(a,b));
 for k in 39..41 loop
  select case when count(*) filter(where e.value->>(case k when 39 then 6 when 40 then 7 else 8 end) is null)>0 then null else count(*) filter(where e.value->>(case k when 39 then 6 when 40 then 7 else 8 end)='Sim') end,count(*) into a,b from jsonb_array_elements(p->'Investidores') as e(value) where e.value->>0 like 'INV-%';
  inputs:=inputs||jsonb_build_object('IND-'||k,jsonb_build_array(a,b));
 end loop;
 for r in select value from jsonb_array_elements(p->'Investidores') where value->>0 like 'INV-%' loop
  label:=case when extract(year from (r->>10)::date)=extract(year from ref) and extract(quarter from (r->>10)::date)=extract(quarter from ref) then 'Sim' else 'Não' end;
  if r->>7 is distinct from label then return false;end if;
 end loop;
 select coalesce(sum((e.value->>9)::numeric),0) into a from jsonb_array_elements(p->'Investidores') as e(value) where e.value->>0 like 'INV-%';
 inputs:=inputs||jsonb_build_object('IND-43',jsonb_build_array(a,null));
 select case when count(*) filter(where e.value->>5 is null)>0 then null else coalesce(sum((e.value->>3)::numeric) filter(where e.value->>5='Sim'),0) end,coalesce(sum((e.value->>3)::numeric),0) into a,b from jsonb_array_elements(p->'Investidores') as e(value) where e.value->>0 like 'INV-%';
 inputs:=inputs||jsonb_build_object('IND-44',jsonb_build_array(a,b));
 for r in select value from jsonb_array_elements(p->'Canal_Denuncias') where value->>0 like 'DN-%' loop
  if (r->>8)::integer is distinct from coalesce((r->>7)::date,ref)-(r->>1)::date then return false;end if;
 end loop;
 select case when count(*) filter(where e.value->>9='Procedente' and e.value->>10 is null)>0 then null else count(*) filter(where e.value->>9='Procedente' and e.value->>10<>'Nenhuma') end,count(*) filter(where e.value->>9='Procedente') into a,b from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-15',jsonb_build_array(a,b));
 select count(*) into a from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-53',jsonb_build_array(a,(prm->>'Total de colaboradores')::numeric));
 select count(*) filter(where e.value->>6='Concluída' and (e.value->>8)::numeric<=(prm->>'Prazo máximo de apuração (dias)')::numeric),count(*) filter(where e.value->>6='Concluída') into a,b from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-54',jsonb_build_array(a,b));
 select coalesce(sum((e.value->>8)::numeric) filter(where e.value->>6='Concluída'),0),count(*) filter(where e.value->>6='Concluída') into a,b from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-55',jsonb_build_array(a,b));
 select count(*) filter(where e.value->>6='Em apuração' and (e.value->>8)::numeric>(prm->>'Prazo crítico / backlog (dias)')::numeric),count(*) filter(where e.value->>6='Em apuração') into a,b from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-56',jsonb_build_array(a,b));
 select case when count(*) filter(where e.value->>6='Concluída' and e.value->>11 is null)>0 then null else count(*) filter(where e.value->>6='Concluída' and e.value->>11='Sim') end,count(*) filter(where e.value->>6='Concluída') into a,b from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-57',jsonb_build_array(a,b));
 select count(*) filter(where e.value->>2='Corrupção/Suborno' and e.value->>9='Procedente') into a from jsonb_array_elements(p->'Canal_Denuncias') as e(value) where e.value->>0 like 'DN-%';
 inputs:=inputs||jsonb_build_object('IND-59',jsonb_build_array(a,null));
 for r in select value from jsonb_array_elements(p->'Riscos_Integridade') where value->>0 like 'RI-%' loop
  expected:=(r->>3)::numeric*(r->>4)::numeric;
  if (r->>5)::numeric is distinct from expected then return false;end if;
  expected:=round(expected*(1-(r->>6)::numeric),1);
  if (r->>7)::numeric is distinct from expected then return false;end if;
  label:=case when expected>=(prm->>'Crítico a partir de (score residual)')::numeric then 'Crítico' when expected>=(prm->>'Alto a partir de (score residual)')::numeric then 'Alto' when expected>=(prm->>'Médio a partir de (score residual)')::numeric then 'Médio' else 'Baixo' end;
  if r->>8 is distinct from label then return false;end if;
 end loop;
 select case when count(*) filter(where e.value->>8 in ('Alto','Crítico') and e.value->>9 is null)>0 then null else count(*) filter(where e.value->>8 in ('Alto','Crítico') and e.value->>9='Sim') end,count(*) filter(where e.value->>8 in ('Alto','Crítico')) into a,b from jsonb_array_elements(p->'Riscos_Integridade') as e(value) where e.value->>0 like 'RI-%';
 inputs:=inputs||jsonb_build_object('IND-68',jsonb_build_array(a,b));
 select coalesce(sum((e.value->>7)::numeric),0),count(*) into a,b from jsonb_array_elements(p->'Riscos_Integridade') as e(value) where e.value->>0 like 'RI-%';
 inputs:=inputs||jsonb_build_object('IND-69',jsonb_build_array(a,b));
 for r in select value from jsonb_array_elements(p->'Indicadores') where value->>0 like 'IND-%' loop
  key:=r->>0;
  if inputs?key then
   if (r->>7 is null) is distinct from (inputs->key->>0 is null) or (r->>9 is null) is distinct from (inputs->key->>1 is null) then return false;end if;
   if abs((r->>7)::numeric-(inputs->key->>0)::numeric)>0.000000001*(1+abs((inputs->key->>0)::numeric)) or abs((r->>9)::numeric-(inputs->key->>1)::numeric)>0.000000001*(1+abs((inputs->key->>1)::numeric)) then return false;end if;
  end if;
  if key in ('IND-09','IND-10','IND-11','IND-14','IND-19','IND-60') and (r->>9)::numeric is distinct from (prm->>'Total de colaboradores')::numeric then return false;end if;
  if key='IND-46' and (r->>9)::numeric is distinct from (prm->>'Receita líquida do período (R$ milhões)')::numeric then return false;end if;
  if key='IND-48' and (r->>9)::numeric is distinct from (prm->>'Horas trabalhadas no período')::numeric then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_asg_relationships(jsonb,date) from public,anon;
grant execute on function private.valid_asg_relationships(jsonb,date) to authenticated;
alter table public.asg_datasets add constraint asg_datasets_source_relationships check(private.valid_asg_relationships(payload,reference_date));
commit;
