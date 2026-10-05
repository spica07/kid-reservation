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
        page.locator('#cards [data-star]').first.click()
        page.locator('#cards [data-detail]').first.click(); page.wait_for_timeout(300)
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
