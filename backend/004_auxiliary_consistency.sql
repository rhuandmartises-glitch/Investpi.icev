begin;
create function private.valid_asg_auxiliary(p jsonb,ref date) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;
begin
 for r in select value from pg_catalog.jsonb_array_elements(p->'Contratos_ASG') where value->>0 like 'CT-%' loop
  if coalesce(r->>5,'') not in ('Alto','Médio','Baixo') then return false;end if;
 end loop;
 for r in select value from pg_catalog.jsonb_array_elements(p->'Investidores') where value->>0 like 'INV-%' loop
  if (r->>10)::date>ref then return false;end if;
 end loop;
 for r in select value from pg_catalog.jsonb_array_elements(p->'Canal_Denuncias') where value->>0 like 'DN-%' loop
  if coalesce(r->>6,'') not in ('Concluída','Em apuração') or coalesce(r->>9,'') not in ('Procedente','Pendente','Improcedente') then return false;end if;
  if r->>4 is not null and r->>4 not in ('Sim','Não') then return false;end if;
  if r->>11 is not null and r->>11 not in ('Sim','Não') then return false;end if;
  if (r->>6='Em apuração' and r->>7 is not null) or (r->>6='Concluída' and r->>9='Pendente') then return false;end if;
 end loop;
 for r in select value from pg_catalog.jsonb_array_elements(p->'Riscos_Integridade') where value->>0 like 'RI-%' loop
  if r->>9 is not null and r->>9 not in ('Sim','Não') then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_asg_auxiliary(jsonb,date) from public,anon;
grant execute on function private.valid_asg_auxiliary(jsonb,date) to authenticated;
alter table public.asg_datasets add constraint asg_datasets_auxiliary_integrity check(private.valid_asg_auxiliary(payload,reference_date));
commit;
