# kid-reservation 설계 — 미취학 아이 인기 예약 모음

작성일: 2026-10-05

## 1. 목적

미취학 아이와 갈 만한 **예약이 필요한 인기 체험·프로그램**을 한곳에서 보고, 특히 **매달 정해진 날 정해진 시각에 동시 오픈하는 예약**(예: 매월 1일 10:00에 다음 달 회차가 열리는 EBS 스튜디오투어, 신한 어린이 금융체험교실)을 놓치지 않게 돕는다.

- 앱은 예약을 대신하지 않는다. 각 기관의 공식 예약 페이지로 연결만 한다.
- kid-festival("우리 동네 꼬마 놀이터")의 패밀리 앱이다. 디자인 계열을 같이 쓰고 서로 링크한다.

### 성공 기준

- 첫 화면에서 "오늘·이번 주에 열리는 예약"이 시각과 함께 바로 보인다.
- 반복 오픈 규칙으로 계산한 일정은 "예상", 공식 공지로 확인한 일정은 "확정"으로 구분된다.
- 찜한 예약처의 오픈 일정을 .ics로 내보내 휴대폰 캘린더에서 10분 전 알림을 받을 수 있다.
- 수도권(서울·경기·인천) 큐레이션 40곳 이상 + 서울시 공공서비스예약의 유아·가족 프로그램.

### 사용자가 정한 것

| 항목 | 결정 |
|---|---|
| 핵심 성격 | 예약 필요한 곳 모음 + 매월 동시 오픈 일정을 한눈에 |
| 데이터 | 사람이 관리하는 큐레이션 + 서울시 공공서비스예약 API |
| 오픈 놓치지 않기 | 찜(브라우저 저장) + .ics 내 달력 추가 (서버 없음) |
| 지역 | 수도권 먼저 |
| 구조 | 독립 저장소(A안), kid-festival과 상호 링크 |

## 2. 구조

빌드 없는 정적 PWA, GitHub Pages(main) 배포. kid-festival과 같은 기술 스택.

```
kid-reservation/
  index.html                 탭 3개(오픈 달력 / 예약처 모음 / 찜)
  manifest.json, sw.js       PWA, 캐시 버전 CACHE
  assets/
    css/app.css              Jua·Gaegu, 파스텔 톤 (kid-festival 계열, 포인트 색만 다름)
    data/programs.js         큐레이션 데이터 (사람이 관리) → window.KR_PROGRAMS
    data/public-programs.js  공공예약 API 결과 (스크립트 생성) → window.KR_PUBLIC
    js/schedule.js           반복 규칙 → 오픈 일정 계산 (순수 함수, UMD: 브라우저+Node)
    js/ics.js                .ics 문자열 생성 (순수 함수, UMD)
    js/favorites.js          찜 저장 (localStorage, 실패해도 동작)
    js/app.js                화면 렌더링·탭·필터
    icons/                   앱 아이콘
  tools/
    fetch_seoul_reservation.py   공공예약 API 수집 → public-programs.js
  tests/
    schedule.test.js, ics.test.js   node --test
  .env (gitignore)           SEOUL_API_KEY
  README.md                  갱신 절차
```

CSP는 kid-festival과 같은 수준으로 `script-src 'self'`, 외부는 Google Fonts만 허용한다.

## 3. 데이터

### 3.1 큐레이션 `programs.js`

```js
{
  id: 'ebs-studio-tour',
  name: 'EBS 스튜디오투어',
  org: 'EBS',
  region: 'gyeonggi',            // seoul | gyeonggi | incheon (kid-festival과 같은 값)
  regionName: '경기',
  location: 'EBS 일산 사옥 (고양)',
  category: '방송·직업체험',      // 분류 목록은 4장
  age: '만 4세~초등',
  fee: '무료',
  free: true,
  open: { rule: 'monthly', day: 1, time: '10:00', target: 'next-month' },
  overrides: [{ date: '2026-10-01', time: '10:00', note: '11월분' }],
  method: '선착순',               // 선착순 | 추첨 | 상시
  bookingUrl: 'https://...',
  tip: '오픈 직후 마감되는 편이에요',
  verifiedAt: '2026-10-05'
}
```

`open.rule` 종류:

| rule | 필드 | 뜻 |
|---|---|---|
| `monthly` | `day`(1~31), `time`, `target`(`next-month`/`this-month`/`two-months`) | 매월 N일 오픈. 그 달에 N일이 없으면 말일 |
| `monthlyWeekday` | `week`(1~5, -1=마지막), `weekday`(0=일~6), `time`, `target` | 매월 N째 주 X요일 |
| `weekly` | `weekday`, `time` | 매주 X요일 |
| `fixed` | (없음, `overrides`만 사용) | 특정 날짜만 (시즌·추첨) |
| `always` | (없음) | 상시 예약 가능, 오픈 시각 개념 없음 |

- `target`은 표시용 라벨("11월분")을 만드는 데만 쓴다.
- `overrides`에 같은 날짜(또는 같은 달)의 항목이 있으면 규칙 계산 결과를 대체하고 "확정"으로 표시한다. `overrides`의 `cancel: true`는 그 회차를 없앤다.
- **사실 확인 규칙**: 모든 항목은 공식 안내 원문으로 확인한다. 확인하지 못한 오픈 규칙은 넣지 않고 `rule: 'always'` 또는 `fixed`로 둔다. 추정값을 넣지 않는다.

### 3.2 공공예약 `public-programs.js`

`tools/fetch_seoul_reservation.py`가 서울 열린데이터광장 `ListPublicReservationEducation`, `ListPublicReservationCulture`를 끝까지 페이지 넘기며 받는다(1회 최대 1,000행).

필터:
1. 포함 — `USETGTINFO` 또는 `SVCNM`에 `유아|어린이|미취학|가족|아동|키즈|N세(N≤7)`.
2. 제외 — 대상이 초등 이상만이거나(`초등.*이상`, `초등학교 [3-6]`, `중학생`, `청소년` 단독), 성인만인 경우.
3. 제외 — `RCPTENDDT`가 지난 것(접수 종료).
4. HTML 엔티티 정리(`html.unescape`), 공백 정리.

출력 필드: `id`(SVCID), `name`, `place`, `area`(자치구), `target`, `fee`, `rcptStart`, `rcptEnd`, `useStart`, `useEnd`, `status`, `url`, `category`(MINCLASSNM).

실행 후 출력: 전체 건수, 남은 건수, 제외된 대상 문구 상위 20개(필터 점검용).

## 4. 화면

공통 헤더: 앱 이름 "꼬마 예약 달력"(가칭), 하단에 "꼬마 놀이터 행사 보러 가기" 링크와 안내 문구(정보 공유 목적, 예약 조건은 공식 안내 우선).

### 4.1 오픈 달력 (기본 탭)

- 맨 위 "곧 열려요": 지금부터 7일 안에 오픈하는 예약을 시각순으로. 24시간 안이면 카운트다운("3시간 12분 뒤").
- 그 아래 날짜별 목록(오늘부터 60일). 각 줄: 시각 · 예약처 이름 · 회차 라벨("11월분") · 확정/예상 배지 · 지역.
- 큐레이션과 공공예약을 같은 목록에 합치되, 공공예약은 "서울시 공공예약" 작은 표시.
- 같은 시각에 여러 개가 열리면(예: 1일 10:00) 한 묶음으로 보여 "동시 오픈"이 눈에 띄게.

### 4.2 예약처 모음

- 필터: 지역(서울/경기/인천), 분류, 무료만, 예약 방식(선착순/추첨/상시).
- 분류: 박물관·과학관 / 방송·직업체험 / 금융·경제교육 / 자연·생태 / 공연·문화 / 놀이·키즈카페 / 안전체험.
- 카드 → 상세: 대상 나이, 요금, 장소, 오픈 규칙을 사람 말로("매월 1일 오전 10시, 다음 달분"), 다음 오픈 3회, 팁, 공식 예약 링크, 확인일. `verifiedAt`이 45일 넘으면 "확인한 지 오래됐어요" 표시.
- 공공예약 프로그램은 별도 구역 "서울시 공공예약 유아 프로그램"으로, 접수 기간 순.

### 4.3 찜

- 별표한 예약처의 다음 오픈 일정 목록.
- "내 달력에 추가": 찜한 예약처의 앞으로 60일 오픈 일정을 하나의 .ics로 내려받음. 각 일정에 `VALARM` 10분 전. 개별 카드에도 한 건짜리 .ics 버튼.
- 찜 목록은 `localStorage`(키 `kr-favorites`)에만 저장. 읽기·쓰기는 try/catch, 실패하면 찜 기능만 조용히 비활성.

### UI 규칙

- 이모지 대신 인라인 SVG 아이콘(`class="ico"`, `viewBox="0 0 24 24"`) — 워크스페이스 지도 앱 규칙과 맞춤.
- 모바일 우선, 360px 폭에서 가로 스크롤 없음.
- 시간은 모두 한국 시간(Asia/Seoul) 기준으로 계산·표시.

## 5. 일정 계산 `schedule.js`

- `occurrences(program, fromDate, days)` → `[{ date: 'YYYY-MM-DD', time: 'HH:MM', label, confirmed }]`
- `nextOccurrences(program, now, n)`
- `describeRule(open)` → "매월 1일 오전 10시, 다음 달분"
- 날짜는 문자열 `YYYY-MM-DD` + 시각 문자열로 다뤄 브라우저 시간대에 흔들리지 않게 한다. "지금"과 비교할 때만 KST 오프셋(+09:00)을 붙여 `Date`로 바꾼다.

## 6. .ics `ics.js`

- `buildIcs(events)` → RFC 5545 문자열. `VCALENDAR`/`VEVENT`, `DTSTART;TZID=Asia/Seoul`, 30분 길이, `SUMMARY`("[예약 오픈] EBS 스튜디오투어 11월분"), `URL`, `DESCRIPTION`, `VALARM`(`TRIGGER:-PT10M`, `ACTION:DISPLAY`), `VTIMEZONE` Asia/Seoul 포함, 줄 끝 CRLF, 75옥텟 줄 접기, `,;\` 이스케이프.
- 내려받기는 `Blob` + `a[download]`.

## 7. 오류 처리

- 데이터 스크립트가 없거나 비면 해당 구역에 "목록을 불러오지 못했어요" 안내, 다른 구역은 정상 표시.
- 규칙이 잘못된 항목(필수 필드 누락)은 일정 계산에서 빼고 콘솔에 경고.
- 오픈 시각이 지난 일정은 "곧 열려요"에서 빠지고, 오늘 목록에서는 흐리게 표시.

## 8. kid-festival 연결

- kid-festival `index.html` 상단 탭에 "인기 예약" 링크 버튼(새 앱 URL로 이동, `target="_blank"` 아님 — 같은 창). kid-festival CSP는 건드리지 않는다(iframe 아님).
- kid-festival `sw.js` `CACHE` 버전을 올린다.
- 커밋·푸시는 각 저장소 안에서 따로.

## 9. 검증

- `node --test tests/` — `schedule.js`: 월말·연말 넘김, 31일 규칙의 2월/4월, `monthlyWeekday` 마지막 주, overrides 대체·취소, `always`/`fixed`. `ics.js`: CRLF, 줄 접기, 이스케이프, VALARM 존재.
- 수집 스크립트: 실행 결과 건수·제외 문구 점검.
- Playwright로 360px·1280px 스크린샷, 세 탭 모두 확인, 콘솔 오류 없음.
- 큐레이션 데이터: 항목마다 공식 페이지 링크가 열리는지 확인, 오픈 규칙 출처 확인.

## 10. 범위 밖 (첫 버전)

웹 푸시, 로그인·동기화, 경기·인천 공공예약 API, 지도 보기, 큐레이션 갱신 스킬(첫 버전 사용 후 결정).
