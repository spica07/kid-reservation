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
  const PUBLIC_STEP = 20;
  let publicLimit = PUBLIC_STEP;

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
    return `<div class="row${past ? ' past' : ''}"><span class="row-time">${esc(S.formatTime(e.time))}</span><div class="row-main">${nameBtn}<div class="row-meta">${badge}<span class="region">${esc(e.region)}</span></div></div></div>`;
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
    // 공공예약은 수백 개라 인기 예약처를 덮지 않도록 '곧 열려요'에서는 개수만, 날짜별 목록에서는 접어 둔다
    const events = allEvents(now);
    const soonEnd = now.getTime() + SOON_DAYS * 86400000;
    const isSoon = e => { const t = S.toInstant(e.date, e.time).getTime(); return t > now.getTime() && t <= soonEnd; };
    const soon = events.filter(e => e.kind === 'curated' && isSoon(e));
    const soonPublic = events.filter(e => e.kind === 'public' && isSoon(e)).length;
    const publicNote = soonPublic ? `<p class="hint block">이 기간에 서울시 공공예약 유아·가족 프로그램 ${soonPublic}개도 접수를 시작해요. 아래 날짜별 목록에서 펼쳐 보세요.</p>` : '';
    $('soon').innerHTML = (soon.length ? groupBySlot(soon).map(g => {
      const ms = S.toInstant(g.date, g.time).getTime() - now.getTime();
      const cd = ms < 86400000 ? `<span class="countdown">${countdown(ms)}</span>` : '';
      const together = g.items.length > 1 ? `<span class="together">${g.items.length}곳 동시 오픈</span>` : '';
      return `<div class="group"><div class="group-head"><span class="group-when">${dayLabel(g.date).text} ${esc(S.formatTime(g.time))}</span>${cd}${together}</div>${g.items.map(e => rowHtml(e, now)).join('')}</div>`;
    }).join('') : '<p class="empty">7일 안에 열리는 인기 예약이 없어요.</p>') + publicNote;

    const days = [];
    events.forEach(e => { const last = days[days.length - 1]; if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); });
    $('calendar').innerHTML = days.length ? days.map(d => {
      const l = dayLabel(d.date);
      const curated = d.items.filter(e => e.kind === 'curated');
      const publics = d.items.filter(e => e.kind === 'public');
      const pubHtml = publics.length
        ? `<details class="pub-fold"><summary>서울시 공공예약 ${publics.length}개 접수 시작</summary>${publics.map(e => rowHtml(e, now)).join('')}</details>` : '';
      return `<div class="day"><div class="day-head${l.weekend ? ' weekend' : ''}">${l.text}</div><div class="group">${curated.map(e => rowHtml(e, now)).join('')}${pubHtml}</div></div>`;
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
    const shown = pub.items.slice(0, publicLimit);
    const more = pub.items.length > publicLimit
      ? `<button class="btn more" type="button" data-more-public>${Math.min(PUBLIC_STEP, pub.items.length - publicLimit)}개 더 보기</button>` : '';
    $('public-list').innerHTML = shown.map(it => `<div class="pub-item"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)}</a>
      <div class="meta">${esc(it.area)} ${esc(it.place)} · ${esc(it.target)} · ${esc(it.fee)} · 접수 ${esc(it.rcptStart)} ~ ${esc(it.rcptEnd)} · ${esc(it.status)}</div></div>`).join('') + more;
  }

  function renderFav(now) {
    if (!fav.available) { $('fav-list').innerHTML = '<p class="empty">이 브라우저에서는 찜을 저장할 수 없어요. 사생활 보호 모드라면 일반 창에서 열어 주세요.</p>'; $('fav-ics').hidden = true; return; }
    const list = fav.list().map(byId).filter(Boolean);
    // 상시·관람일 N일 전 방식만 찜했으면 달력에 넣을 일정이 없으니 버튼을 숨긴다(빈 .ics 방지)
    $('fav-ics').hidden = !list.some(p => icsEventsFor(p, now).length);
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
      ${icsEventsFor(p, now).length ? `<button class="btn" type="button" data-ics="${esc(p.id)}">${ICON_CAL}내 달력에 넣기</button>` : ''}</div>`;
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
    else if (t.hasAttribute('data-more-public')) { publicLimit += PUBLIC_STEP; render(); }
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
  // 카운트다운 갱신. 사용자가 펼쳐 둔 공공예약 목록이 닫히지 않게, 펼친 게 있으면 건너뛴다
  setInterval(() => {
    if (current === 'open' && !$('detail').open && !document.querySelector('.pub-fold[open]')) renderOpen(new Date());
  }, 30000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
