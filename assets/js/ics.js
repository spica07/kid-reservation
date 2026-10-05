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
