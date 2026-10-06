// タブの切り替え（WAI-ARIA のタブのパターン。通常のスクリプト。globalThis.TokenTabs に置く）
// クリック、左右の矢印キー、Home・End で移る。選ばれていないタブは tabindex=-1 にして、Tab キーではパネルへ進めるようにする
(function (root) {
  'use strict';
  const NAMES = ['single', 'batch', 'make', 'more'];

  // URL の #tab= か ?tab= から、開くタブの名前を読む（# を先に見る。知らない名前は null）
  function fromUrl(search, hash) {
    for (const part of [hash, search]) {
      const v = new URLSearchParams(String(part || '').replace(/^[?#]/, '')).get('tab');
      if (NAMES.includes(v)) return v;
    }
    return null;
  }

  // 押したキーから、次に選ぶタブの番号を決める（関係のないキーは null）
  function nextIndex(key, index, count) {
    if (key === 'ArrowRight') return (index + 1) % count;
    if (key === 'ArrowLeft') return (index - 1 + count) % count;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return null;
  }

  function init(nav, onChange) {
    const tabs = [...nav.querySelectorAll('[role="tab"]')];
    const panelOf = (tab) => nav.ownerDocument.getElementById(tab.getAttribute('aria-controls'));
    let current = null;

    function select(tab, focus) {
      for (const other of tabs) {
        const on = other === tab;
        other.setAttribute('aria-selected', String(on));
        other.tabIndex = on ? 0 : -1;
        panelOf(other).hidden = !on;
      }
      current = tab.dataset.tab;
      if (focus) tab.focus();
      if (onChange) onChange(current);
    }

    for (const tab of tabs) {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const i = nextIndex(e.key, tabs.indexOf(tab), tabs.length);
        if (i === null) return;
        e.preventDefault();
        select(tabs[i], true);
      });
    }
    select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], false);
    return {
      select: (name, focus) => select(tabs.find((t) => t.dataset.tab === name) || tabs[0], Boolean(focus)),
      current: () => current
    };
  }

  root.TokenTabs = { NAMES, fromUrl, nextIndex, init };
})(typeof globalThis !== 'undefined' ? globalThis : this);
