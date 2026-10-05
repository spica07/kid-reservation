/* 찜 목록. 브라우저 저장소가 막혀 있어도 앱은 그대로 돌고 찜만 빠진다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KRFavorites = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'kr-favorites';

  function createFavorites(storage) {
    let available = !!storage;
    let ids = [];
    if (available) {
      try {
        const parsed = JSON.parse(storage.getItem(KEY) || '[]');
        ids = Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
      } catch (e) {
        if (e instanceof SyntaxError) ids = [];
        else available = false;
      }
    }
    function save() {
      if (!available) return;
      try { storage.setItem(KEY, JSON.stringify(ids)); } catch (e) { /* 용량 초과 등: 메모리 상태만 유지 */ }
    }
    return {
      get available() { return available; },
      list: () => ids.slice(),
      has: id => ids.includes(id),
      toggle(id) {
        if (ids.includes(id)) ids = ids.filter(x => x !== id); else ids.push(id);
        save();
        return ids.includes(id);
      },
    };
  }

  return { createFavorites };
});
