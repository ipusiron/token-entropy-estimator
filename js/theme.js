// ライト／ダークの切り替え（通常のスクリプト。globalThis.TokenTheme に置く）
(function (root) {
  'use strict';
  const KEY = 'token-entropy-estimator-theme';

  function current() {
    const set = document.documentElement.getAttribute('data-theme');
    if (set === 'dark' || set === 'light') return set;
    return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ボタンの表示と読み上げ（次に切り替わる先）を、いまのテーマに合わせる
  function refresh(button, t) {
    const dark = current() === 'dark';
    button.textContent = dark ? '☀' : '☾';
    const label = t(dark ? 'ui.themeToLight' : 'ui.themeToDark');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function init(button, t, onChange = () => {}) {
    refresh(button, t);
    button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        // 保存できなくても切り替えは効く
      }
      refresh(button, t);
      onChange(next);
    });
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => refresh(button, t));
  }

  root.TokenTheme = { init, refresh, current };
})(typeof globalThis !== 'undefined' ? globalThis : this);
