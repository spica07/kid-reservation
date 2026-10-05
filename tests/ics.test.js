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
