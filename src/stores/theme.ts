import { defineStore } from 'pinia';
import { ref, computed, watchEffect } from 'vue';
import { applyTheme, type ThemePref, type ResolvedTheme } from '@/theme';

const STORAGE_KEY = 'devtracker-theme';

function loadPref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'auto' || v === 'dark' ? v : 'dark';
}

export const useThemeStore = defineStore('theme', () => {
  const pref = ref<ThemePref>(loadPref());

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const systemDark = ref(media.matches);
  media.addEventListener('change', (e) => { systemDark.value = e.matches; });

  const resolved = computed<ResolvedTheme>(() =>
    pref.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : pref.value
  );

  function setPref(p: ThemePref) {
    pref.value = p;
    localStorage.setItem(STORAGE_KEY, p);
  }

  // CSS 变量跟随主题
  watchEffect(() => applyTheme(resolved.value));

  return { pref, resolved, setPref };
});
