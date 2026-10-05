const test = require('node:test');
const assert = require('node:assert/strict');
const { createFavorites } = require('../assets/js/favorites.js');

function memStorage(init = {}) {
  const data = { ...init };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('토글로 추가·삭제하고 저장소에 남긴다', () => {
  const st = memStorage();
  const f = createFavorites(st);
  assert.equal(f.available, true);
  assert.equal(f.toggle('a'), true);
  assert.equal(f.has('a'), true);
  assert.deepEqual(JSON.parse(st.data['kr-favorites']), ['a']);
  assert.equal(f.toggle('a'), false);
  assert.deepEqual(f.list(), []);
});

test('다시 만들면 저장된 찜을 읽는다', () => {
  const st = memStorage({ 'kr-favorites': '["x","y"]' });
  assert.deepEqual(createFavorites(st).list(), ['x', 'y']);
});

test('깨진 JSON이나 배열이 아닌 값은 빈 목록', () => {
  assert.deepEqual(createFavorites(memStorage({ 'kr-favorites': '{oops' })).list(), []);
  assert.deepEqual(createFavorites(memStorage({ 'kr-favorites': '{"a":1}' })).list(), []);
});

test('저장소 접근이 예외를 던지면 available=false, 예외 없이 동작', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const f = createFavorites(broken);
  assert.equal(f.available, false);
  assert.deepEqual(f.list(), []);
  assert.doesNotThrow(() => f.toggle('a'));
});

test('쓰기만 실패해도(용량 초과) 메모리 상태는 유지', () => {
  const st = memStorage();
  st.setItem = () => { throw new Error('QuotaExceeded'); };
  const f = createFavorites(st);
  assert.equal(f.toggle('a'), true);
  assert.equal(f.has('a'), true);
});

test('storage가 없으면 available=false', () => {
  assert.equal(createFavorites(undefined).available, false);
});
