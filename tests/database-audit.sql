-- Executar em uma única transação; todos os fixtures são revertidos.
begin;
set local statement_timeout='30s';
select set_config('audit.base_count',(select count(*)::text from public.asg_datasets),true);
select set_config('audit.user_id',gen_random_uuid()::text,true);
select set_config('audit.session_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
values(current_setting('audit.user_id')::uuid,'auditoria-transacional@investepiaui.com',now(),now(),now());
insert into auth.sessions(id,user_id) values(current_setting('audit.session_id')::uuid,current_setting('audit.user_id')::uuid);
update public.staff_profiles set role='admin' where id=current_setting('audit.user_id')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.user_id'),'role','authenticated','session_id',current_setting('audit.session_id'))::text,true);
set local role anon;
do $$begin
 begin perform 1 from public.asg_datasets;raise exception 'FAIL: anon consultou base';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
do $$declare p jsonb;ref date; before_count integer; idx integer; bad jsonb;begin
 if not private.staff_access('admin') then raise exception 'FAIL: admin legítimo bloqueado';end if;
 select payload,reference_date into p,ref from public.asg_datasets limit 1;
 if p is null then raise exception 'FAIL: admin não leu snapshot';end if;
 select count(*) into before_count from public.asg_datasets;
 insert into public.asg_datasets(source_name,reference_date,payload,created_at) values('Teste transacional válido',ref,p,'2000-01-01');
 if not exists(select 1 from public.asg_datasets where source_name='Teste transacional válido' and created_by=auth.uid() and created_at>now()-interval '1 minute') then raise exception 'FAIL: autoria/data de importação';end if;
 begin insert into public.asg_datasets(source_name,reference_date,payload) values('inválido',ref,'{}');raise exception 'FAIL: payload inválido aceito';exception when check_violation then null;end;
 begin insert into public.asg_datasets(source_name,reference_date,payload) values('data divergente',ref+1,p);raise exception 'FAIL: data divergente aceita';exception when check_violation then null;end;
 begin insert into public.asg_datasets(source_name,reference_date,payload) values('duplicado',ref,jsonb_set(p,'{Indicadores}',(p->'Indicadores')||jsonb_build_array(p->'Indicadores'->2)));raise exception 'FAIL: duplicado aceito';exception when check_violation then null;end;
 select ordinality-1 into idx from jsonb_array_elements(p->'Indicadores') with ordinality where value->>0='IND-27';
 bad:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(p,array['Indicadores',idx::text,'7'],'0'),array['Indicadores',idx::text,'10'],'0'),array['Indicadores',idx::text,'15'],'"Crítico"'),array['Indicadores',idx::text,'18'],'20');
 begin insert into public.asg_datasets(source_name,reference_date,payload) values('razão internamente válida mas vínculo falso',ref,bad);raise exception 'FAIL: vínculo auxiliar falso aceito';exception when check_violation then null;end;
 begin update public.asg_datasets set source_name='alteração';raise exception 'FAIL: snapshot alterado';exception when insufficient_privilege then null;end;
 begin delete from public.asg_datasets;raise exception 'FAIL: snapshot removido';exception when insufficient_privilege then null;end;
 begin update public.staff_profiles set role='admin';raise exception 'FAIL: perfil alterável pelo cliente';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.staff_profiles set role='viewer' where id=current_setting('audit.user_id')::uuid;
set local role authenticated;
do $$declare p jsonb;ref date;begin
 if not private.staff_access() or private.staff_access('admin') then raise exception 'FAIL: role viewer';end if;
 select payload,reference_date into p,ref from public.asg_datasets limit 1;
 begin insert into public.asg_datasets(source_name,reference_date,payload) values('viewer não pode importar',ref,p);raise exception 'FAIL: viewer importou';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.staff_profiles set active=false where id=current_setting('audit.user_id')::uuid;
set local role authenticated;
do $$begin if private.staff_access() or exists(select 1 from public.asg_datasets) then raise exception 'FAIL: inativo lê dados';end if;end$$;
reset role;
update public.staff_profiles set active=true where id=current_setting('audit.user_id')::uuid;
update auth.users set email_confirmed_at=null where id=current_setting('audit.user_id')::uuid;
set local role authenticated;
do $$begin if private.staff_access() or exists(select 1 from public.asg_datasets) then raise exception 'FAIL: e-mail não confirmado lê dados';end if;end$$;
reset role;
update auth.users set email_confirmed_at=now() where id=current_setting('audit.user_id')::uuid;
delete from auth.sessions where id=current_setting('audit.session_id')::uuid;
set local role authenticated;
do $$begin if private.staff_access() or exists(select 1 from public.asg_datasets) then raise exception 'FAIL: sessão revogada lê dados';end if;end$$;
reset role;
do $$begin
 begin insert into auth.users(id,email) values(gen_random_uuid(),'auditoria@fora.invalid');raise exception 'FAIL: domínio externo aceito';exception when raise_exception then if sqlerrm='FAIL: domínio externo aceito' then raise;end if;end;
end$$;
select 'APROVADO: anon, admin, viewer, inativo, não confirmado, sessão revogada, domínio, payload, data-base, duplicados, vínculo auxiliar, imutabilidade, autoria e perfil. Tudo será revertido.' as resultado;
rollback;
