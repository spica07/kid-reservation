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
        self.check('어린이(6~9세 이상 어린이와 보호자)', '', True)
        self.check('가족, 고등학생, 성인, 어르신, 어린이, 청년, 청소년', '', True)
        self.check('어린이, 중학생, 초등학생', '', True)

    def test_excludes(self):
        self.check('가족(초등이상 가족 참여)', '', False)
        self.check('가족(초등학교 1~6학년 자녀를 동반한 가족)', '', False)
        self.check('어린이(초등학교 4~6학년 학교)', '', False)
        self.check('성인(50세 이상 성인)', '', False)
        self.check('청소년(중학생 이상)', '', False)
        self.check('누구나', '시대의 명곡 수강생 모집', False)
        self.check('가족(만 8세 이상 자녀 동반)', '', False)
        self.check('성인(주취자 제외), 어린이(신장140cm이상), 청소년(신장140cm이상)', '', False)
        self.check('가족(임산부), 성인(임산부), 여성(임산부)', '', False)
        self.check('제한없음(초등생 이상 ※미취학 아동 참여 불가)', '', False)
        self.check('성인(체험자가 부모일 경우 유아동반 불가), 청소년(중고등학생 이상)', '', False)
        self.check('성인(19세이상(유아동반X))', '', False)
        self.check('유아(어린이집,유치원 원아)', '', False)
        self.check('제한없음(유치원 또는 어린이집 기관)', '', False)
        self.check('성인', '어린이 안전교육 강사 양성', False)
        self.check('초등학생', '어린이 과학교실', False)
        self.check('어린이(8~11세)', '', False)
        self.check('가족(초등생 1~3학년 1명, 보호자 1명)', '', False)
        self.check('어린이(초등학교 1, 2, 3학년)', '', False)
        self.check('초등학생(초등 1-2학년 어린이 동반 가족)', '', False)
        self.check('어린이(지역아동센터 및 초등돌봄교실)', '', False)
        self.check('제한없음(유아 동반 시 유모차 반입 불가)', '가족 숲 체험', True)

    def test_generic_target_uses_name(self):
        self.check('제한없음', '가족 숲 체험', True)
        self.check('', '유아 숲 놀이', True)
        self.check('제한없음(미취학 아동은 보호자 동반 필수 입니다.)', '', True)

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
