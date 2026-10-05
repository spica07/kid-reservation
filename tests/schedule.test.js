const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/js/schedule.js');

const monthly = (extra = {}) => ({
  id: 'p', name: '테스트',
  open: { rule: 'monthly', day: 1, time: '10:00', target: 'next-month' },
  overrides: [], ...extra,
});

test('monthly: 범위 안의 매월 1일을 계산하고 다음 달분 라벨을 붙인다', () => {
  const r = S.occurrences(monthly(), '2026-10-01', 61);
  assert.deepEqual(r, [
    { date: '2026-10-01', time: '10:00', label: '11월분', confirmed: false },
    { date: '2026-11-01', time: '10:00', label: '12월분', confirmed: false },
  ]);
});

test('monthly: 연말을 넘기면 12월 → 1월분 라벨', () => {
  const r = S.occurrences(monthly(), '2026-12-01', 40);
  assert.deepEqual(r.map(o => [o.date, o.label]), [
    ['2026-12-01', '1월분'],
    ['2027-01-01', '2월분'],
  ]);
});

test('monthly: 31일 규칙은 2월에 말일(28일)로 내려온다', () => {
  const p = monthly({ open: { rule: 'monthly', day: 31, time: '09:00' } });
  const r = S.occurrences(p, '2027-01-15', 60);
  assert.deepEqual(r.map(o => o.date), ['2027-01-31', '2027-02-28']);
  assert.equal(r[0].label, '');
});

test('monthly: 30일 규칙은 4월에 30일 그대로', () => {
  const p = monthly({ open: { rule: 'monthly', day: 30, time: '09:00' } });
  assert.deepEqual(S.occurrences(p, '2027-04-01', 30).map(o => o.date), ['2027-04-30']);
});

test('monthlyWeekday: 매월 둘째 주 화요일', () => {
  const p = monthly({ open: { rule: 'monthlyWeekday', week: 2, weekday: 2, time: '14:00', target: 'this-month' } });
  const r = S.occurrences(p, '2026-10-01', 61);
  assert.deepEqual(r.map(o => [o.date, o.label]), [['2026-10-13', '10월분'], ['2026-11-10', '11월분']]);
});

test('monthlyWeekday: 마지막 주 금요일(week:-1)', () => {
  const p = monthly({ open: { rule: 'monthlyWeekday', week: -1, weekday: 5, time: '10:00' } });
  assert.deepEqual(S.occurrences(p, '2026-10-01', 61).map(o => o.date), ['2026-10-30', '2026-11-27']);
});

test('weekly: 매주 월요일', () => {
  const p = monthly({ open: { rule: 'weekly', weekday: 1, time: '09:00' } });
  assert.deepEqual(S.occurrences(p, '2026-10-05', 14).map(o => o.date), ['2026-10-05', '2026-10-12']);
});

test('overrides: 같은 달의 규칙 날짜를 확정 날짜로 대체한다(예상+확정 중복 없음)', () => {
  const p = monthly({ overrides: [{ date: '2026-11-02', time: '11:00', note: '12월분(휴일로 하루 늦춤)' }] });
  const r = S.occurrences(p, '2026-10-01', 61);
  assert.deepEqual(r, [
    { date: '2026-10-01', time: '10:00', label: '11월분', confirmed: false },
    { date: '2026-11-02', time: '11:00', label: '12월분(휴일로 하루 늦춤)', confirmed: true },
  ]);
});

test('overrides: 시각이 없으면 규칙 시각, note가 없으면 규칙 라벨을 쓴다', () => {
  const p = monthly({ overrides: [{ date: '2026-10-01' }] });
  assert.deepEqual(S.occurrences(p, '2026-10-01', 1),
    [{ date: '2026-10-01', time: '10:00', label: '11월분', confirmed: true }]);
});

test('overrides: cancel은 그 달 회차를 없앤다', () => {
  const p = monthly({ overrides: [{ date: '2026-11-01', cancel: true }] });
  assert.deepEqual(S.occurrences(p, '2026-10-01', 61).map(o => o.date), ['2026-10-01']);
});

test('fixed: overrides만 일정이 된다', () => {
  const p = monthly({ open: { rule: 'fixed' }, overrides: [{ date: '2026-10-20', time: '10:00', note: '겨울 시즌' }] });
  assert.deepEqual(S.occurrences(p, '2026-10-01', 60),
    [{ date: '2026-10-20', time: '10:00', label: '겨울 시즌', confirmed: true }]);
});

test('always: 일정이 없다', () => {
  assert.deepEqual(S.occurrences(monthly({ open: { rule: 'always' } }), '2026-10-01', 60), []);
});

test('잘못된 프로그램은 빈 배열(예외 없음)', () => {
  assert.deepEqual(S.occurrences({ id: 'x' }, '2026-10-01', 30), []);
  assert.deepEqual(S.occurrences(monthly({ open: { rule: 'monthly', day: 1 } }), '2026-10-01', 30), []);
  assert.equal(S.isValidProgram({ id: 'x' }), false);
  assert.equal(S.isValidProgram(monthly()), true);
  assert.equal(S.isValidProgram(monthly({ open: { rule: 'always' } })), true);
});

test('kstToday: UTC 기준 전날 15시 이후는 KST로 다음 날', () => {
  assert.equal(S.kstToday(new Date('2026-09-30T15:30:00Z')), '2026-10-01');
  assert.equal(S.kstToday(new Date('2026-09-30T14:59:00Z')), '2026-09-30');
});

test('toInstant: KST 10:00은 UTC 01:00', () => {
  assert.equal(S.toInstant('2026-10-01', '10:00').toISOString(), '2026-10-01T01:00:00.000Z');
});

test('nextOccurrences: 지금 이후 회차만, 시간대와 무관하게', () => {
  // KST 2026-10-01 10:00:30 — 이번 회차는 막 지났다
  const now = new Date('2026-10-01T01:00:30Z');
  const r = S.nextOccurrences(monthly(), now, 2);
  assert.deepEqual(r.map(o => o.date), ['2026-11-01', '2026-12-01']);
});

test('describeRule / formatTime', () => {
  assert.equal(S.describeRule({ rule: 'monthly', day: 1, time: '10:00', target: 'next-month' }), '매월 1일 오전 10시, 다음 달분');
  assert.equal(S.describeRule({ rule: 'monthlyWeekday', week: -1, weekday: 5, time: '14:30' }), '매월 마지막 주 금요일 오후 2시 30분');
  assert.equal(S.describeRule({ rule: 'monthlyWeekday', week: 2, weekday: 2, time: '09:00', target: 'this-month' }), '매월 둘째 주 화요일 오전 9시, 이번 달분');
  assert.equal(S.describeRule({ rule: 'weekly', weekday: 1, time: '09:00' }), '매주 월요일 오전 9시');
  assert.equal(S.describeRule({ rule: 'fixed' }), '정해진 날짜에 공지 후 열려요');
  assert.equal(S.describeRule({ rule: 'always' }), '언제든 예약할 수 있어요');
  assert.equal(S.formatTime('12:00'), '낮 12시');
  assert.equal(S.formatTime('00:00'), '자정');
});

test('addDays: 월말·윤년', () => {
  assert.equal(S.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
});

test('monthly weekdayOnly: 1일이 주말이면 다음 월요일로 미룬다', () => {
  const p = monthly({ open: { rule: 'monthly', day: 1, time: '10:00', target: 'next-month', weekdayOnly: true } });
  // 2026-11-01은 일요일, 2026-08-01은 토요일
  assert.deepEqual(S.occurrences(p, '2026-10-01', 61).map(o => o.date), ['2026-10-01', '2026-11-02']);
  assert.deepEqual(S.occurrences(p, '2026-08-01', 5).map(o => [o.date, o.label]), [['2026-08-03', '9월분']]);
  assert.equal(S.describeRule(p.open), '매월 첫 평일 오전 10시, 다음 달분');
  assert.equal(S.describeRule({ ...p.open, day: 15 }), '매월 15일(주말이면 다음 평일) 오전 10시, 다음 달분');
});

test('rolling: 관람일 N일 전에 열리는 방식은 달력 일정이 없고 설명만 있다', () => {
  const p = monthly({ open: { rule: 'rolling', daysBefore: 14, time: '00:00' } });
  assert.equal(S.isValidProgram(p), true);
  assert.deepEqual(S.occurrences(p, '2026-10-01', 60), []);
  assert.equal(S.describeRule(p.open), '관람일 2주 전 자정에 열려요');
  assert.equal(S.describeRule({ rule: 'rolling', daysBefore: 10, time: '09:00' }), '관람일 10일 전 오전 9시에 열려요');
  assert.equal(S.isValidProgram(monthly({ open: { rule: 'rolling', time: '09:00' } })), false);
});

test('open.note: 상시·수시 규칙은 설명을 대신하고, 나머지는 덧붙인다', () => {
  assert.equal(S.describeRule({ rule: 'fixed', note: '회차마다 공지 후 접수' }), '회차마다 공지 후 접수');
  assert.equal(S.describeRule({ rule: 'always', note: '방문 전날까지 예약' }), '방문 전날까지 예약');
  assert.equal(S.describeRule({ rule: 'rolling', daysBefore: 7, time: '10:00', note: '1인 1일 1회' }), '관람일 1주 전 오전 10시에 열려요 · 1인 1일 1회');
});
