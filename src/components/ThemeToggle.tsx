import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { t, Lang } from '../lib/i18n';

type Theme = 'light' | 'dark';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeToggle() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('light');
  const [lang, setLang] = useState<Lang>('zh');

  useEffect(() => {
    setLang(getLang());
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ecompic-theme') : '';
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem('ecompic-theme', next);
  };

  const tr = t[lang];

  if (router.pathname === '/admin') return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? tr.switchLightMode : tr.switchDarkMode}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xl backdrop-blur hover:bg-white theme-toggle md:right-6"
    >
      {theme === 'dark' ? '☀️ ' + tr.themeLight : '🌙 ' + tr.themeDark}
    </button>
  );
}
