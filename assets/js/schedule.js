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
    const timeOk = /^\d{2}:\d{2}$/.test(o.time || '');
    if (o.rule === 'rolling') return timeOk && Number.isInteger(o.daysBefore) && o.daysBefore >= 1;
    if (!TIMED_RULES.includes(o.rule) || !timeOk) return false;
    if (o.rule === 'monthly') return [].concat(o.day).every(d => Number.isInteger(d) && d >= 1 && d <= 31);
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
      const dates = open.rule === 'monthly'
        ? [].concat(open.day).map(day => ymd(y, m, Math.min(day, daysInMonth(y, m))))
        : [nthWeekday(y, m, open.week, open.weekday)];
      dates.forEach(d => {
        let date = d;
        // 주말이면 다음 평일로. 그러면 다음 달로 넘어가는 월말은 그 달 마지막 평일로 당긴다
        // (공휴일은 알 수 없으니 overrides로 확정한다)
        if (date && open.rule === 'monthly' && open.weekdayOnly) {
          const wd = weekdayOf(date);
          const fwd = wd === 6 ? addDays(date, 2) : wd === 0 ? addDays(date, 1) : date;
          date = fwd.slice(0, 7) === date.slice(0, 7) ? fwd : addDays(date, wd === 6 ? -1 : -2);
        }
        if (date && date >= from && date <= to) out.push(date);
      });
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
    // 한 달에 한 번 열리는 규칙만 '그 달 회차'를 통째로 대체하고, 여러 번 열리면 날짜 단위로 맞춘다
    const byMonth = (open.rule === 'monthly' && !Array.isArray(open.day)) || open.rule === 'monthlyWeekday';
    const keyOf = d => (byMonth ? d.slice(0, 7) : d);
    const labelOf = d => { const { y, m } = parse(d); return targetLabel(open.target, y, m); };
    const overrides = Array.isArray(program.overrides) ? program.overrides.filter(o => o && o.date) : [];
    // replaces: 확정일이 다른 달(날)로 옮겨졌을 때 원래 회차의 달('YYYY-MM') 또는 날('YYYY-MM-DD')
    const overridden = new Set(overrides.map(o => o.replaces || keyOf(o.date)));

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
    if (h === 0 && mi === 0) return '0시'; // '자정'은 전날 밤인지 헷갈려서 쓰지 않는다
    const part = h === 12 ? '낮' : h < 12 ? '오전' : '오후';
    const hh = h > 12 ? h - 12 : h;
    return `${part} ${hh}시${mi ? ` ${mi}분` : ''}`;
  }

  function monthlyDay(open) {
    if (Array.isArray(open.day)) return open.day.map(d => `${d}일`).join('·');
    if (!open.weekdayOnly) return `${open.day}일`;
    return open.day === 1 ? '첫 평일' : `${open.day}일(주말이면 다음 평일)`;
  }

  function baseRule(open) {
    const tail = open.target && TARGET_TEXT[open.target] ? `, ${TARGET_TEXT[open.target]}` : '';
    switch (open.rule) {
      case 'monthly': return `매월 ${monthlyDay(open)} ${formatTime(open.time)}${tail}`;
      case 'monthlyWeekday': return `매월 ${ORDINALS[open.week]} 주 ${WEEKDAYS[open.weekday]}요일 ${formatTime(open.time)}${tail}`;
      case 'weekly': return `매주 ${WEEKDAYS[open.weekday]}요일 ${formatTime(open.time)}`;
      case 'rolling': {
        const ahead = open.daysBefore % 7 === 0 ? `${open.daysBefore / 7}주` : `${open.daysBefore}일`;
        return `관람일 ${ahead} 전 ${formatTime(open.time)}에 열려요`;
      }
      case 'fixed': return '정해진 날짜에 공지 후 열려요';
      case 'always': return '언제든 예약할 수 있어요';
      default: return '';
    }
  }

  /* open.note: 상시·수시(always/fixed)는 설명을 대신하고, 나머지는 뒤에 덧붙인다 */
  function describeRule(open) {
    if (!open) return '';
    if (!open.note) return baseRule(open);
    return open.rule === 'always' || open.rule === 'fixed' ? open.note : `${baseRule(open)} · ${open.note}`;
  }

  return { occurrences, nextOccurrences, describeRule, formatTime, kstToday, toInstant, addDays, isValidProgram };
});
