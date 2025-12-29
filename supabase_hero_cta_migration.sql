-- Optional migration: Hero buttons (CTAs)
-- Run this only if you want editable buttons on each home hero.

alter table public.heroes
  add column if not exists primary_cta_label text,
  add column if not exists primary_cta_href text,
  add column if not exists secondary_cta_label text,
  add column if not exists secondary_cta_href text;
