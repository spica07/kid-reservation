# 꼬마 예약 달력 (kid-reservation)

서울·경기·인천 미취학 아이 인기 체험·프로그램 예약이 **언제 열리는지** 한눈에 보는 정적 PWA입니다.
"우리 동네 꼬마 놀이터"(kid-festival)의 패밀리 앱입니다. 예약은 대신하지 않고 공식 예약 페이지로 연결합니다.

## 구조
- `assets/data/programs.js` — 사람이 관리하는 인기 예약처. 오픈 규칙(`open`)과 확정 일정(`overrides`).
- `assets/data/public-programs.js` — 서울시 공공서비스예약 유아·가족 프로그램(스크립트 생성, 손으로 고치지 않음).
- `assets/js/schedule.js` 일정 계산 · `ics.js` 달력 파일 · `favorites.js` 찜 · `app.js` 화면.
- 빌드 없음. GitHub Pages(main)로 배포합니다.

## 오픈 규칙
| rule | 예 | 달력 표시 |
|---|---|---|
| `monthly` | `{rule:'monthly', day:1, time:'10:00', target:'next-month'}` 매월 1일 오전 10시, 다음 달분 | O |
| `monthly` + `weekdayOnly` | `{..., weekdayOnly:true}` 1일이 주말이면 다음 평일 (공휴일은 `overrides`로) | O |
| `monthly` 여러 날 | `{rule:'monthly', day:[1,15], time:'09:00'}` 매월 1일·15일 | O |
| `monthlyWeekday` | `{rule:'monthlyWeekday', week:1, weekday:3, time:'11:00'}` 매월 첫째 수요일 (`week:-1`은 마지막 주) | O |
| `weekly` | `{rule:'weekly', weekday:2, time:'09:00'}` 매주 화요일 | O |
| `rolling` | `{rule:'rolling', daysBefore:14, time:'00:00'}` 관람일 2주 전 0시 | X (설명만) |
| `fixed` | `overrides`에 넣은 날짜만 | 넣은 날만 |
| `always` | 오픈 시각 없이 사전 예약 | X (설명만) |

- `target`: `this-month` / `next-month` / `two-months` — "11월분" 같은 라벨만 만듭니다.
- `note`: `always`·`fixed`는 설명을 대신하고, 나머지는 설명 뒤에 붙습니다.
- `overrides: [{date, time, note}]`는 계산 결과를 대신하고 "확정"으로 표시됩니다. 한 달에 한 번 열리는 규칙은 **같은 달** 회차를, 여러 번 열리는 규칙(`day` 배열·`weekly`)은 **같은 날** 회차를 대신합니다. `{date, cancel:true}`는 그 회차를 없앱니다.
- 그달에 31일이 없으면 말일로 계산합니다.

## 갱신
1. **공공예약**: `py tools/fetch_seoul_reservation.py` (`.env`에 `SEOUL_API_KEY`, kid-festival과 같은 키). 출력되는 "뺀 문구"를 훑어 미취학 아이가 갈 수 있는데 빠진 게 없는지 봅니다. 고칠 땐 `tests/test_fetch.py`에 그 문구를 먼저 넣습니다.
2. **큐레이션**: 매달 말, 달력에 뜨는 곳(`monthly`·`monthlyWeekday`·`weekly`)의 다음 달 오픈 공지를 **공식 사이트에서** 확인해 `overrides`에 넣고 `verifiedAt`·`source`를 고칩니다.
   - **공식 안내로 확인하지 못한 규칙은 넣지 않습니다.** 모르면 `always`/`fixed` + `note`.
   - 블로그·기사·예전 데이터는 바뀌어 있을 수 있습니다. 2026-10-05에 롯데 스위트파크(매월 1일 → 첫째 수요일)와 국립인천해양박물관(전월 1일 → 매월 1·15일)이 kid-festival 데이터와 달랐습니다.
   - 45일 넘게 확인 안 한 항목은 상세 화면에 "확인한 지 오래됐어요"가 뜹니다.
3. 테스트: `node --test tests/*.test.js` 와 `py tests/test_fetch.py`.
4. `sw.js`의 `CACHE` 숫자를 올리고 커밋·푸시.

## 화면 확인
`py tools/screenshot.py` — 360px·1280px로 세 탭을 찍고 콘솔 오류를 보여 줍니다. 브라우저 시간대를 UTC로 두어 한국 시간 계산도 함께 확인합니다. 저장 위치는 `KR_SHOT_DIR`(기본 `./shots`, git 제외).

## 안내 문구
정보 공유 목적의 비영리 사이트입니다. 상표·시설명·프로그램명의 권리는 해당 권리자에게 있습니다.
