-- Sidra Tourism, Doha — ADDITIVE FUTURE EVENT PIPELINE.
-- Apply only after admin/database/sidra_travel_operations.sql on the Sidra Supabase project.
-- NEVER execute in Time Logistics or IK databases.
-- No API keys, payments, airline orders or email sends are initiated by this migration.

create table if not exists public.sidra_ops_provider_events (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(length(provider) between 2 and 30),
 event_id text not null check(length(event_id) between 8 and 160),
 event_name text not null check(length(event_name) between 4 and 120),
 booking_id uuid references public.sidra_ops_bookings(id) on delete restrict,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 environment text not null check(environment in ('sandbox','production')),
 status text not null default 'received'
   check(status in ('received','validated','processed','ignored','failed')),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 unique (provider, event_id)
);
create index if not exists idx_sidra_ops_provider_events_booking on public.sidra_ops_provider_events(booking_id,received_at desc);

create table if not exists public.sidra_ops_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.sidra_ops_bookings(id) on delete restrict,
 source_event_id text not null check(length(source_event_id) between 8 and 160),
 destination text not null check(destination in ('customer','admin')),
 kind text not null check(kind in ('flight_ticket_issued','booking_status','payment_issue','schedule_change')),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 100),
 next_attempt_at timestamptz not null default now(),
 sent_at timestamptz,
 last_error_code text,
 created_at timestamptz not null default now(),
 unique (booking_id, source_event_id, destination)
);
create index if not exists idx_sidra_ops_notification_outbox_pending on public.sidra_ops_notification_outbox(status,next_attempt_at);

-- Require trusted server-side processing; public customers and ordinary authenticated
-- clients may not insert, update, or delete supplier events or notification jobs.
alter table public.sidra_ops_provider_events enable row level security;
alter table public.sidra_ops_notification_outbox enable row level security;
revoke all on public.sidra_ops_provider_events,public.sidra_ops_notification_outbox from anon,authenticated;
grant select on public.sidra_ops_provider_events,public.sidra_ops_notification_outbox to authenticated;

drop policy if exists sidra_owner_provider_events_read on public.sidra_ops_provider_events;
create policy sidra_owner_provider_events_read on public.sidra_ops_provider_events
 for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_outbox_read on public.sidra_ops_notification_outbox;
create policy sidra_owner_outbox_read on public.sidra_ops_notification_outbox
 for select to authenticated using(public.sidra_ops_is_owner());

-- A provider-confirmed ticket is only eligible to enter a notification outbox
-- once the financial ledger also records success. The outbox is not an email sender.
-- This trigger cannot be invoked from the public admin API because that API
-- only grants select on sidra_ops_bookings; trusted backend writers are required.
create or replace function public.sidra_ops_booking_status_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.sidra_ops_audit(actor_id,action,reference_id,summary)
    values(auth.uid(),'booking.status_changed',new.id,'Booking status: '||new.status);
    insert into public.sidra_ops_notifications(kind,title,message,reference_id)
    values('booking','Booking status updated','Booking has status '||new.status,new.id);
  end if;

  if new.status = 'ticket_issued'
     and new.payment_status = 'succeeded'
     and new.ticket_number is not null and length(new.ticket_number)>0
     and new.reference is not null and length(new.reference)>0
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into public.sidra_ops_notification_outbox
      (booking_id,source_event_id,destination,kind,status)
    values(new.id,'booking:'||new.id::text||':ticket_issued','customer','flight_ticket_issued','pending')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sidra_ops_booking_status_event() from public;
drop trigger if exists sidra_ops_booking_notification on public.sidra_ops_bookings;
create trigger sidra_ops_booking_notification
 after insert or update of status on public.sidra_ops_bookings
 for each row execute function public.sidra_ops_booking_status_event();

-- IMPORTANT: a separate approved worker must authenticate payment events and provider
-- booking data, store idempotency keys, and send the outbox only AFTER authoritative
-- GET booking confirmation. Do not process 'pending' jobs directly from an untrusted browser.
