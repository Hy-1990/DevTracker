import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * 设计 token 单一来源（暗/亮双套）：
 * - applyTheme(mode) 注入为 CSS 变量，组件样式用 var(--xxx) 引用
 * - getOverrides(mode) 供 NConfigProvider，替代原来的全局 !important 覆盖
 * - getChartText(mode) 供 ECharts 文字配色
 */
export type ThemePref = 'dark' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'light';

type TokenSet = Record<string, string>;

const darkTokens: TokenSet = {
  // ── 表面 ──
  'bg-base': '#18191d',
  'bg-sider': '#131418',
  'bg-hover': '#1f2126',
  'bg-selected': '#1d2a37',
  'bg-selected-hover': '#233344',
  'bg-card': 'rgba(255,255,255,0.03)',
  'bg-card-strong': 'rgba(255,255,255,0.05)',
  'hover-overlay': 'rgba(255,255,255,0.05)',

  // ── 边框 ──
  'border-faint': 'rgba(255,255,255,0.04)',
  'border-soft': 'rgba(255,255,255,0.08)',
  'border-strong': 'rgba(255,255,255,0.13)',
  'table-divider': '#2a2c33',

  // ── 文字 ──
  'text-strong': '#e8eaef',
  'text-body': '#c9cdd6',
  'text-secondary': '#959db0',
  'text-muted': '#6d7585',
  'text-faint': '#4d5464',

  // ── 主色 ──
  'accent': '#5b94c4',
  'accent-strong': '#6ba5d6',
  'accent-dim': 'rgba(91,148,196,0.55)',
  'accent-faint': 'rgba(91,148,196,0.18)',
  'accent-focus-border': 'rgba(91,148,196,0.5)',

  // ── 数据色 ──
  'ok': '#2fbf9f',
  'warn': '#f4a261',
  'danger': '#ff2d55',

  // ── 杂项 ──
  'star-empty': '#3a3f4a',
  'scrollbar-thumb': 'rgba(255,255,255,0.1)',
  'scrollbar-thumb-hover': 'rgba(255,255,255,0.18)',
  'caution': '#e9c46a',
  'danger-soft-text': '#ff8a9e',
};

const lightTokens: TokenSet = {
  'bg-base': '#f5f6f8',
  'bg-sider': '#eceef2',
  'bg-hover': '#e9ebef',
  'bg-selected': '#dde9f5',
  'bg-selected-hover': '#d2e2f2',
  'bg-card': 'rgba(0,0,0,0.025)',
  'bg-card-strong': 'rgba(0,0,0,0.045)',
  'hover-overlay': 'rgba(0,0,0,0.045)',

  'border-faint': 'rgba(0,0,0,0.05)',
  'border-soft': 'rgba(0,0,0,0.09)',
  'border-strong': 'rgba(0,0,0,0.14)',
  'table-divider': '#d8dbe1',

  'text-strong': '#1c2330',
  'text-body': '#333a47',
  'text-secondary': '#5a6475',
  'text-muted': '#7d8696',
  'text-faint': '#a8aeba',

  'accent': '#3a78ad',
  'accent-strong': '#2f6898',
  'accent-dim': 'rgba(58,120,173,0.85)',
  'accent-faint': 'rgba(58,120,173,0.14)',
  'accent-focus-border': 'rgba(58,120,173,0.5)',

  'ok': '#1e8e76',
  'warn': '#d97a1f',
  'danger': '#e0244b',

  'star-empty': '#cfd3da',
  'scrollbar-thumb': 'rgba(0,0,0,0.18)',
  'scrollbar-thumb-hover': 'rgba(0,0,0,0.3)',
  'caution': '#a07d14',
  'danger-soft-text': '#c2334f',
};

/**
 * 人员标签配色：同一人固定色相，两种模式只翻转明度。
 * 暗色 = 深底亮字，浅色 = 浅底深字，各配同色系描边保证轮廓清晰。
 * 8 个色相在色环上错开，相邻 ID 颜色差异明显。
 */
const TAG_HUES = [155, 270, 35, 210, 330, 90, 180, 10];

for (let i = 0; i < TAG_HUES.length; i++) {
  const h = TAG_HUES[i];
  darkTokens[`tag-${i}-bg`] = `hsl(${h}, 32%, 23%)`;
  darkTokens[`tag-${i}-text`] = `hsl(${h}, 68%, 72%)`;
  darkTokens[`tag-${i}-border`] = `hsl(${h}, 35%, 34%)`;
  lightTokens[`tag-${i}-bg`] = `hsl(${h}, 70%, 92%)`;
  lightTokens[`tag-${i}-text`] = `hsl(${h}, 60%, 30%)`;
  lightTokens[`tag-${i}-border`] = `hsl(${h}, 50%, 78%)`;
}

export function tokensFor(mode: ResolvedTheme): TokenSet {
  return mode === 'dark' ? darkTokens : lightTokens;
}

export function applyTheme(mode: ResolvedTheme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokensFor(mode))) {
    root.style.setProperty(`--${k}`, v);
  }
}

function makeOverrides(t: TokenSet, surfaces: { card: string; modal: string; popover: string }): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: t['accent'],
      primaryColorHover: t['accent-strong'],
      primaryColorPressed: t['accent-strong'],
      primaryColorSuppl: t['accent'],
      bodyColor: t['bg-base'],
      cardColor: surfaces.card,
      modalColor: surfaces.modal,
      popoverColor: surfaces.popover,
      borderRadius: '8px',
      borderRadiusSmall: '5px',
      textColor1: t['text-strong'],
      textColor2: t['text-body'],
      textColor3: t['text-secondary'],
      dividerColor: t['border-soft'],
      borderColor: t['border-strong'],
      hoverColor: t['hover-overlay'],
    },
    // 输入框：无边框透明背景，聚焦时蓝色描边（原全局 !important 覆盖）
    Input: {
      color: 'transparent',
      colorFocus: t['accent-faint'],
      border: 'none',
      borderHover: 'none',
      borderFocus: `1px solid ${t['accent-focus-border']}`,
      boxShadowFocus: 'none',
      fontSizeMedium: '14px',
    },
    // 下拉选择同理
    InternalSelection: {
      color: 'transparent',
      border: 'none',
      borderHover: 'none',
      borderActive: `1px solid ${t['accent-focus-border']}`,
      borderFocus: `1px solid ${t['accent-focus-border']}`,
      boxShadowActive: 'none',
      boxShadowFocus: 'none',
      boxShadowHover: 'none',
      borderRadius: '5px',
    },
  };
}

const darkOverrides = makeOverrides(darkTokens, {
  card: '#1d1f24', modal: '#1f2126', popover: '#26282e',
});
const lightOverrides = makeOverrides(lightTokens, {
  card: '#ffffff', modal: '#ffffff', popover: '#ffffff',
});

export function getOverrides(mode: ResolvedTheme): GlobalThemeOverrides {
  return mode === 'dark' ? darkOverrides : lightOverrides;
}

/** ECharts 文字/图例配色，与 UI token 一致 */
export function getChartText(mode: ResolvedTheme) {
  const t = tokensFor(mode);
  return { label: t['text-body'], legend: t['text-secondary'] };
}
