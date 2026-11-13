/**
 * 교육부 및 식품의약품안전처 고시 학교급식 19종 알레르기 유발물질 표준 데이터
 */
const ALLERGY_INFO = {
  1: { id: 1, name: '난류(달걀)', short: '달걀', icon: '🥚', category: '축산물' },
  2: { id: 2, name: '우유', short: '우유', icon: '🥛', category: '유제품' },
  3: { id: 3, name: '메밀', short: '메밀', icon: '🌾', category: '곡류' },
  4: { id: 4, name: '땅콩', short: '땅콩', icon: '🥜', category: '견과류' },
  5: { id: 5, name: '대두(콩)', short: '대두', icon: '🫘', category: '콩류' },
  6: { id: 6, name: '밀', short: '밀', icon: '🍞', category: '곡류' },
  7: { id: 7, name: '고등어', short: '고등어', icon: '🐟', category: '수산물' },
  8: { id: 8, name: '게', short: '게', icon: '🦀', category: '수산물' },
  9: { id: 9, name: '새우', short: '새우', icon: '🦐', category: '수산물' },
  10: { id: 10, name: '돼지고기', short: '돼지고기', icon: '🥓', category: '축산물' },
  11: { id: 11, name: '복숭아', short: '복숭아', icon: '🍑', category: '과일류' },
  12: { id: 12, name: '토마토', short: '토마토', icon: '🍅', category: '채소류' },
  13: { id: 13, name: '아황산류', short: '아황산류', icon: '🍷', category: '식품첨가물' },
  14: { id: 14, name: '호두', short: '호두', icon: '🌰', category: '견과류' },
  15: { id: 15, name: '닭고기', short: '닭고기', icon: '🍗', category: '축산물' },
  16: { id: 16, name: '쇠고기', short: '쇠고기', icon: '🥩', category: '축산물' },
  17: { id: 17, name: '오징어', short: '오징어', icon: '🦑', category: '수산물' },
  18: { id: 18, name: '조개류(굴/전복/홍합)', short: '조개류', icon: '🦪', category: '수산물' },
  19: { id: 19, name: '잣', short: '잣', icon: '🌲', category: '견과류' }
};

// 자주 발생하는 알레르기 프리셋 (달걀, 우유, 땅콩, 대두, 밀, 새우, 돼지고기)
const COMMON_ALLERGY_PRESET = [1, 2, 4, 5, 6, 9, 10];
