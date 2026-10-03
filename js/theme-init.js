// 読み込みの最初に、保存したテーマを当てる（ちらつきを防ぐ）。localStorage が使えない環境でも止まらない
(function () {
  'use strict';
  try {
    const saved = localStorage.getItem('token-entropy-estimator-theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {
    // 保存できない環境では OS の設定に従う
  }
})();
