-- Sidra Tourism Web project ONLY: rcavyshsxnzodoipsbun.
-- New tables only; does not affect existing CRM, authentication, or other projects.
-- Apply after reviewing with the verified Sidra Supabase administrator.

create or replace function public.sidra_ops_is_owner() returns boolean
language sql stable security invoker set search_path = '' as $$
 select auth.uid() = '20f27d80-69ee-4915-aa70-39991c8e1a4f'::uuid
    and coalesce(auth.jwt()->>'email','') = 'admin@sidra-tourism.com';
$$;
revoke all on function public.sidra_ops_is_owner() from public;
grant execute on function public.sidra_ops_is_owner() to authenticated;

create table if not exists public.sidra_ops_enquiries (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null check(length(customer_name) between 2 and 90),
 customer_email text not null check(length(customer_email) between 3 and 254),
 service text not null check(service in ('flights','hotels','cars','transfers','holidays','experiences','other')),
 message text not null check(length(message) between 15 and 3000),
 status text not null default 'new' check(status in ('new','reviewing','quoted','closed')),
 admin_notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_bookings (
 id uuid primary key default gen_random_uuid(),
 service text not null check(service in ('flights','hotels','cars','transfers','holidays','experiences')),
 provider text not null,
 provider_booking_id text,
 reference text,
 ticket_number text,
 status text not null check(status in ('payment_pending','payment_confirmed','supplier_pending','ticket_pending','ticket_issued','payment_failed','failed','refunded','confirmed')),
 customer_name text,
 customer_email text,
 amount_minor bigint check(amount_minor>=0),
 currency char(3),
 payment_status text not null default 'unpaid',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_customers (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 email text not null,
 phone text,
 nationality text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_payments (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid references public.sidra_ops_bookings(id) on delete restrict,
 provider text not null,
 external_payment_id text,
 amount_minor bigint not null check(amount_minor>=0),
 currency char(3) not null,
 status text not null check(status in ('pending','succeeded','failed','refunded','disputed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_suppliers (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 product text not null,
 integration_status text not null default 'not_verified',
 notes text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_notifications (
 id uuid primary key default gen_random_uuid(),
 kind text not null,
 title text not null,
 message text not null,
 reference_id uuid,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_experiences (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 8 and 130),
 location text not null check(length(location) between 3 and 110),
 summary text not null check(length(summary) between 30 and 1200),
 duration text not null check(length(duration) between 3 and 70),
 status text not null default 'draft' check(status in ('draft','review','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.sidra_ops_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid,
 action text not null,
 reference_id uuid,
 summary text,
 created_at timestamptz not null default now()
);
create index if not exists idx_sidra_ops_enquiries_status_created on public.sidra_ops_enquiries(status,created_at desc);
create index if not exists idx_sidra_ops_bookings_created on public.sidra_ops_bookings(created_at desc);
create index if not exists idx_sidra_ops_notifications_created on public.sidra_ops_notifications(created_at desc);
create index if not exists idx_sidra_ops_experiences_created on public.sidra_ops_experiences(created_at desc);

-- Explicit row-level security. Authenticated customers never get admin read access.
alter table public.sidra_ops_enquiries enable row level security;
alter table public.sidra_ops_bookings enable row level security;
alter table public.sidra_ops_customers enable row level security;
alter table public.sidra_ops_payments enable row level security;
alter table public.sidra_ops_suppliers enable row level security;
alter table public.sidra_ops_notifications enable row level security;
alter table public.sidra_ops_experiences enable row level security;
alter table public.sidra_ops_audit enable row level security;

revoke all on public.sidra_ops_enquiries,public.sidra_ops_bookings,public.sidra_ops_customers,
 public.sidra_ops_payments,public.sidra_ops_suppliers,public.sidra_ops_notifications,
 public.sidra_ops_experiences,public.sidra_ops_audit from anon,authenticated;
grant select on public.sidra_ops_enquiries,public.sidra_ops_bookings,public.sidra_ops_customers,
 public.sidra_ops_payments,public.sidra_ops_suppliers,public.sidra_ops_notifications,
 public.sidra_ops_experiences,public.sidra_ops_audit to authenticated;
grant insert on public.sidra_ops_enquiries,public.sidra_ops_experiences to authenticated;
grant update(status,admin_notes,updated_at) on public.sidra_ops_enquiries to authenticated;
grant update(read_at) on public.sidra_ops_notifications to authenticated;

drop policy if exists sidra_owner_enquiries_select on public.sidra_ops_enquiries;
create policy sidra_owner_enquiries_select on public.sidra_ops_enquiries for select to authenticated using (public.sidra_ops_is_owner());
drop policy if exists sidra_owner_enquiries_insert on public.sidra_ops_enquiries;
create policy sidra_owner_enquiries_insert on public.sidra_ops_enquiries for insert to authenticated with check (public.sidra_ops_is_owner() and status='new');
drop policy if exists sidra_owner_enquiries_update on public.sidra_ops_enquiries;
create policy sidra_owner_enquiries_update on public.sidra_ops_enquiries for update to authenticated using(public.sidra_ops_is_owner()) with check(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_bookings_select on public.sidra_ops_bookings;
create policy sidra_owner_bookings_select on public.sidra_ops_bookings for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_customers_select on public.sidra_ops_customers;
create policy sidra_owner_customers_select on public.sidra_ops_customers for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_payments_select on public.sidra_ops_payments;
create policy sidra_owner_payments_select on public.sidra_ops_payments for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_suppliers_select on public.sidra_ops_suppliers;
create policy sidra_owner_suppliers_select on public.sidra_ops_suppliers for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_notifications_select on public.sidra_ops_notifications;
create policy sidra_owner_notifications_select on public.sidra_ops_notifications for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_notifications_update on public.sidra_ops_notifications;
create policy sidra_owner_notifications_update on public.sidra_ops_notifications for update to authenticated using(public.sidra_ops_is_owner()) with check(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_experiences_select on public.sidra_ops_experiences;
create policy sidra_owner_experiences_select on public.sidra_ops_experiences for select to authenticated using(public.sidra_ops_is_owner());
drop policy if exists sidra_owner_experiences_insert on public.sidra_ops_experiences;
create policy sidra_owner_experiences_insert on public.sidra_ops_experiences for insert to authenticated with check(public.sidra_ops_is_owner() and status='draft');
drop policy if exists sidra_owner_audit_select on public.sidra_ops_audit;
create policy sidra_owner_audit_select on public.sidra_ops_audit for select to authenticated using(public.sidra_ops_is_owner());

-- Atomic audit and admin inbox notification for newly logged enquiries.
create or replace function public.sidra_ops_enquiry_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.sidra_ops_audit(actor_id,action,reference_id,summary)
      values(auth.uid(),'enquiry.created',new.id,'New '||new.service||' enquiry logged');
    insert into public.sidra_ops_notifications(kind,title,message,reference_id)
      values('enquiry','New travel enquiry','A new '||new.service||' enquiry is awaiting review',new.id);
  elsif tg_op='UPDATE' and old.status is distinct from new.status then
    insert into public.sidra_ops_audit(actor_id,action,reference_id,summary)
      values(auth.uid(),'enquiry.status_changed',new.id,old.status||' → '||new.status);
    insert into public.sidra_ops_notifications(kind,title,message,reference_id)
      values('enquiry','Enquiry status updated','Enquiry moved to '||new.status,new.id);
  end if;
  return new;
end;$$;
revoke all on function public.sidra_ops_enquiry_audit() from public;
drop trigger if exists sidra_ops_enquiry_notifications on public.sidra_ops_enquiries;
create trigger sidra_ops_enquiry_notifications
 after insert or update of status on public.sidra_ops_enquiries
 for each row execute function public.sidra_ops_enquiry_audit();
