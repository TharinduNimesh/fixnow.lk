create extension if not exists pgcrypto;

create or replace function public.generate_request_tracking_id()
returns text
language plpgsql
as $$
declare
  generated_code text;
begin
  loop
    generated_code := 'FN-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (
      select 1
      from public.service_requests
      where tracking_id = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.request_status as enum (
  'pending',
  'confirmed',
  'worker-assigned',
  'in-progress',
  'completed',
  'cancelled'
);

create type public.payment_method as enum (
  'card',
  'bank-transfer'
);

create type public.payment_status as enum (
  'pending',
  'initiated',
  'paid',
  'verified',
  'failed',
  'cancelled'
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique default public.generate_request_tracking_id(),
  requester_name text not null check (char_length(trim(requester_name)) between 2 and 120),
  requester_email text not null check (position('@' in requester_email) > 1),
  requester_phone text not null check (char_length(trim(requester_phone)) between 7 and 32),
  requester_address text not null check (char_length(trim(requester_address)) between 3 and 255),
  requester_city text not null check (char_length(trim(requester_city)) between 2 and 120),
  service_id text not null check (service_id in (
    'mechanic',
    'plumber',
    'electrician',
    'construction',
    'cleaner',
    'painter',
    'carpenter',
    'gardener',
    'other'
  )),
  custom_service_name text,
  urgency text not null check (urgency in ('within-hour', 'within-24h', 'specific-date')),
  scheduled_date date,
  duration text not null check (duration in ('half-day', 'full-day', 'two-days', 'three-days')),
  other_info text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  request_status public.request_status not null default 'pending',
  total_cost numeric(12,2) not null check (total_cost >= 0),
  currency text not null default 'LKR' check (currency in ('LKR', 'USD')),
  payhere_order_id text unique,
  payhere_payment_id text unique,
  payhere_status_code smallint,
  payhere_method text,
  receipt_path text,
  receipt_uploaded_at timestamptz,
  source_path text,
  client_ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_service_name_required check (
    service_id <> 'other' or char_length(coalesce(trim(custom_service_name), '')) > 0
  ),
  constraint scheduled_date_required check (
    urgency <> 'specific-date' or scheduled_date is not null
  )
);

create index if not exists service_requests_created_at_idx on public.service_requests (created_at desc);
create index if not exists service_requests_tracking_id_idx on public.service_requests (tracking_id);
create index if not exists service_requests_status_idx on public.service_requests (request_status);
create index if not exists service_requests_payment_status_idx on public.service_requests (payment_status);
create index if not exists service_requests_service_id_idx on public.service_requests (service_id);

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  event_type text not null,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists request_events_request_id_idx on public.request_events (request_id);
create index if not exists request_events_created_at_idx on public.request_events (created_at desc);

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
before update on public.service_requests
for each row
execute function public.set_updated_at();

alter table public.service_requests enable row level security;
alter table public.request_events enable row level security;

drop policy if exists "service requests are server managed" on public.service_requests;
create policy "service requests are server managed"
on public.service_requests
for all
to authenticated, anon
using (false)
with check (false);

drop policy if exists "request events are server managed" on public.request_events;
create policy "request events are server managed"
on public.request_events
for all
to authenticated, anon
using (false)
with check (false);
