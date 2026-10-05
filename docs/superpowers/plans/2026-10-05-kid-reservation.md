# kid-reservation 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미취학 아이 인기 예약·체험 프로그램과 "매월 N일 N시 동시 오픈" 일정을 한눈에 보여 주는 정적 PWA를 만든다.

**Architecture:** 빌드 없는 정적 HTML/CSS/JS. 일정 계산(`schedule.js`)·.ics 생성(`ics.js`)·찜 저장(`favorites.js`)은 브라우저와 Node 양쪽에서 쓰는 UMD 순수 모듈로 두고 `node --test`로 검증한다. 데이터는 사람이 관리하는 `programs.js`와 파이썬 수집 스크립트가 만드는 `public-programs.js` 두 개다. `app.js`는 이 셋을 엮어 화면만 그린다.

**Tech Stack:** HTML/CSS/vanilla JS(ES2020), Node 22 내장 테스트 러너, Python 3.13(`py`, 표준 라이브러리만), Playwright(파이썬, 스크린샷 검증), Pillow(아이콘 생성), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-05-kid-reservation-design.md`

## Global Constraints

- 작업 폴더 `C:\blog_writing\kid-reservation`, 별도 git 저장소, 브랜치 `main`. 커밋은 이 폴더 안에서만.
- 파이썬은 `python`이 아니라 `py`로 실행한다. 수집 스크립트는 표준 라이브러리만 쓴다.
- 빌드 도구·npm 패키지 없음. 테스트는 `node --test tests/`.
- CSP: `script-src 'self'`, 외부 리소스는 Google Fonts(`fonts.googleapis.com`, `fonts.gstatic.com`)만.
- UI에 이모지를 쓰지 않는다. 아이콘은 인라인 SVG(`class="ico"`, `viewBox="0 0 24 24"`).
- 폰트 Jua·Gaegu, 배경 `linear-gradient(135deg, #FFE5F1 0%, #E5F4FF 50%, #FFF9E5 100%)`, 글자색 `#4A4A6A`, 주 색 `#6B5B95`(kid-festival 계열). 포인트 색은 `#FF8A5B`.
- 모든 날짜·시각은 한국 시간(Asia/Seoul, +09:00) 기준.
- 지역 값은 `seoul | gyeonggi | incheon`, 이름 `서울 | 경기 | 인천`.
- 분류 7개 고정: `박물관·과학관`, `방송·직업체험`, `금융·경제교육`, `자연·생태`, `공연·문화`, `놀이·키즈카페`, `안전체험`.
- 큐레이션 데이터는 공식 안내 원문으로 확인한 것만 넣는다. 오픈 규칙을 확인하지 못하면 추정하지 말고 `rule:'always'` 또는 `fixed`로 둔다.
- 화면 문구는 쉬운 우리말 해요체("~요"). "누리집" 대신 "공식 사이트", 전화번호는 싣지 않는다.
- `localStorage` 키는 `kr-favorites`. 모든 접근은 try/catch.
- `.env`(SEOUL_API_KEY)는 커밋하지 않는다.
- 커밋 메시지 끝에 다음 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FXistYjkfQMAmpLq81z59z
  ```

## Review Focus

1. **브라우저 시간대가 KST가 아닌 사용자**(해외 체류·PC 시간대 UTC) — 오픈 시각과 카운트다운이 여전히 KST 기준으로 맞아야 한다. → Task 1 `kstToday`/`toInstant` 테스트(UTC `Date` 입력).
2. **31일·말일 규칙과 2월** — `day:31`은 2월에 28/29일로 내려와야 하고, 다음 달로 넘어가면 안 된다. → Task 1 테스트.
3. **공식 공지로 날짜가 바뀐 달**(예: 1일이 공휴일이라 2일로 이동) — 그 달에 "예상" 1일과 "확정" 2일이 둘 다 뜨면 안 된다. → Task 1 overrides 대체 테스트.
4. **찜 저장이 막힌 브라우저**(사파리 사생활 보호, 저장소 꽉 참, 깨진 JSON) — 앱이 죽지 않고 찜만 빠져야 한다. → Task 3 테스트.
5. **한글이 긴 .ics 제목** — 75옥텟 줄 접기가 UTF-8 글자 중간을 자르면 캘린더 앱이 깨진 글자를 보여 준다. → Task 2 테스트.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 뼈대, CSP, 탭 3개, 스크립트 로드 순서 |
| `assets/css/app.css` | 전체 스타일 |
| `assets/js/schedule.js` | 오픈 규칙 → 일정 계산, 규칙 설명 문구, KST 변환 (`window.KRSchedule`) |
| `assets/js/ics.js` | 일정 → .ics 문자열 (`window.KRIcs`) |
| `assets/js/favorites.js` | 찜 저장 (`window.KRFavorites`) |
| `assets/js/app.js` | 데이터 합치기, 세 탭 렌더링, 필터, 상세, 다운로드 |
| `assets/data/programs.js` | 큐레이션 (`window.KR_PROGRAMS`) |
| `assets/data/public-programs.js` | 공공예약 결과 (`window.KR_PUBLIC`) — 스크립트 생성 |
| `tools/fetch_seoul_reservation.py` | 공공예약 API 수집·필터 |
| `tools/make_icons.py` | PWA 아이콘 생성 |
| `tests/*.test.js`, `tests/test_fetch.py` | 테스트 |
| `manifest.json`, `sw.js` | PWA |
| `README.md` | 갱신 절차 |

---

### Task 1: 일정 계산 모듈 `schedule.js`

**Files:**
- Create: `assets/js/schedule.js`
- Test: `tests/schedule.test.js`

**Interfaces:**
- Produces (`window.KRSchedule` / `require('../assets/js/schedule.js')`):
  - `occurrences(program, from: 'YYYY-MM-DD', days: number) → Array<{date:'YYYY-MM-DD', time:'HH:MM', label:string, confirmed:boolean}>` (날짜·시각 오름차순)
  - `nextOccurrences(program, now: Date, n: number) → 같은 배열` (now 이후만, 최대 n개)
  - `describeRule(open) → string`
  - `formatTime('HH:MM') → string` ("오전 10시", "오후 2시 30분", "낮 12시", "자정")
  - `kstToday(now: Date) → 'YYYY-MM-DD'`
  - `toInstant(date, time) → Date` (KST로 해석)
  - `addDays(date, n) → 'YYYY-MM-DD'`
  - `isValidProgram(program) → boolean`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/schedule.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `cd /c/blog_writing/kid-reservation && node --test tests/`
Expected: FAIL — `Cannot find module '../assets/js/schedule.js'`

- [ ] **Step 3: 구현** — `assets/js/schedule.js`

```js
/* 오픈 규칙 → 일정 계산. 날짜는 'YYYY-MM-DD' 문자열로만 다뤄
   브라우저 시간대에 흔들리지 않게 하고, '지금'과 비교할 때만 KST(+09:00)로 Date를 만든다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KRSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KST_OFFSET_MS = 9 * 3600 * 1000;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const ORDINALS = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째', '-1': '마지막' };
  const TARGET_TEXT = { 'next-month': '다음 달분', 'this-month': '이번 달분', 'two-months': '두 달 뒤분' };
  const TARGET_SHIFT = { 'this-month': 0, 'next-month': 1, 'two-months': 2 };
  const TIMED_RULES = ['monthly', 'monthlyWeekday', 'weekly'];

  const pad = n => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weekdayOf = s => { const { y, m, d } = parse(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

  function addDays(s, n) {
    const { y, m, d } = parse(s);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  function kstToday(now) {
    const t = new Date(now.getTime() + KST_OFFSET_MS);
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  function toInstant(date, time) {
    return new Date(`${date}T${time || '00:00'}:00+09:00`);
  }

  function targetLabel(target, y, m) {
    if (!(target in TARGET_SHIFT)) return '';
    return `${((m - 1 + TARGET_SHIFT[target]) % 12) + 1}월분`;
  }

  function isValidProgram(p) {
    if (!p || !p.id || !p.open || !p.open.rule) return false;
    const o = p.open;
    if (o.rule === 'always' || o.rule === 'fixed') return true;
    if (!TIMED_RULES.includes(o.rule) || !/^\d{2}:\d{2}$/.test(o.time || '')) return false;
    if (o.rule === 'monthly') return o.day >= 1 && o.day <= 31;
    if (o.rule === 'monthlyWeekday') return o.weekday >= 0 && o.weekday <= 6 && (o.week === -1 || (o.week >= 1 && o.week <= 5));
    return o.weekday >= 0 && o.weekday <= 6;
  }

  function nthWeekday(y, m, week, wd) {
    const dim = daysInMonth(y, m);
    if (week === -1) {
      const lastWd = weekdayOf(ymd(y, m, dim));
      return ymd(y, m, dim - ((lastWd - wd + 7) % 7));
    }
    const d = 1 + ((wd - weekdayOf(ymd(y, m, 1)) + 7) % 7) + (week - 1) * 7;
    return d > dim ? null : ymd(y, m, d);
  }

  function ruleDates(open, from, to) {
    const out = [];
    if (open.rule === 'weekly') {
      for (let d = from; d <= to; d = addDays(d, 1)) if (weekdayOf(d) === open.weekday) out.push(d);
      return out;
    }
    let { y, m } = parse(from);
    const end = parse(to);
    while (y < end.y || (y === end.y && m <= end.m)) {
      const date = open.rule === 'monthly'
        ? ymd(y, m, Math.min(open.day, daysInMonth(y, m)))
        : nthWeekday(y, m, open.week, open.weekday);
      if (date && date >= from && date <= to) out.push(date);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  function occurrences(program, from, days) {
    if (!isValidProgram(program)) {
      if (typeof console !== 'undefined' && program && program.id) console.warn('[KRSchedule] 규칙 오류:', program.id);
      return [];
    }
    const open = program.open;
    const to = addDays(from, days - 1);
    const byMonth = open.rule === 'monthly' || open.rule === 'monthlyWeekday';
    const keyOf = d => (byMonth ? d.slice(0, 7) : d);
    const labelOf = d => { const { y, m } = parse(d); return targetLabel(open.target, y, m); };
    const overrides = Array.isArray(program.overrides) ? program.overrides.filter(o => o && o.date) : [];
    const overridden = new Set(overrides.map(o => keyOf(o.date)));

    const result = TIMED_RULES.includes(open.rule)
      ? ruleDates(open, from, to)
          .filter(d => !overridden.has(keyOf(d)))
          .map(d => ({ date: d, time: open.time, label: labelOf(d), confirmed: false }))
      : [];
    overrides.forEach(o => {
      if (o.cancel || o.date < from || o.date > to) return;
      result.push({ date: o.date, time: o.time || open.time || '00:00', label: o.note || labelOf(o.date), confirmed: true });
    });
    return result.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function nextOccurrences(program, now, n) {
    const today = kstToday(now);
    return occurrences(program, today, 400)
      .filter(o => toInstant(o.date, o.time).getTime() > now.getTime())
      .slice(0, n);
  }

  function formatTime(t) {
    const [h, mi] = t.split(':').map(Number);
    if (h === 0 && mi === 0) return '자정';
    const part = h === 12 ? '낮' : h < 12 ? '오전' : '오후';
    const hh = h > 12 ? h - 12 : h;
    return `${part} ${hh}시${mi ? ` ${mi}분` : ''}`;
  }

  function describeRule(open) {
    if (!open) return '';
    const tail = open.target && TARGET_TEXT[open.target] ? `, ${TARGET_TEXT[open.target]}` : '';
    switch (open.rule) {
      case 'monthly': return `매월 ${open.day}일 ${formatTime(open.time)}${tail}`;
      case 'monthlyWeekday': return `매월 ${ORDINALS[open.week]} 주 ${WEEKDAYS[open.weekday]}요일 ${formatTime(open.time)}${tail}`;
      case 'weekly': return `매주 ${WEEKDAYS[open.weekday]}요일 ${formatTime(open.time)}`;
      case 'fixed': return '정해진 날짜에 공지 후 열려요';
      case 'always': return '언제든 예약할 수 있어요';
      default: return '';
    }
  }

  return { occurrences, nextOccurrences, describeRule, formatTime, kstToday, toInstant, addDays, isValidProgram };
});
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/`
Expected: 모든 테스트 PASS (`# fail 0`)

- [ ] **Step 5: 커밋**

```bash
git add assets/js/schedule.js tests/schedule.test.js
git commit -m "일정 계산 모듈: 매월·N째 주·매주 오픈 규칙과 확정 일정 덮어쓰기"
```

---

### Task 2: .ics 생성 모듈 `ics.js`

**Files:**
- Create: `assets/js/ics.js`
- Test: `tests/ics.test.js`

**Interfaces:**
- Consumes: 없음(독립)
- Produces (`window.KRIcs`):
  - `buildIcs(events: Array<{uid, date:'YYYY-MM-DD', time:'HH:MM', title, description?, url?}>, opts?: {stamp?: 'YYYYMMDDTHHMMSSZ'}) → string`
  - `escapeText(s) → string`, `foldLine(line) → string`

- [ ] **Step 1: 실패하는 테스트** — `tests/ics.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../assets/js/ics.js');

const ev = { uid: 'ebs-2026-10-01@kid-reservation', date: '2026-10-01', time: '10:00',
  title: '[예약 오픈] EBS 스튜디오투어 11월분', description: '매월 1일, 오전 10시', url: 'https://example.com/a' };

test('기본 구조: CRLF, VTIMEZONE, VEVENT, VALARM 10분 전', () => {
  const s = I.buildIcs([ev], { stamp: '20261005T000000Z' });
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(s.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(s), 'LF 단독 줄바꿈이 없어야 한다');
  assert.match(s, /BEGIN:VTIMEZONE\r\nTZID:Asia\/Seoul/);
  assert.match(s, /DTSTART;TZID=Asia\/Seoul:20261001T100000\r\n/);
  assert.match(s, /DTEND;TZID=Asia\/Seoul:20261001T103000\r\n/);
  assert.match(s, /DTSTAMP:20261005T000000Z\r\n/);
  assert.match(s, /UID:ebs-2026-10-01@kid-reservation\r\n/);
  assert.match(s, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT10M\r\n/);
  assert.match(s, /URL:https:\/\/example.com\/a\r\n/);
});

test('DTEND는 23:45 시작이면 다음 날로 넘어간다', () => {
  const s = I.buildIcs([{ ...ev, time: '23:45' }], { stamp: '20261005T000000Z' });
  assert.match(s, /DTEND;TZID=Asia\/Seoul:20261002T001500/);
});

test('escapeText: 역슬래시·세미콜론·쉼표·줄바꿈', () => {
  assert.equal(I.escapeText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('foldLine: 75옥텟 이하로 접고, 한글 글자를 가르지 않는다', () => {
  const line = 'SUMMARY:' + '가'.repeat(60); // 8 + 180 바이트
  const folded = I.foldLine(line);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  parts.forEach((p, i) => {
    assert.ok(Buffer.byteLength(p, 'utf8') <= 75, `줄 ${i} 길이 ${Buffer.byteLength(p, 'utf8')}`);
    if (i > 0) assert.equal(p[0], ' ');
  });
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), line);
});

test('여러 일정과 빈 목록', () => {
  const s = I.buildIcs([ev, { ...ev, uid: 'x2', date: '2026-11-01' }], { stamp: '20261005T000000Z' });
  assert.equal(s.match(/BEGIN:VEVENT/g).length, 2);
  assert.equal((I.buildIcs([], { stamp: '20261005T000000Z' }).match(/BEGIN:VEVENT/g) || []).length, 0);
});
```

- [ ] **Step 2: 실패 확인** — `node --test tests/` → `Cannot find module '../assets/js/ics.js'`

- [ ] **Step 3: 구현** — `assets/js/ics.js`

```js
/* 일정 → iCalendar(RFC 5545). 휴대폰 캘린더에 넣으면 10분 전 알림이 울린다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KRIcs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CRLF = '\r\n';
  const encoder = new TextEncoder();

  function escapeText(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function foldLine(line) {
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const b = encoder.encode(ch).length;
      const limit = out.length ? 74 : 75; // 이어지는 줄은 앞 공백 1바이트
      if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.map((p, i) => (i ? ' ' + p : p)).join(CRLF);
  }

  const compact = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

  function plusMinutes(date, time, minutes) {
    const [y, m, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d, h, mi + minutes));
    const p = n => String(n).padStart(2, '0');
    return compact(`${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`, `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`);
  }

  function nowStamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function buildIcs(events, opts = {}) {
    const stamp = opts.stamp || nowStamp();
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kid-reservation//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE',
    ];
    events.forEach(e => {
      lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Seoul:${compact(e.date, e.time)}`,
        `DTEND;TZID=Asia/Seoul:${plusMinutes(e.date, e.time, 30)}`,
        `SUMMARY:${escapeText(e.title)}`);
      if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
      if (e.url) lines.push(`URL:${e.url}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', `DESCRIPTION:${escapeText(e.title)}`, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join(CRLF) + CRLF;
  }

  return { buildIcs, escapeText, foldLine };
});
```

- [ ] **Step 4: 통과 확인** — `node --test tests/` → `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add assets/js/ics.js tests/ics.test.js
git commit -m ".ics 생성 모듈: 10분 전 알림, KST 시간대, 한글 줄 접기"
```

---

### Task 3: 찜 저장 모듈 `favorites.js`

**Files:**
- Create: `assets/js/favorites.js`
- Test: `tests/favorites.test.js`

**Interfaces:**
- Produces (`window.KRFavorites`):
  - `createFavorites(storage) → { available:boolean, list():string[], has(id):boolean, toggle(id):boolean /* 토글 후 찜 상태 */ }`
  - 저장 형식: `localStorage['kr-favorites'] = JSON.stringify(string[])`

- [ ] **Step 1: 실패하는 테스트** — `tests/favorites.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인** — `node --test tests/` → `Cannot find module`

- [ ] **Step 3: 구현** — `assets/js/favorites.js`

```js
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
```

- [ ] **Step 4: 통과 확인** — `node --test tests/` → `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add assets/js/favorites.js tests/favorites.test.js
git commit -m "찜 저장 모듈: 저장소가 막힌 브라우저에서도 안전하게"
```

---

### Task 4: 서울시 공공예약 수집 스크립트

**Files:**
- Create: `tools/fetch_seoul_reservation.py`
- Create: `.env` (커밋 안 함 — `kid-festival/.env`의 `SEOUL_API_KEY` 줄만 복사)
- Test: `tests/test_fetch.py`
- Generate: `assets/data/public-programs.js`

**Interfaces:**
- Produces: `window.KR_PUBLIC = { generatedAt: 'YYYY-MM-DDTHH:MM:SS+09:00', items: [{ id, name, place, area, target, fee, category, rcptStart:'YYYY-MM-DD HH:MM', rcptEnd, useStart:'YYYY-MM-DD', useEnd, status, url }] }`
- 파이썬 함수: `clean(s)->str`, `is_kid_target(target, name)->bool`, `to_record(row)->dict`, `keep(record, now_kst_str)->bool`

API 참고(이미 확인함): `http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{start}/{end}/`, 1회 최대 1,000행, 응답 `{SERVICE: {list_total_count, RESULT:{CODE}, row:[...]}}`. 서비스 `ListPublicReservationEducation`(약 381건), `ListPublicReservationCulture`(약 1,045건). 행 필드: `SVCID, MINCLASSNM, SVCSTATNM(접수중|안내중|접수종료|예약마감|예약일시중지), SVCNM, PAYATNM, PLACENM, USETGTINFO, SVCURL, SVCOPNBGNDT, SVCOPNENDDT, RCPTBGNDT('2026-09-25 14:00:00.0'), RCPTENDDT, AREANM`. 제목·대상에 `&#39;` `&lt;` 같은 HTML 기호가 섞여 있다.

- [ ] **Step 1: 실패하는 테스트** — `tests/test_fetch.py`

```python
import sys, pathlib, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'tools'))
import fetch_seoul_reservation as F

class CleanTest(unittest.TestCase):
    def test_unescape_and_spaces(self):
        self.assertEqual(F.clean(" 2026년 &#39;우리 동네&#39;  &lt;탐험&gt; "), "2026년 '우리 동네' <탐험>")

class KidTargetTest(unittest.TestCase):
    def check(self, target, name, expected):
        self.assertEqual(F.is_kid_target(target, name), expected, target)

    def test_includes(self):
        self.check('가족(4세~12세 아동 동반 가족)', '', True)
        self.check('유아(미취학 (5~7세))', '', True)
        self.check('가족(7세이상+보호자)', '', True)
        self.check('어린이, 가족', '', True)
        self.check('누구나', '[키즈] 숲 놀이', True)
        self.check('가족(유아를 동반한 가족)', '', True)

    def test_excludes(self):
        self.check('가족(초등이상 가족 참여)', '', False)
        self.check('가족(초등학교 1~6학년 자녀를 동반한 가족)', '', False)
        self.check('어린이(초등학교 4~6학년 학교)', '', False)
        self.check('성인(50세 이상 성인)', '', False)
        self.check('청소년(중학생 이상)', '', False)
        self.check('누구나', '시대의 명곡 수강생 모집', False)
        self.check('가족(만 8세 이상 자녀 동반)', '', False)

ROW = {
    'SVCID': 'S1', 'MINCLASSNM': '교육체험', 'SVCSTATNM': '안내중',
    'SVCNM': '유아 생태학교 &#39;가을&#39;', 'PAYATNM': '무료', 'PLACENM': '길동생태공원',
    'USETGTINFO': ' 유아(미취학 (5~7세))', 'SVCURL': 'https://yeyak.seoul.go.kr/x',
    'SVCOPNBGNDT': '2026-10-10 00:00:00.0', 'SVCOPNENDDT': '2026-10-24 00:00:00.0',
    'RCPTBGNDT': '2026-10-08 14:00:00.0', 'RCPTENDDT': '2026-10-12 18:00:00.0', 'AREANM': '강동구',
}

class RecordTest(unittest.TestCase):
    def test_to_record(self):
        r = F.to_record(ROW)
        self.assertEqual(r, {
            'id': 'S1', 'name': "유아 생태학교 '가을'", 'place': '길동생태공원', 'area': '강동구',
            'target': '유아(미취학 (5~7세))', 'fee': '무료', 'category': '교육체험',
            'rcptStart': '2026-10-08 14:00', 'rcptEnd': '2026-10-12 18:00',
            'useStart': '2026-10-10', 'useEnd': '2026-10-24', 'status': '안내중',
            'url': 'https://yeyak.seoul.go.kr/x',
        })

    def test_keep(self):
        r = F.to_record(ROW)
        self.assertTrue(F.keep(r, '2026-10-05 12:00'))
        self.assertFalse(F.keep(r, '2026-10-12 18:01'))                 # 접수 종료 지남
        self.assertFalse(F.keep({**r, 'status': '접수종료'}, '2026-10-05 12:00'))
        self.assertFalse(F.keep({**r, 'status': '예약마감'}, '2026-10-05 12:00'))
        self.assertTrue(F.keep({**r, 'status': '접수중'}, '2026-10-05 12:00'))
        self.assertFalse(F.keep({**r, 'target': '성인', 'name': '명곡 교실'}, '2026-10-05 12:00'))

if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 실패 확인**

Run: `py -m unittest tests/test_fetch.py -v`
Expected: `ModuleNotFoundError: No module named 'fetch_seoul_reservation'`

- [ ] **Step 3: 구현** — `tools/fetch_seoul_reservation.py`

```python
"""서울시 공공서비스예약(열린데이터광장) → assets/data/public-programs.js

유아·가족 대상이면서 아직 접수가 끝나지 않은 프로그램만 남긴다.
실행: py tools/fetch_seoul_reservation.py   (키: 저장소 루트 .env 의 SEOUL_API_KEY)
"""
import html, json, re, sys, collections, pathlib, urllib.request
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'data' / 'public-programs.js'
SERVICES = ['ListPublicReservationEducation', 'ListPublicReservationCulture']
PAGE = 1000
KST = timezone(timedelta(hours=9))
KEEP_STATUS = {'접수중', '안내중'}

POSITIVE = re.compile(r'유아|어린이|미취학|가족|아동|키즈|영유아|(?<!\d)[1-7]\s*세')
STRONG = re.compile(r'유아|미취학|영유아|어린이집|유치원|(?<!\d)[1-7]\s*세')
NEGATIVE = re.compile(
    r'초등[^,)]*이상|초등(학교)?\s*\d\s*~\s*\d\s*학년|초등학교\s*[3-6]|중학생|고등학생|성인\(|만?\s*(?:[89]|1\d)\s*세\s*이상'
)


def clean(s):
    return re.sub(r'\s+', ' ', html.unescape(s or '')).strip()


def is_kid_target(target, name):
    target, name = clean(target), clean(name)
    if not POSITIVE.search(target + ' ' + name):
        return False
    return not NEGATIVE.search(target) or bool(STRONG.search(target))


def _dt(s):  # '2026-09-25 14:00:00.0' → '2026-09-25 14:00'
    return clean(s)[:16]


def to_record(row):
    return {
        'id': row['SVCID'], 'name': clean(row['SVCNM']), 'place': clean(row['PLACENM']),
        'area': clean(row['AREANM']), 'target': clean(row['USETGTINFO']), 'fee': clean(row['PAYATNM']),
        'category': clean(row['MINCLASSNM']),
        'rcptStart': _dt(row['RCPTBGNDT']), 'rcptEnd': _dt(row['RCPTENDDT']),
        'useStart': clean(row['SVCOPNBGNDT'])[:10], 'useEnd': clean(row['SVCOPNENDDT'])[:10],
        'status': clean(row['SVCSTATNM']), 'url': clean(row['SVCURL']),
    }


def keep(r, now_kst):
    return (r['status'] in KEEP_STATUS and r['rcptEnd'] > now_kst
            and is_kid_target(r['target'], r['name']))


def load_key():
    env = ROOT / '.env'
    for line in env.read_text(encoding='utf-8').splitlines():
        if line.startswith('SEOUL_API_KEY='):
            return line.split('=', 1)[1].strip().strip('"')
    sys.exit('.env 에 SEOUL_API_KEY 가 없습니다')


def fetch_all(key, service):
    rows, start = [], 1
    while True:
        url = f'http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{start + PAGE - 1}/'
        with urllib.request.urlopen(url, timeout=60) as res:
            body = json.load(res)
        data = body.get(service)
        if not data:
            sys.exit(f'{service} 응답 오류: {body}')
        if data['RESULT']['CODE'] != 'INFO-000':
            sys.exit(f"{service} 오류: {data['RESULT']}")
        rows += data['row']
        total = data['list_total_count']
        start += PAGE
        if start > total:
            return rows


def main():
    key = load_key()
    now = datetime.now(KST)
    now_s = now.strftime('%Y-%m-%d %H:%M')
    raw, seen = [], set()
    for svc in SERVICES:
        for row in fetch_all(key, svc):
            if row['SVCID'] not in seen:
                seen.add(row['SVCID'])
                raw.append(to_record(row))
    items = sorted((r for r in raw if keep(r, now_s)), key=lambda r: (r['rcptStart'], r['name']))
    dropped = collections.Counter(
        r['target'] for r in raw
        if r['status'] in KEEP_STATUS and r['rcptEnd'] > now_s and not is_kid_target(r['target'], r['name'])
        and POSITIVE.search(r['target'] + ' ' + r['name'])
    )
    before = OUT.read_text(encoding='utf-8').count('"id":') if OUT.exists() else None
    payload = {'generatedAt': now.strftime('%Y-%m-%dT%H:%M:%S+09:00'), 'items': items}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('/* tools/fetch_seoul_reservation.py 가 만든 파일 — 손으로 고치지 마세요 */\n'
                   'window.KR_PUBLIC = ' + json.dumps(payload, ensure_ascii=False, indent=1) + ';\n',
                   encoding='utf-8')
    print(f'전체 {len(raw)}건 → 유아·가족·접수 전/중 {len(items)}건 (이전 {before})')
    print('유아 관련 낱말이 있지만 대상 조건으로 뺀 문구 상위 20개:')
    for t, n in dropped.most_common(20):
        print(f'  {n:3d}  {t}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `py -m unittest tests/test_fetch.py -v`
Expected: 모두 `ok`

- [ ] **Step 5: 키 복사 후 실제 수집**

```bash
grep '^SEOUL_API_KEY=' ../kid-festival/.env > .env
PYTHONIOENCODING=utf-8 py tools/fetch_seoul_reservation.py
```
Expected: `전체 약 1,400건 → … 수십~수백 건`. 출력된 "뺀 문구"를 읽고, 미취학 아이가 갈 수 있는데 빠진 문구가 보이면 `tests/test_fetch.py`에 그 문구를 `test_includes`로 추가한 뒤 정규식을 고쳐 다시 실행한다(TDD 순서 유지). `head -c 1500 assets/data/public-programs.js`로 결과 모양 확인.

- [ ] **Step 6: 커밋**

```bash
git add tools/fetch_seoul_reservation.py tests/test_fetch.py assets/data/public-programs.js .gitignore
git status --short   # .env 가 목록에 없어야 한다
git commit -m "서울시 공공서비스예약 유아·가족 프로그램 수집 스크립트와 첫 결과"
```

---

### Task 5: 큐레이션 데이터 `programs.js`

**Files:**
- Create: `assets/data/programs.js`
- Test: `tests/programs.test.js`

**Interfaces:**
- Consumes: `KRSchedule.isValidProgram`, `occurrences` (Task 1)
- Produces: `window.KR_PROGRAMS = [ { id, name, org, region, regionName, location, category, age, fee, free:boolean, open, overrides, method:'선착순'|'추첨'|'상시', bookingUrl, tip, verifiedAt:'YYYY-MM-DD', source } ]`
  - `source`: 오픈 규칙을 확인한 공식 안내 페이지 주소(화면에는 안 보이고 검증용).

- [ ] **Step 1: 데이터 검증 테스트 먼저** — `tests/programs.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인** — `node --test tests/` → `ENOENT ... programs.js`

- [ ] **Step 3: 조사 후 데이터 작성**

조사 방법(항목마다):
1. 공식 사이트의 예약 안내·공지에서 **예약이 언제 열리는지**(매월 며칠 몇 시, 몇 달치), 대상 나이, 요금, 예약 방식, 예약 페이지 주소를 확인한다. WebSearch → WebFetch로 원문 확인. 기사·블로그만 있고 공식 안내가 없으면 그 항목의 오픈 규칙은 `always`/`fixed`로 두거나 항목을 뺀다.
2. 2026년 10~11월 실제 오픈 공지가 있으면 `overrides`에 `{date, time, note:'11월분'}`로 넣는다(확정 표시).
3. `source`에 오픈 규칙을 확인한 페이지 주소, `verifiedAt`에 `2026-10-05`.
4. 미취학(만 3~7세)이 참여할 수 없는 곳은 넣지 않는다.

후보(사용자 예시 2곳은 반드시 포함, 나머지는 확인되는 것 위주로 40곳 이상 채움):
- 방송·직업체험: EBS 스튜디오투어(사용자 예시), KBS 견학홀, 키자니아 서울, 한국잡월드 어린이체험관
- 금융·경제교육: 신한 어린이 금융체험교실(사용자 예시), 한국은행 화폐박물관 어린이 프로그램, 한국거래소·우리은행 등 은행 어린이 경제교실
- 박물관·과학관: 국립중앙박물관 어린이박물관, 국립민속박물관 어린이박물관, 서울상상나라, 서울시립과학관, 국립과천과학관 유아체험, 경기도어린이박물관, 경기북부어린이박물관, 인천어린이과학관, 국립항공박물관, 서울역사박물관 어린이 프로그램, 국립한글박물관 한글놀이터
- 자연·생태: 서울대공원 동물원 교육, 국립수목원, 서울식물원, 서울숲 생태 프로그램, 국립생물자원관
- 공연·문화: 세종문화회관·예술의전당 어린이 공연 시즌, 국립극장 어린이 공연, 서울어린이대공원 공연
- 놀이·키즈카페: 서울형 키즈카페(서울시 공공예약), 경기 공공 키즈카페, 인천 아이사랑꿈터 등
- 안전체험: 광나루·보라매 안전체험관, 경기도국민안전체험관, 인천 소방안전체험관, 어린이교통공원

형식 예(값은 반드시 조사한 것으로 채운다 — 아래는 모양만 보여 주는 예):

```js
/* 사람이 관리하는 인기 예약처. 오픈 규칙은 공식 안내 원문으로 확인한 것만 넣는다.
   확인하지 못하면 open:{rule:'always'} 또는 {rule:'fixed'}로 두고 추정하지 않는다. */
window.KR_PROGRAMS = [
  {
    id: 'ebs-studio-tour', name: 'EBS 스튜디오투어', org: 'EBS',
    region: 'gyeonggi', regionName: '경기', location: '(조사값)',
    category: '방송·직업체험', age: '(조사값)', fee: '(조사값)', free: true,
    open: { rule: 'monthly', day: 1, time: '10:00', target: 'next-month' },
    overrides: [{ date: '2026-10-01', time: '10:00', note: '11월분' }],
    method: '선착순', bookingUrl: '(조사값)', tip: '(조사값)',
    verifiedAt: '2026-10-05', source: '(오픈 규칙을 확인한 공식 페이지)',
  },
];
```

- [ ] **Step 4: 통과 확인** — `node --test tests/` → `# fail 0`. 그리고 `grep -c "(조사값)" assets/data/programs.js` 결과가 `0`이어야 한다.

- [ ] **Step 5: 링크 확인**

```bash
node -e "const vm=require('vm'),fs=require('fs');const c={window:{}};vm.runInNewContext(fs.readFileSync('assets/data/programs.js','utf8'),c);c.window.KR_PROGRAMS.forEach(p=>console.log(p.id+'\t'+p.bookingUrl))" > "$TEMP/kr-links.tsv"
while IFS=$'\t' read id url; do code=$(curl -s -o /dev/null -L -m 20 -A "Mozilla/5.0" -w '%{http_code}' "$url"); echo "$code $id"; done < "$TEMP/kr-links.tsv" | grep -v '^200'
```
Expected: 출력 없음. 200이 아닌 것은 WebFetch로 다시 확인해 주소를 고친다(봇 차단 403은 브라우저로 열리면 그대로 둔다).

- [ ] **Step 6: 커밋**

```bash
git add assets/data/programs.js tests/programs.test.js
git commit -m "수도권 인기 예약처 큐레이션 데이터(공식 안내 확인)"
```

---

### Task 6: 화면 — `index.html`, `app.css`, `app.js`, PWA

**Files:**
- Create: `index.html`, `assets/css/app.css`, `assets/js/app.js`, `manifest.json`, `sw.js`, `tools/make_icons.py`, `assets/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-64.png`
- Create: `tools/screenshot.py` (검증용)

**Interfaces:**
- Consumes: `window.KRSchedule` (Task 1), `window.KRIcs` (Task 2), `window.KRFavorites` (Task 3), `window.KR_PUBLIC` (Task 4), `window.KR_PROGRAMS` (Task 5)
- Produces: 화면. DOM id: `#tab-open`, `#tab-list`, `#tab-fav`, `#soon`, `#calendar`, `#filters`, `#cards`, `#public-list`, `#fav-list`, `#fav-ics`, `#detail`(dialog).

- [ ] **Step 1: 아이콘 생성 스크립트** — `tools/make_icons.py`

```python
"""PWA 아이콘: 둥근 달력 + 종 모양. 실행: py tools/make_icons.py"""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parents[1] / 'assets' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)

def draw(size):
    s = size / 512
    im = Image.new('RGBA', (size, size), (255, 229, 241, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([96*s, 120*s, 416*s, 420*s], radius=48*s, fill=(255, 255, 255, 255), outline=(107, 91, 149, 255), width=int(18*s))
    d.rectangle([96*s, 120*s, 416*s, 200*s], fill=(255, 138, 91, 255))
    for x in (176, 336):
        d.rounded_rectangle([(x-14)*s, 84*s, (x+14)*s, 156*s], radius=14*s, fill=(107, 91, 149, 255))
    d.ellipse([206*s, 236*s, 306*s, 336*s], fill=(255, 138, 91, 255))
    d.polygon([(236*s, 286*s), (256*s, 250*s), (276*s, 286*s), (256*s, 322*s)], fill=(255, 255, 255, 255))
    return im

for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-64.png', 64)]:
    draw(size).save(OUT / name)
print('아이콘 4개 생성:', OUT)
```

Run: `py tools/make_icons.py` → `아이콘 4개 생성`

- [ ] **Step 2: `manifest.json`**

```json
{
  "name": "꼬마 예약 달력",
  "short_name": "꼬마 예약",
  "description": "서울·경기·인천 미취학 아이 인기 체험 예약, 오픈 날짜와 시각을 한눈에",
  "lang": "ko",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#FFE5F1",
  "theme_color": "#6B5B95",
  "categories": ["kids", "lifestyle", "education"],
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Step 3: `index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; worker-src 'self'; manifest-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'self';">
<title>꼬마 예약 달력</title>
<meta name="description" content="서울·경기·인천 미취학 아이 인기 체험 예약, 오픈 날짜와 시각을 한눈에">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#6B5B95">
<link rel="icon" type="image/png" sizes="64x64" href="assets/icons/favicon-64.png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="꼬마 예약">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<header class="top">
  <h1><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>꼬마 예약 달력</h1>
  <p class="sub">미취학 아이 인기 체험, 예약이 열리는 날을 모았어요</p>
</header>

<nav class="tabs" role="tablist" aria-label="화면 전환">
  <button class="tab active" role="tab" id="tab-open" aria-selected="true" aria-controls="panel-open">오픈 달력</button>
  <button class="tab" role="tab" id="tab-list" aria-selected="false" aria-controls="panel-list">예약처 모음</button>
  <button class="tab" role="tab" id="tab-fav" aria-selected="false" aria-controls="panel-fav">찜</button>
</nav>

<main>
  <section id="panel-open" class="panel" role="tabpanel" aria-labelledby="tab-open">
    <h2 class="sec-title">곧 열려요 <span class="hint">7일 안</span></h2>
    <div id="soon" class="soon"></div>
    <h2 class="sec-title">앞으로 60일</h2>
    <div id="calendar" class="calendar"></div>
  </section>

  <section id="panel-list" class="panel" role="tabpanel" aria-labelledby="tab-list" hidden>
    <div id="filters" class="filters"></div>
    <div id="cards" class="cards"></div>
    <h2 class="sec-title">서울시 공공예약 유아 프로그램</h2>
    <p class="hint block" id="public-meta"></p>
    <div id="public-list" class="public-list"></div>
  </section>

  <section id="panel-fav" class="panel" role="tabpanel" aria-labelledby="tab-fav" hidden>
    <p class="hint block">별표를 누른 곳의 다음 오픈 일정이에요. 내 달력에 넣으면 10분 전에 알림이 와요.</p>
    <button id="fav-ics" class="btn primary" type="button" hidden>찜한 곳 오픈 일정 내 달력에 넣기</button>
    <div id="fav-list" class="cards"></div>
  </section>
</main>

<dialog id="detail" class="detail" aria-labelledby="detail-title"></dialog>

<footer class="foot">
  <a href="https://spica07.github.io/kid-festival/">꼬마 놀이터 행사 보러 가기</a>
  <p>정보 공유를 위한 비영리 사이트예요. 예약 조건은 바뀔 수 있으니 꼭 공식 안내를 먼저 확인해 주세요. "예상"은 반복 규칙으로 계산한 날짜, "확정"은 공식 공지로 확인한 날짜예요.</p>
</footer>

<script src="assets/js/schedule.js"></script>
<script src="assets/js/ics.js"></script>
<script src="assets/js/favorites.js"></script>
<script src="assets/data/programs.js"></script>
<script src="assets/data/public-programs.js"></script>
<script src="assets/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: `assets/css/app.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@400;700&display=swap');

:root {
  --ink: #4A4A6A; --main: #6B5B95; --point: #FF8A5B; --soft: #FFE5F1;
  --card: #FFFFFF; --line: rgba(107, 91, 149, 0.14); --muted: #8A87A3;
  --ok: #2E9E6B; --ok-bg: #E3F6EC; --guess: #B07A00; --guess-bg: #FFF4D6;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Jua', 'Gaegu', sans-serif; color: var(--ink);
  background: linear-gradient(135deg, #FFE5F1 0%, #E5F4FF 50%, #FFF9E5 100%) fixed;
  min-height: 100vh; overflow-x: hidden;
}
.ico { width: 1.1em; height: 1.1em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.15em; }
.top { text-align: center; padding: 18px 16px 6px; }
.top h1 { color: var(--main); font-size: 1.6rem; display: inline-flex; gap: 8px; align-items: center; }
.sub { color: var(--muted); font-size: 0.95rem; margin-top: 4px; }
.tabs { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; justify-content: center; padding: 10px 16px;
  background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(8px); box-shadow: 0 2px 12px rgba(107, 91, 149, 0.08); }
.tab { font: inherit; font-size: 1rem; color: var(--main); background: #fff; border: 2px solid var(--soft); border-radius: 24px; padding: 8px 18px; cursor: pointer; }
.tab.active { background: var(--main); color: #fff; border-color: var(--main); }
main { max-width: 860px; margin: 0 auto; padding: 12px 16px 24px; }
.sec-title { color: var(--main); font-size: 1.15rem; margin: 18px 0 8px; }
.hint { color: var(--muted); font-size: 0.85rem; font-family: 'Gaegu', sans-serif; }
.hint.block { display: block; margin-bottom: 10px; }
.empty { background: rgba(255, 255, 255, 0.7); border-radius: 16px; padding: 18px; text-align: center; color: var(--muted); }

.soon { display: grid; gap: 10px; }
.group { background: var(--card); border-radius: 18px; padding: 12px 14px; box-shadow: 0 3px 12px rgba(107, 91, 149, 0.08); }
.group-head { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; margin-bottom: 6px; }
.group-when { font-size: 1.1rem; color: var(--main); }
.countdown { color: var(--point); font-size: 0.95rem; }
.together { font-size: 0.8rem; color: #fff; background: var(--point); border-radius: 10px; padding: 2px 8px; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px dashed var(--line); }
.row:first-of-type { border-top: 0; }
.row.past { opacity: 0.45; }
.row-time { flex: 0 0 auto; min-width: 4.6em; color: var(--main); }
.row-name { flex: 1 1 auto; min-width: 0; background: none; border: 0; font: inherit; color: var(--ink); text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.row-name small { color: var(--muted); }
.badge { flex: 0 0 auto; font-size: 0.75rem; border-radius: 8px; padding: 2px 6px; }
.badge.ok { color: var(--ok); background: var(--ok-bg); }
.badge.guess { color: var(--guess); background: var(--guess-bg); }
.badge.pub { color: var(--main); background: #EEEAF7; }
.region { flex: 0 0 auto; font-size: 0.75rem; color: var(--muted); }
.day { margin-top: 12px; }
.day-head { font-size: 1rem; color: var(--main); margin-bottom: 4px; }
.day-head.weekend { color: var(--point); }

.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.chip { font: inherit; font-size: 0.9rem; border: 2px solid var(--soft); background: #fff; color: var(--main); border-radius: 18px; padding: 5px 12px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--main); border-color: var(--main); color: #fff; }
.filter-row { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.card { position: relative; background: var(--card); border-radius: 18px; padding: 14px 14px 12px; box-shadow: 0 3px 12px rgba(107, 91, 149, 0.08); display: flex; flex-direction: column; gap: 6px; }
.card h3 { font-size: 1.05rem; color: var(--main); padding-right: 36px; }
.card .meta { font-size: 0.85rem; color: var(--muted); }
.card .rule { font-size: 0.9rem; }
.card .next { font-size: 0.9rem; color: var(--point); }
.card .open-detail { margin-top: auto; align-self: flex-start; }
.star { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border: 0; background: none; color: #C9C3DD; cursor: pointer; }
.star .ico { width: 24px; height: 24px; }
.star[aria-pressed="true"] { color: var(--point); }
.star[aria-pressed="true"] .ico { fill: currentColor; }
.btn { font: inherit; font-size: 0.95rem; border-radius: 14px; padding: 7px 14px; border: 2px solid var(--main); background: #fff; color: var(--main); cursor: pointer; text-decoration: none; display: inline-flex; gap: 6px; align-items: center; }
.btn.primary { background: var(--main); color: #fff; margin-bottom: 12px; }
.public-list { display: grid; gap: 8px; }
.pub-item { background: rgba(255, 255, 255, 0.85); border-radius: 14px; padding: 10px 12px; font-size: 0.9rem; }
.pub-item a { color: var(--main); }
.pub-item .meta { color: var(--muted); font-size: 0.8rem; margin-top: 2px; }

.detail { border: 0; border-radius: 20px; padding: 18px; width: min(520px, calc(100vw - 32px)); max-height: 85vh; color: var(--ink); font-family: inherit; }
.detail::backdrop { background: rgba(74, 74, 106, 0.35); }
.detail h2 { color: var(--main); font-size: 1.25rem; margin-bottom: 8px; padding-right: 32px; }
.detail dl { display: grid; grid-template-columns: 5.5em 1fr; gap: 6px 10px; font-size: 0.95rem; margin: 10px 0; }
.detail dt { color: var(--muted); }
.detail ul { list-style: none; display: grid; gap: 4px; margin: 6px 0 12px; }
.detail .stale { color: var(--guess); background: var(--guess-bg); border-radius: 10px; padding: 6px 10px; font-size: 0.85rem; }
.detail .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.detail .close { position: absolute; top: 12px; right: 12px; border: 0; background: none; color: var(--muted); width: 32px; height: 32px; cursor: pointer; }

.foot { max-width: 860px; margin: 0 auto; padding: 16px 16px 32px; font-size: 0.85rem; color: var(--muted); font-family: 'Gaegu', sans-serif; }
.foot a { color: var(--main); font-family: 'Jua', sans-serif; font-size: 1rem; display: inline-block; margin-bottom: 6px; }

@media (max-width: 420px) {
  .top h1 { font-size: 1.35rem; }
  .tab { padding: 7px 12px; font-size: 0.95rem; }
  .cards { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: `assets/js/app.js`**

```js
/* 화면 그리기. 계산은 KRSchedule, 달력 파일은 KRIcs, 찜은 KRFavorites에 맡기고 여기선 엮기만 한다. */
(function () {
  'use strict';
  const S = window.KRSchedule;
  const I = window.KRIcs;
  const DAYS_AHEAD = 60;
  const SOON_DAYS = 7;
  const STALE_DAYS = 45;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const REGIONS = [['seoul', '서울'], ['gyeonggi', '경기'], ['incheon', '인천']];
  const CATEGORIES = ['박물관·과학관', '방송·직업체험', '금융·경제교육', '자연·생태', '공연·문화', '놀이·키즈카페', '안전체험'];
  const METHODS = ['선착순', '추첨', '상시'];
  const ICON_STAR = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  const ICON_X = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_LINK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const ICON_CAL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>';

  const programs = Array.isArray(window.KR_PROGRAMS) ? window.KR_PROGRAMS.filter(S.isValidProgram) : null;
  const pub = window.KR_PUBLIC && Array.isArray(window.KR_PUBLIC.items) ? window.KR_PUBLIC : null;
  let storage = null;
  try { storage = window.localStorage; } catch (e) { storage = null; }
  const fav = window.KRFavorites.createFavorites(storage);
  const filters = { region: null, category: null, method: null, free: false };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = id => (programs || []).find(p => p.id === id);

  function dayLabel(date) {
    const [y, m, d] = date.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return { text: `${m}월 ${d}일 (${WEEKDAYS[wd]})`, weekend: wd === 0 || wd === 6 };
  }

  function countdown(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1) return '곧 열려요';
    if (min < 60) return `${min}분 뒤`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}시간 ${min % 60}분 뒤`;
    return `${Math.floor(h / 24)}일 뒤`;
  }

  /* 큐레이션 일정 + 공공예약 접수 시작을 한 목록으로 */
  function allEvents(now) {
    const today = S.kstToday(now);
    const end = S.addDays(today, DAYS_AHEAD - 1);
    const out = [];
    (programs || []).forEach(p => {
      S.occurrences(p, today, DAYS_AHEAD).forEach(o => out.push({
        key: `${p.id}|${o.date}`, date: o.date, time: o.time, label: o.label, confirmed: o.confirmed,
        name: p.name, region: p.regionName, programId: p.id, url: p.bookingUrl, kind: 'curated',
      }));
    });
    (pub ? pub.items : []).forEach(it => {
      const [date, time] = it.rcptStart.split(' ');
      if (date < today || date > end) return;
      out.push({ key: `pub|${it.id}`, date, time, label: it.place, confirmed: true,
        name: it.name, region: it.area, url: it.url, kind: 'public' });
    });
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.name.localeCompare(b.name, 'ko'));
  }

  function rowHtml(e, now) {
    const past = S.toInstant(e.date, e.time).getTime() <= now.getTime();
    const badge = e.kind === 'public' ? '<span class="badge pub">서울시 공공예약</span>'
      : e.confirmed ? '<span class="badge ok">확정</span>' : '<span class="badge guess">예상</span>';
    const nameBtn = e.kind === 'public'
      ? `<a class="row-name" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)} <small>${esc(e.label)}</small></a>`
      : `<button class="row-name" type="button" data-detail="${esc(e.programId)}">${esc(e.name)} <small>${esc(e.label)}</small></button>`;
    return `<div class="row${past ? ' past' : ''}"><span class="row-time">${esc(S.formatTime(e.time))}</span>${nameBtn}${badge}<span class="region">${esc(e.region)}</span></div>`;
  }

  /* 같은 날 같은 시각에 열리는 것끼리 묶는다 */
  function groupBySlot(events) {
    const groups = [];
    events.forEach(e => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date && last.time === e.time) last.items.push(e);
      else groups.push({ date: e.date, time: e.time, items: [e] });
    });
    return groups;
  }

  function renderOpen(now) {
    if (!programs && !pub) {
      $('soon').innerHTML = $('calendar').innerHTML = '<p class="empty">목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>';
      return;
    }
    const events = allEvents(now);
    const soonEnd = now.getTime() + SOON_DAYS * 86400000;
    const soon = events.filter(e => { const t = S.toInstant(e.date, e.time).getTime(); return t > now.getTime() && t <= soonEnd; });
    $('soon').innerHTML = soon.length ? groupBySlot(soon).map(g => {
      const ms = S.toInstant(g.date, g.time).getTime() - now.getTime();
      const cd = ms < 86400000 ? `<span class="countdown">${countdown(ms)}</span>` : '';
      const together = g.items.length > 1 ? `<span class="together">${g.items.length}곳 동시 오픈</span>` : '';
      return `<div class="group"><div class="group-head"><span class="group-when">${dayLabel(g.date).text} ${esc(S.formatTime(g.time))}</span>${cd}${together}</div>${g.items.map(e => rowHtml(e, now)).join('')}</div>`;
    }).join('') : '<p class="empty">7일 안에 열리는 예약이 없어요.</p>';

    const days = [];
    events.forEach(e => { const last = days[days.length - 1]; if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); });
    $('calendar').innerHTML = days.length ? days.map(d => {
      const l = dayLabel(d.date);
      return `<div class="day"><div class="day-head${l.weekend ? ' weekend' : ''}">${l.text}</div><div class="group">${d.items.map(e => rowHtml(e, now)).join('')}</div></div>`;
    }).join('') : '<p class="empty">앞으로 60일 안에 잡힌 오픈 일정이 없어요.</p>';
  }

  function chip(group, value, label, pressed) {
    return `<button class="chip" type="button" data-filter="${group}" data-value="${esc(value)}" aria-pressed="${pressed}">${esc(label)}</button>`;
  }

  function renderFilters() {
    $('filters').innerHTML = [
      `<div class="filter-row">${chip('region', '', '전체 지역', !filters.region)}${REGIONS.map(([v, l]) => chip('region', v, l, filters.region === v)).join('')}${chip('free', '1', '무료만', filters.free)}</div>`,
      `<div class="filter-row">${chip('category', '', '전체 분류', !filters.category)}${CATEGORIES.map(c => chip('category', c, c, filters.category === c)).join('')}</div>`,
      `<div class="filter-row">${chip('method', '', '전체 방식', !filters.method)}${METHODS.map(m => chip('method', m, m, filters.method === m)).join('')}</div>`,
    ].join('');
  }

  function cardHtml(p, now) {
    const next = S.nextOccurrences(p, now, 1)[0];
    const nextText = next ? `다음 오픈 ${dayLabel(next.date).text} ${S.formatTime(next.time)}${next.label ? ` · ${next.label}` : ''}${next.confirmed ? '' : ' (예상)'}` : '';
    const star = fav.available
      ? `<button class="star" type="button" data-star="${esc(p.id)}" aria-pressed="${fav.has(p.id)}" aria-label="${esc(p.name)} 찜하기">${ICON_STAR}</button>` : '';
    return `<article class="card">${star}<h3>${esc(p.name)}</h3>
      <div class="meta">${esc(p.regionName)} · ${esc(p.category)} · ${esc(p.age)} · ${esc(p.fee)}</div>
      <div class="rule">${esc(S.describeRule(p.open))}</div>
      ${nextText ? `<div class="next">${esc(nextText)}</div>` : ''}
      <button class="btn open-detail" type="button" data-detail="${esc(p.id)}">자세히 보기</button></article>`;
  }

  function renderList(now) {
    renderFilters();
    if (!programs) { $('cards').innerHTML = '<p class="empty">예약처 목록을 불러오지 못했어요.</p>'; }
    else {
      const list = programs.filter(p => (!filters.region || p.region === filters.region)
        && (!filters.category || p.category === filters.category)
        && (!filters.method || p.method === filters.method)
        && (!filters.free || p.free));
      $('cards').innerHTML = list.length ? list.map(p => cardHtml(p, now)).join('') : '<p class="empty">조건에 맞는 곳이 없어요.</p>';
    }
    if (!pub) { $('public-meta').textContent = ''; $('public-list').innerHTML = '<p class="empty">공공예약 목록을 불러오지 못했어요.</p>'; return; }
    $('public-meta').textContent = `서울시 공공서비스예약에서 ${pub.generatedAt.slice(0, 10)}에 모은 유아·가족 프로그램 ${pub.items.length}개예요.`;
    $('public-list').innerHTML = pub.items.map(it => `<div class="pub-item"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)}</a>
      <div class="meta">${esc(it.area)} ${esc(it.place)} · ${esc(it.target)} · ${esc(it.fee)} · 접수 ${esc(it.rcptStart)} ~ ${esc(it.rcptEnd)} · ${esc(it.status)}</div></div>`).join('');
  }

  function renderFav(now) {
    if (!fav.available) { $('fav-list').innerHTML = '<p class="empty">이 브라우저에서는 찜을 저장할 수 없어요. 사생활 보호 모드라면 일반 창에서 열어 주세요.</p>'; $('fav-ics').hidden = true; return; }
    const list = fav.list().map(byId).filter(Boolean);
    $('fav-ics').hidden = !list.length;
    $('fav-list').innerHTML = list.length ? list.map(p => cardHtml(p, now)).join('') : '<p class="empty">아직 찜한 곳이 없어요. 예약처 모음에서 별표를 눌러 보세요.</p>';
  }

  function icsEventsFor(p, now) {
    return S.occurrences(p, S.kstToday(now), DAYS_AHEAD)
      .filter(o => S.toInstant(o.date, o.time).getTime() > now.getTime())
      .map(o => ({ uid: `${p.id}-${o.date}@kid-reservation`, date: o.date, time: o.time,
        title: `[예약 오픈] ${p.name}${o.label ? ` ${o.label}` : ''}`,
        description: `${S.describeRule(p.open)}${o.confirmed ? '' : ' (반복 규칙으로 계산한 예상 날짜예요)'}\n${p.bookingUrl}`, url: p.bookingUrl }));
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openDetail(id, now) {
    const p = byId(id);
    if (!p) return;
    const next = S.nextOccurrences(p, now, 3);
    const ageDays = Math.floor((now.getTime() - S.toInstant(p.verifiedAt, '00:00').getTime()) / 86400000);
    const dlg = $('detail');
    dlg.innerHTML = `<button class="close" type="button" data-close aria-label="닫기">${ICON_X}</button>
      <h2 id="detail-title">${esc(p.name)}</h2>
      <dl><dt>장소</dt><dd>${esc(p.location)}</dd><dt>대상</dt><dd>${esc(p.age)}</dd><dt>요금</dt><dd>${esc(p.fee)}</dd>
      <dt>예약 방식</dt><dd>${esc(p.method)}</dd><dt>예약 열림</dt><dd>${esc(S.describeRule(p.open))}</dd><dt>팁</dt><dd>${esc(p.tip)}</dd></dl>
      ${next.length ? `<strong>다음 오픈</strong><ul>${next.map(o => `<li>${dayLabel(o.date).text} ${esc(S.formatTime(o.time))}${o.label ? ` · ${esc(o.label)}` : ''} <span class="badge ${o.confirmed ? 'ok">확정' : 'guess">예상'}</span></li>`).join('')}</ul>` : ''}
      <p class="hint">${esc(p.verifiedAt)}에 공식 안내로 확인했어요.</p>
      ${ageDays > STALE_DAYS ? '<p class="stale">확인한 지 오래됐어요. 예약 전에 공식 안내를 꼭 다시 봐 주세요.</p>' : ''}
      <div class="actions"><a class="btn primary" href="${esc(p.bookingUrl)}" target="_blank" rel="noopener">${ICON_LINK}공식 예약 페이지</a>
      ${next.length ? `<button class="btn" type="button" data-ics="${esc(p.id)}">${ICON_CAL}내 달력에 넣기</button>` : ''}</div>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function showTab(name) {
    ['open', 'list', 'fav'].forEach(t => {
      const on = t === name;
      $(`tab-${t}`).classList.toggle('active', on);
      $(`tab-${t}`).setAttribute('aria-selected', String(on));
      $(`panel-${t}`).hidden = !on;
    });
    try { sessionStorage.setItem('kr-tab', name); } catch (e) { /* 무시 */ }
    render();
  }

  let current = 'open';
  function render() {
    const now = new Date();
    current = ['open', 'list', 'fav'].find(t => !$(`panel-${t}`).hidden) || 'open';
    if (current === 'open') renderOpen(now);
    if (current === 'list') renderList(now);
    if (current === 'fav') renderFav(now);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button, a');
    if (!t) return;
    const now = new Date();
    if (t.id === 'tab-open') showTab('open');
    else if (t.id === 'tab-list') showTab('list');
    else if (t.id === 'tab-fav') showTab('fav');
    else if (t.dataset.detail) openDetail(t.dataset.detail, now);
    else if (t.dataset.star) { fav.toggle(t.dataset.star); render(); }
    else if (t.dataset.filter) {
      const { filter, value } = t.dataset;
      if (filter === 'free') filters.free = !filters.free;
      else filters[filter] = value || null;
      render();
    } else if (t.dataset.ics) {
      const p = byId(t.dataset.ics);
      download(`${p.id}.ics`, I.buildIcs(icsEventsFor(p, now)));
    } else if (t.id === 'fav-ics') {
      const evs = fav.list().map(byId).filter(Boolean).flatMap(p => icsEventsFor(p, now));
      download('kid-reservation.ics', I.buildIcs(evs));
    } else if (t.hasAttribute('data-close')) $('detail').close();
  });
  $('detail').addEventListener('click', ev => { if (ev.target === $('detail')) $('detail').close(); });

  let saved = 'open';
  try { saved = sessionStorage.getItem('kr-tab') || 'open'; } catch (e) { /* 무시 */ }
  showTab(['open', 'list', 'fav'].includes(saved) ? saved : 'open');
  setInterval(() => { if (current === 'open' && !$('detail').open) renderOpen(new Date()); }, 30000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
```

- [ ] **Step 6: `sw.js`** (네트워크 우선 + 캐시 대체 — 데이터가 자주 바뀌므로)

```js
/* 콘텐츠를 바꾸면 CACHE 숫자를 올린다. 데이터가 자주 바뀌어 네트워크 우선으로 받고, 끊겼을 때만 캐시를 쓴다. */
const CACHE = 'kr-cache-v1';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'assets/css/app.css',
  'assets/js/schedule.js', 'assets/js/ics.js', 'assets/js/favorites.js', 'assets/js/app.js',
  'assets/data/programs.js', 'assets/data/public-programs.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/favicon-64.png', 'assets/icons/apple-touch-icon.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
```

- [ ] **Step 7: 스크린샷 검증 스크립트** — `tools/screenshot.py`

```python
"""화면 검증: 세 탭을 모바일·PC 폭으로 찍고 콘솔 오류를 모은다.
실행: py tools/screenshot.py  → 스크래치 폴더(환경변수 KR_SHOT_DIR, 기본 ./shots)에 PNG"""
import os, pathlib, http.server, threading, functools
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('KR_SHOT_DIR', ROOT / 'shots'))
OUT.mkdir(parents=True, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for label, w, h in [('m', 360, 780), ('pc', 1280, 900)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, timezone_id='UTC', locale='ko-KR')
        page = ctx.new_page()
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8765/index.html')
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / f'{label}-open.png'), full_page=True)
        page.click('#tab-list'); page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f'{label}-list.png'), full_page=True)
        page.locator('[data-star]').first.click()
        page.locator('[data-detail]').first.click(); page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f'{label}-detail.png'))
        page.keyboard.press('Escape')
        page.click('#tab-fav'); page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f'{label}-fav.png'), full_page=True)
        sw = page.evaluate('document.documentElement.scrollWidth')
        print(f'{label}: scrollWidth={sw} (뷰포트 {w})')
        ctx.close()
    b.close()
srv.shutdown()
print('콘솔 오류:', errors or '없음')
print('저장 위치:', OUT)
```

`.gitignore`에 `shots/` 추가.

- [ ] **Step 8: 실행해서 확인**

```bash
py tools/make_icons.py
KR_SHOT_DIR="<스크래치 폴더>/shots" PYTHONIOENCODING=utf-8 py tools/screenshot.py
```
Expected: `m: scrollWidth=360`, `pc: scrollWidth=1280`, `콘솔 오류: 없음`. 이어서 PNG 8장을 Read로 열어 눈으로 확인한다:
- 오픈 달력: "곧 열려요"에 시각순 묶음, 동시 오픈 배지, 확정/예상/서울시 공공예약 배지가 보인다. 브라우저 시간대를 UTC로 두었는데도 시각이 KST 기준이다(예: 10:00 일정이 "오전 10시").
- 예약처 모음: 필터 칩 세 줄, 카드에 다음 오픈, 360px에서 한 줄 카드.
- 상세: 다음 오픈 3회, 공식 예약 버튼, 달력 버튼.
- 찜: 별표 한 곳이 보이고 "내 달력에 넣기" 버튼이 보인다.
- 이모지가 하나도 없다: `grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' index.html assets/js/*.js assets/css/*.css` → 출력 없음.

- [ ] **Step 9: .ics 실제 파일 확인**

```bash
node -e "
const S=require('./assets/js/schedule.js'),I=require('./assets/js/ics.js'),vm=require('vm'),fs=require('fs');
const c={window:{}};vm.runInNewContext(fs.readFileSync('assets/data/programs.js','utf8'),c);
const p=c.window.KR_PROGRAMS.find(x=>x.open.rule==='monthly');
const evs=S.occurrences(p,S.kstToday(new Date()),60).map(o=>({uid:p.id+'-'+o.date,date:o.date,time:o.time,title:'[예약 오픈] '+p.name+' '+o.label,url:p.bookingUrl}));
process.stdout.write(I.buildIcs(evs));" > "$TEMP/kr-test.ics"
head -40 "$TEMP/kr-test.ics"
```
Expected: VTIMEZONE·VEVENT·VALARM이 있고 한글 제목이 깨지지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add index.html manifest.json sw.js assets/css assets/js/app.js assets/icons tools/make_icons.py tools/screenshot.py .gitignore
git commit -m "화면: 오픈 달력·예약처 모음·찜 탭, PWA, 화면 검증 스크립트"
```

---

### Task 7: README와 GitHub 배포

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md`**

```markdown
# 꼬마 예약 달력 (kid-reservation)

서울·경기·인천 미취학 아이 인기 체험·프로그램 예약이 **언제 열리는지** 한눈에 보는 정적 PWA입니다.
"우리 동네 꼬마 놀이터"(kid-festival)의 패밀리 앱입니다. 예약은 대신하지 않고 공식 예약 페이지로 연결합니다.

## 구조
- `assets/data/programs.js` — 사람이 관리하는 인기 예약처. 오픈 규칙(`open`)과 확정 일정(`overrides`).
- `assets/data/public-programs.js` — 서울시 공공서비스예약 유아·가족 프로그램(스크립트 생성, 손으로 고치지 않음).
- `assets/js/schedule.js` 일정 계산 · `ics.js` 달력 파일 · `favorites.js` 찜 · `app.js` 화면.

## 오픈 규칙
| rule | 예 |
|---|---|
| `monthly` | `{rule:'monthly', day:1, time:'10:00', target:'next-month'}` 매월 1일 오전 10시, 다음 달분 |
| `monthlyWeekday` | `{rule:'monthlyWeekday', week:2, weekday:2, time:'14:00'}` 매월 둘째 주 화요일 (`week:-1`은 마지막 주) |
| `weekly` | `{rule:'weekly', weekday:1, time:'09:00'}` 매주 월요일 |
| `fixed` | `overrides`에 넣은 날짜만 |
| `always` | 상시 예약 |

`overrides: [{date, time, note}]`는 같은 달(매주 규칙은 같은 날)의 계산 결과를 대신하고 "확정"으로 표시됩니다. `{date, cancel:true}`는 그 회차를 없앱니다.
그달에 31일이 없으면 말일로 계산합니다.

## 갱신
1. 공공예약: `py tools/fetch_seoul_reservation.py` (`.env`에 `SEOUL_API_KEY`). 출력되는 "뺀 문구"를 훑어 필터가 놓친 게 없는지 봅니다.
2. 큐레이션: 매달 말, 다음 달 오픈 공지를 공식 사이트에서 확인해 `overrides`에 넣고 `verifiedAt`을 고칩니다. **공식 안내로 확인하지 못한 규칙은 넣지 않습니다.** 45일 넘게 확인 안 한 항목은 화면에 "확인한 지 오래됐어요"가 뜹니다.
3. `node --test tests/` 와 `py -m unittest tests/test_fetch.py` 통과 확인.
4. `sw.js`의 `CACHE` 숫자를 올리고 커밋·푸시.

## 화면 확인
`py tools/screenshot.py` — 360px·1280px로 세 탭을 찍고 콘솔 오류를 보여 줍니다(브라우저 시간대를 UTC로 두어 KST 계산을 함께 확인).

## 안내 문구
정보 공유 목적의 비영리 사이트입니다. 상표·시설명·프로그램명의 권리는 해당 권리자에게 있습니다.
```

- [ ] **Step 2: 전체 테스트 한 번 더**

Run: `node --test tests/ && py -m unittest tests/test_fetch.py`
Expected: 둘 다 실패 0

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "README: 오픈 규칙 형식과 갱신 절차"
```

- [ ] **Step 4: GitHub 저장소 만들고 Pages 켜기** — **실행 전에 사용자에게 공개(public) 저장소로 올려도 되는지 확인받는다.** (워크스페이스의 웹앱은 Pages 때문에 public이다.)

```bash
gh repo create spica07/kid-reservation --public --source . --remote origin --push
gh api -X POST repos/spica07/kid-reservation/pages -f "source[branch]=main" -f "source[path]=/"
gh api repos/spica07/kid-reservation/pages --jq .html_url
```
Expected: `https://spica07.github.io/kid-reservation/`. 1~2분 뒤 `curl -s -o /dev/null -w '%{http_code}' https://spica07.github.io/kid-reservation/` → `200`.

---

### Task 8: kid-festival에서 연결

**Files:**
- Modify: `C:\blog_writing\kid-festival\index.html` (탭 바, `<button class="tab-btn tab-icon" ... data-target="about"` 바로 앞)
- Modify: `C:\blog_writing\kid-festival\assets\css\index.css` (끝에 추가)
- Modify: `C:\blog_writing\kid-festival\sw.js` (`CACHE` 버전 +1)

`assets/js/pages/index.js`는 `.tab-btn`만 탭으로 다루므로, 새 링크는 `.tab-btn`을 쓰지 않아야 iframe 전환 로직에 걸리지 않는다.

- [ ] **Step 1: 탭 바에 링크 추가** — `index.html`의 healing/guide 버튼이 있는 `<div class="tab-group">` 닫는 `</div>` 바로 앞에:

```html
    <a class="tab-link" href="https://spica07.github.io/kid-reservation/" title="미취학 아이 인기 체험 예약 오픈 일정">인기 예약</a>
```

- [ ] **Step 2: 스타일** — `assets/css/index.css` 끝에:

```css
  /* 패밀리 앱(꼬마 예약 달력)으로 가는 링크. 탭 버튼처럼 보이지만 iframe 전환이 아니라 페이지 이동이다. */
  .tab-link {
    background: white;
    border: 2px solid #FFE5F1;
    padding: 9px 22px;
    border-radius: 24px;
    font-family: inherit;
    font-size: 1rem;
    color: #6B5B95;
    font-weight: bold;
    text-decoration: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    white-space: nowrap;
  }
  .tab-link:hover { border-color: #FFB5D8; }
```

그다음 `index.css`에서 `.tab-btn`에 걸린 모바일 `@media` 규칙(패딩·글자 크기 축소)을 찾아 같은 선택자 목록에 `.tab-link`를 함께 넣는다(`grep -n "@media" -A12 assets/css/index.css`로 위치 확인).

- [ ] **Step 3: 캐시 버전** — `sw.js`의 `const CACHE = 'kkoma-cache-vNN';`의 숫자를 1 올린다.

- [ ] **Step 4: 확인** — kid-festival 폴더에서 정적 서버를 띄우고 Playwright로 360px·1280px 탭 바를 찍어, 버튼이 한 줄에서 넘치지 않는지·기존 탭 전환이 그대로인지 본다.

```bash
cd /c/blog_writing/kid-festival && py -c "
import http.server,threading,functools
from playwright.sync_api import sync_playwright
h=functools.partial(http.server.SimpleHTTPRequestHandler,directory='.')
s=http.server.ThreadingHTTPServer(('127.0.0.1',8766),h);threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (360,1280):
    pg=b.new_page(viewport={'width':w,'height':700});pg.goto('http://127.0.0.1:8766/index.html');pg.wait_for_timeout(800)
    pg.screenshot(path=r'$TEMP/kf-tab-%d.png'%w,clip={'x':0,'y':0,'width':w,'height':160})
    pg.click('button[data-target=healing]');pg.wait_for_timeout(300)
    print(w,'healing visible:',pg.is_visible('#frame-healing'),'scrollWidth',pg.evaluate('document.documentElement.scrollWidth'))
  b.close()
s.shutdown()"
```
Expected: `healing visible: True`, scrollWidth가 뷰포트 폭과 같음. PNG를 Read로 열어 "인기 예약" 링크가 보이는지 확인.

- [ ] **Step 5: kid-festival 저장소에서 커밋** (푸시는 사용자 확인 후)

```bash
cd /c/blog_writing/kid-festival
git add index.html assets/css/index.css sw.js
git commit -m "패밀리 앱 '꼬마 예약 달력' 링크를 탭 바에 추가, 캐시 버전 올림"
```

---

## Self-Review 결과

- 스펙 1장(목적·성공 기준) → Task 5(40곳 이상, 사용자 예시 2곳), Task 6(곧 열려요, 확정/예상, .ics).
- 2장(구조·CSP) → Task 6 index.html. 3.1 → Task 1·5. 3.2 → Task 4(접수중·안내중만 남기도록 명시). 4장 화면 → Task 6. 5장 → Task 1. 6장 → Task 2. 7장 오류 처리 → Task 3, Task 6 `renderOpen`/`renderList` 빈 데이터 처리, `isValidProgram` 필터. 8장 → Task 8. 9장 → 각 Task 테스트 + Task 6 Step 8. 10장 범위 밖 → 다루지 않음.
- Review Focus 5개 → 각각 Task 1(1·2·3), Task 3(4), Task 2(5)에 테스트로 들어가 있음.
