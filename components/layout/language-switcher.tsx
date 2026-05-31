'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'hi', label: 'हिन्दी',       flag: '🇮🇳' },
  { code: 'ko', label: '한국어',       flag: '🇰🇷' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0];

  async function selectLocale(code: string) {
    if (code === locale || saving) return;
    setSaving(true);
    setOpen(false);
    // Persist to cookie
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
    // Persist to DB
    await fetch('/api/user/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    }).catch(() => null);
    router.refresh();
    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0a0a0a] hover:border-[#0a0a0a]/40 transition-colors"
        disabled={saving}
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5 text-[#6b6b6b]" />
        <span>{current!.flag}</span>
        <span className="hidden sm:inline">{current!.label}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 bottom-full mb-2 z-50 w-44 rounded-xl border border-[#e0e0e0] bg-white shadow-lg overflow-hidden">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => selectLocale(lang.code)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors
                  ${lang.code === locale
                    ? 'bg-[#f5f5f5] font-semibold text-[#0a0a0a]'
                    : 'text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
                  }`}
              >
                <span className="text-sm">{lang.flag}</span>
                {lang.label}
                {lang.code === locale && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
