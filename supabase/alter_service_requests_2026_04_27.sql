-- FixNow: schema updates for newly collected request details
-- Run this in Supabase SQL editor (or psql) against your existing database.

begin;

-- 1) Add columns for recently added request details
alter table public.service_requests
  add column if not exists workers_needed integer,
  add column if not exists requester_phone_secondary text,
  add column if not exists distance_from_borella text,
  add column if not exists scheduled_dates date[] default '{}'::date[],
  add column if not exists needs_supervisor boolean not null default false,
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists attachment_urls text[] default '{}'::text[];

-- 2) Move data from metadata into the new columns (safe backfill)
update public.service_requests
set
  workers_needed = coalesce(workers_needed, nullif((metadata->>'workersNeeded')::int, 0)),
  requester_phone_secondary = coalesce(requester_phone_secondary, metadata->>'requesterPhoneSecondary'),
  distance_from_borella = coalesce(distance_from_borella, metadata->>'distanceFromBorella'),
  scheduled_dates = case
    when scheduled_dates is not null and cardinality(scheduled_dates) > 0 then scheduled_dates
    when jsonb_typeof(metadata->'scheduledDates') = 'array' then (
      select coalesce(array_agg(value::date order by value), '{}'::date[])
      from jsonb_array_elements_text(metadata->'scheduledDates') value
    )
    else scheduled_dates
  end,
  needs_supervisor = coalesce(needs_supervisor, (metadata->>'needsSupervisor')::boolean, false),
  terms_accepted = coalesce(terms_accepted, (metadata->>'termsAccepted')::boolean, false),
  attachment_urls = case
    when attachment_urls is not null and cardinality(attachment_urls) > 0 then attachment_urls
    when jsonb_typeof(metadata->'attachmentUrls') = 'array' then (
      select coalesce(array_agg(value order by value), '{}'::text[])
      from jsonb_array_elements_text(metadata->'attachmentUrls') value
    )
    else attachment_urls
  end;

-- 2.1) Normalize existing service_id values so new check constraints won't fail
with mapped_services as (
  select
    id,
    service_id as old_service_id,
    case
      when service_id = 'mechanic' then 'welder'
      when service_id = 'construction' then 'general-labor'
      when service_id = 'carpenter' then 'formwork-carpenter'
      when service_id = 'gardener' then 'steel-worker'
      when service_id in (
        'welder',
        'plumber',
        'electrician',
        'general-labor',
        'cleaner',
        'painter',
        'formwork-carpenter',
        'steel-worker',
        'mason',
        'ceiling-installer',
        'tile-fixer',
        'aluminum-door-window-technician',
        'bathroom-fitter',
        'ac-technician',
        'other'
      ) then service_id
      else 'other'
    end as normalized_service_id
  from public.service_requests
)
update public.service_requests r
set
  service_id = m.normalized_service_id,
  custom_service_name = case
    when m.normalized_service_id = 'other'
      and (r.custom_service_name is null or btrim(r.custom_service_name) = '')
    then initcap(replace(m.old_service_id, '-', ' '))
    else r.custom_service_name
  end
from mapped_services m
where r.id = m.id
  and (
    r.service_id is distinct from m.normalized_service_id
    or (
      m.normalized_service_id = 'other'
      and (r.custom_service_name is null or btrim(r.custom_service_name) = '')
    )
  );

-- 3) Refresh validation checks to match new app behavior
alter table public.service_requests drop constraint if exists service_requests_service_id_check;
alter table public.service_requests add constraint service_requests_service_id_check check (
  service_id in (
    'welder',
    'plumber',
    'electrician',
    'general-labor',
    'cleaner',
    'painter',
    'formwork-carpenter',
    'steel-worker',
    'mason',
    'ceiling-installer',
    'tile-fixer',
    'aluminum-door-window-technician',
    'bathroom-fitter',
    'ac-technician',
    'other'
  )
);

alter table public.service_requests drop constraint if exists service_requests_duration_check;
alter table public.service_requests add constraint service_requests_duration_check check (
  duration in ('half-day', 'full-day', 'two-days', 'three-days')
);

alter table public.service_requests drop constraint if exists distance_from_borella_check;
alter table public.service_requests add constraint distance_from_borella_check check (
  distance_from_borella is null
  or distance_from_borella in ('5km', '10km', '15km', '20km', 'more')
);

alter table public.service_requests drop constraint if exists workers_needed_check;
alter table public.service_requests add constraint workers_needed_check check (
  workers_needed is null or workers_needed between 1 and 50
);

alter table public.service_requests drop constraint if exists scheduled_date_required;
alter table public.service_requests add constraint scheduled_date_required check (
  urgency <> 'specific-date'
  or scheduled_date is not null
  or cardinality(coalesce(scheduled_dates, '{}'::date[])) > 0
);

-- 4) Helpful indexes
create index if not exists service_requests_distance_from_borella_idx
  on public.service_requests (distance_from_borella);

create index if not exists service_requests_workers_needed_idx
  on public.service_requests (workers_needed);

commit;
