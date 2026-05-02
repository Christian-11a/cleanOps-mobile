create table public.platform_config (
  updated_at timestamp with time zone not null default now(),
  updated_by uuid null,
  id integer not null,
  platform_fee_pct numeric not null default 15,
  max_active_jobs integer not null default 4,
  maintenance_mode boolean not null default false,
  constraint platform_config_pkey primary key (id),
  constraint platform_config_updated_by_fkey foreign KEY (updated_by) references profiles (id) on delete set null,
  constraint platform_config_id_check check ((id = 1))
) TABLESPACE pg_default;

create trigger trg_platform_config_updated_at BEFORE
update on platform_config for EACH row
execute FUNCTION set_updated_at ();