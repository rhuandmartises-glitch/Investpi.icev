begin;
alter table public.asg_datasets add constraint asg_datasets_uncompressed_size check(octet_length(payload::text)<=10485760);
commit;
