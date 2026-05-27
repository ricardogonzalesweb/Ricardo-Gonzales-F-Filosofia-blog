create extension if not exists pgcrypto;

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null check (status in ('pending','active','unsubscribed')) default 'pending',
  confirm_token text,
  consent_at timestamptz,
  source text default 'site',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  consent boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  email text,
  event_type text not null,
  provider text not null default 'resend',
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists post_comments_leads (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  post_title text not null,
  name text not null,
  email text not null,
  comment text not null,
  consent boolean not null default false,
  source text not null default 'post-comment',
  ip_hash text,
  created_at timestamptz not null default now()
);
