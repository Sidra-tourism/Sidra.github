import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../database/sidra_booking_events.sql',import.meta.url),'utf8').toLowerCase();
test('webhook events have a durable unique event identifier',()=>{
  assert.match(sql,/create table if not exists public\.sidra_ops_provider_events/);
  assert.match(sql,/unique\s*\(\s*provider\s*,\s*event_id\s*\)/);
  assert.match(sql,/processed_at timestamptz/);
});
test('notification outbox persists delivery and retries with uniqueness',()=>{
  assert.match(sql,/create table if not exists public\.sidra_ops_notification_outbox/);
  assert.match(sql,/attempt_count/);
  assert.match(sql,/unique\s*\(\s*booking_id\s*,\s*source_event_id\s*,\s*destination\s*\)/);
});
test('customer ticket notice must require issuer-confirmed ticket AND succeeded payment',()=>{
  assert.match(sql,/new\.status\s*=\s*'ticket_issued'/);
  assert.match(sql,/new\.payment_status\s*=\s*'succeeded'/);
  assert.match(sql,/new\.ticket_number\s+is not null/);
  assert.match(sql,/new\.reference\s+is not null/);
  assert.doesNotMatch(sql,/create policy .*ticket.*insert to authenticated/);
});
test('admin receives an alert when booking status changes',()=>{
  assert.match(sql,/insert into public\.sidra_ops_notifications/);
  assert.match(sql,/booking\.status_changed/);
});
test('operational service data is inaccessible to public clients',()=>{
  assert.match(sql,/alter table public\.sidra_ops_provider_events enable row level security/);
  assert.match(sql,/alter table public\.sidra_ops_notification_outbox enable row level security/);
  assert.match(sql,/revoke all on public\.sidra_ops_provider_events,public\.sidra_ops_notification_outbox from anon,authenticated/);
  assert.match(sql,/grant select on public\.sidra_ops_provider_events,public\.sidra_ops_notification_outbox to authenticated/);
  assert.doesNotMatch(sql,/grant\s+(insert|update|delete)\s+on public\.sidra_ops_notification_outbox to authenticated/);
});
