alter table public.workspaces
  add column if not exists branding jsonb default '{
    "primary_color": "#0a0a0a",
    "logo_url": null,
    "favicon_url": null,
    "app_name": "VoiceOS",
    "custom_css": null
  }';
