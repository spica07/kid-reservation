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
STRONG = re.compile(r'유아|미취학|영유아|어린이집|유치원|(?<!\d)[1-7]\s*(?:세|~\s*\d+\s*세)')
NEGATIVE = re.compile(
    r'초등[^,)]*이상|초등(학교)?\s*\d\s*~\s*\d\s*학년|초등학교\s*[3-6]|성인\(|만?\s*(?:[89]|1\d)\s*세\s*이상'
    r'|신장\s*1[2-9]\d|임산부|난임'
)


def clean(s):
    return re.sub(r'\s+', ' ', html.unescape(s or '')).strip()


# 이 문구가 있으면 유아 낱말이 있어도 뺀다(미취학 불가·기관 단체 전용)
HARD_NEGATIVE = re.compile(r'(?:미취학|유아)[^,)]*(?:불가|X)|원아|유치원 또는 어린이집|어린이집\s*기관|초등학교\s*단체')
# 대상이 이렇게 두루뭉술할 때만 제목의 낱말로 판단한다
GENERIC = re.compile(r'^(?:제한없음|누구나)?(?:\(|$)')


def is_kid_target(target, name):
    target, name = clean(target), clean(name)
    if HARD_NEGATIVE.search(target):
        return False
    if POSITIVE.search(target):
        return not NEGATIVE.search(target) or bool(STRONG.search(target))
    return bool(GENERIC.match(target)) and bool(POSITIVE.search(name))


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
