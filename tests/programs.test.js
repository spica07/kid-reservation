const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../assets/js/schedule.js');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/data/programs.js'), 'utf8'), ctx);
const programs = ctx.window.KR_PROGRAMS;
const REGIONS = { seoul: '서울', gyeonggi: '경기', incheon: '인천' };
const CATEGORIES = ['박물관·과학관', '방송·직업체험', '금융·경제교육', '자연·생태', '공연·문화', '놀이·키즈카페', '안전체험'];

test('40곳 이상', () => assert.ok(programs.length >= 40, `${programs.length}곳`));

test('id 중복 없음', () => {
  const ids = programs.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const p of programs) {
  test(`항목 형식: ${p.id}`, () => {
    assert.ok(S.isValidProgram(p), '오픈 규칙');
    assert.equal(REGIONS[p.region], p.regionName, '지역');
    assert.ok(CATEGORIES.includes(p.category), `분류 ${p.category}`);
    for (const k of ['name', 'org', 'location', 'age', 'fee', 'bookingUrl', 'tip', 'source']) assert.ok(p[k], k);
    assert.equal(typeof p.free, 'boolean');
    assert.ok(['선착순', '추첨', '상시'].includes(p.method), 'method');
    assert.match(p.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(p.bookingUrl, /^https?:\/\//);
    assert.ok(Array.isArray(p.overrides));
    p.overrides.forEach(o => assert.match(o.date, /^\d{4}-\d{2}-\d{2}$/));
    assert.doesNotThrow(() => S.occurrences(p, '2026-10-01', 90));
    assert.ok(!/누리집|\*\*/.test(JSON.stringify(p)), '금지 표현');
  });
}
