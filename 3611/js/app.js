/**
 * 안심 급식알리미 - 메인 애플리케이션 스크립트 (app.js)
 * 나이스 Open API 연동 및 알레르기 유발성분 실시간 강조 로직
 */

// 나이스 교육정보 개방포털 인증키
const NEIS_API_KEY = "75844f8f86c04adbae6fb5499cb75adb";

// 로컬스토리지 키 상수
const STORAGE_KEYS = {
  ALLERGIES: 'safe_meal_selected_allergies',
  SCHOOL: 'safe_meal_selected_school',
  RECENTS: 'safe_meal_recent_schools'
};

// 기본 학교: 한국조리과학고등학교
const DEFAULT_SCHOOL = {
  ATPT_OFCDC_SC_CODE: "J10",
  ATPT_OFCDC_SC_NM: "경기도교육청",
  SD_SCHUL_CODE: "7530539",
  SCHUL_NM: "한국조리과학고등학교",
  SCHUL_KND_SC_NM: "특성화고"
};

// 애플리케이션 전역 상태
const state = {
  school: null,
  date: new Date(),
  mealType: '2', // 기본값: 2(중식), 1(조식), 3(석식)
  viewMode: 'daily', // 'daily' | 'weekly'
  selectedAllergies: new Set(),
  dailyMeals: [], // 당일 식사 목록 (조식/중식/석식)
  weeklyMeals: {}, // 주간 식사 목록
  isLoading: false
};

// ----------------------------------------------------
// 초기화 (DOM Content Loaded)
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  initAllergyCheckboxes();
  initEventListeners();
  updateDateDisplay();
  loadMealData();
});

// ----------------------------------------------------
// 상태 불러오기 및 저장
// ----------------------------------------------------
function loadSavedState() {
  // 1. 저장된 알레르기 정보 복원
  try {
    const savedAllergies = localStorage.getItem(STORAGE_KEYS.ALLERGIES);
    if (savedAllergies) {
      const parsed = JSON.parse(savedAllergies);
      state.selectedAllergies = new Set(parsed);
    }
  } catch (e) {
    console.error('알레르기 로컬스토리지 복원 오류:', e);
  }

  // 2. 저장된 학교 정보 복원
  try {
    const savedSchool = localStorage.getItem(STORAGE_KEYS.SCHOOL);
    if (savedSchool) {
      const parsed = JSON.parse(savedSchool);
      // 이전 기본값(서울고등학교)이 저장되어 있다면 새 기본값(한국조리과학고등학교)으로 갱신
      if (parsed.SD_SCHUL_CODE === "7010083") {
        state.school = DEFAULT_SCHOOL;
        saveSelectedSchool(DEFAULT_SCHOOL);
      } else {
        state.school = parsed;
      }
    } else {
      state.school = DEFAULT_SCHOOL;
      saveSelectedSchool(DEFAULT_SCHOOL);
    }
  } catch (e) {
    state.school = DEFAULT_SCHOOL;
  }

  updateSchoolBadge();
  renderRecentSchoolChips();
}

function saveSelectedAllergies() {
  try {
    const arr = Array.from(state.selectedAllergies);
    localStorage.setItem(STORAGE_KEYS.ALLERGIES, JSON.stringify(arr));
  } catch (e) {
    console.error('알레르기 저장 오류:', e);
  }
}

function saveSelectedSchool(school) {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(school));
    
    // 최근 검색 목록 업데이트
    let recents = getRecentSchools();
    recents = recents.filter(s => s.SD_SCHUL_CODE !== school.SD_SCHUL_CODE);
    recents.unshift(school);
    if (recents.length > 5) recents.pop();
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(recents));
    
    renderRecentSchoolChips();
  } catch (e) {
    console.error('학교 저장 오류:', e);
  }
}

function getRecentSchools() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RECENTS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

// ----------------------------------------------------
// UI 이벤트 리스너 등록
// ----------------------------------------------------
function initEventListeners() {
  // 날짜 선택기
  const datePicker = document.getElementById('datePicker');
  datePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      state.date = new Date(e.target.value + 'T00:00:00');
      loadMealData();
    }
  });

  // 날짜 이동 버튼
  document.getElementById('btnPrevDay').addEventListener('click', () => {
    state.date.setDate(state.date.getDate() - 1);
    updateDateDisplay();
    loadMealData();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    state.date = new Date();
    updateDateDisplay();
    loadMealData();
  });

  document.getElementById('btnNextDay').addEventListener('click', () => {
    state.date.setDate(state.date.getDate() + 1);
    updateDateDisplay();
    loadMealData();
  });

  // 뷰 모드 토글 (일일 / 주간)
  document.getElementById('btnViewDaily').addEventListener('click', () => {
    switchViewMode('daily');
  });
  document.getElementById('btnViewWeekly').addEventListener('click', () => {
    switchViewMode('weekly');
  });

  // 알레르기 빠른 선택 툴바
  document.getElementById('btnPresetCommon').addEventListener('click', () => {
    COMMON_ALLERGY_PRESET.forEach(id => state.selectedAllergies.add(id));
    saveSelectedAllergies();
    syncAllergyCheckboxesUI();
    updateAllergyHighlights();
  });

  document.getElementById('btnSelectAllAllergy').addEventListener('click', () => {
    Object.keys(ALLERGY_INFO).forEach(id => state.selectedAllergies.add(Number(id)));
    saveSelectedAllergies();
    syncAllergyCheckboxesUI();
    updateAllergyHighlights();
  });

  document.getElementById('btnClearAllergy').addEventListener('click', () => {
    state.selectedAllergies.clear();
    saveSelectedAllergies();
    syncAllergyCheckboxesUI();
    updateAllergyHighlights();
  });

  // 학교 검색 모달 열기 및 검색
  document.getElementById('btnOpenSearchModal').addEventListener('click', () => {
    openSchoolModal();
  });

  document.getElementById('btnSearchModalClose').addEventListener('click', () => {
    closeSchoolModal();
  });

  document.getElementById('btnSearchSchool').addEventListener('click', () => {
    handleSchoolSearch();
  });

  document.getElementById('inputSearchQuery').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSchoolSearch();
    }
  });

  // 모달 바깥 배경 클릭 시 닫기
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
      closeSchoolModal();
    }
  });
}

// ----------------------------------------------------
// 알레르기 체크박스 목록 초기화 및 실시간 필터링
// ----------------------------------------------------
function initAllergyCheckboxes() {
  const container = document.getElementById('allergyGrid');
  container.innerHTML = '';

  Object.values(ALLERGY_INFO).forEach(allergy => {
    const isChecked = state.selectedAllergies.has(allergy.id);

    const label = document.createElement('label');
    label.className = `allergy-item ${isChecked ? 'checked' : ''}`;
    label.setAttribute('data-id', allergy.id);

    label.innerHTML = `
      <input type="checkbox" value="${allergy.id}" ${isChecked ? 'checked' : ''}>
      <span class="allergy-icon">${allergy.icon}</span>
      <span class="allergy-name">${allergy.short}</span>
      <span class="allergy-number-tag">(${allergy.id})</span>
    `;

    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      const id = Number(e.target.value);
      if (e.target.checked) {
        state.selectedAllergies.add(id);
        label.classList.add('checked');
      } else {
        state.selectedAllergies.delete(id);
        label.classList.remove('checked');
      }
      saveSelectedAllergies();
      updateSelectedAllergyBadge();
      // 실시간으로 메뉴 카드 하이라이트 반영!
      updateAllergyHighlights();
    });

    container.appendChild(label);
  });

  updateSelectedAllergyBadge();
}

function syncAllergyCheckboxesUI() {
  const items = document.querySelectorAll('.allergy-item');
  items.forEach(item => {
    const id = Number(item.getAttribute('data-id'));
    const checkbox = item.querySelector('input');
    const isChecked = state.selectedAllergies.has(id);
    checkbox.checked = isChecked;
    if (isChecked) {
      item.classList.add('checked');
    } else {
      item.classList.remove('checked');
    }
  });
  updateSelectedAllergyBadge();
}

function updateSelectedAllergyBadge() {
  const countBadge = document.getElementById('selectedAllergyCountBadge');
  const count = state.selectedAllergies.size;
  if (count > 0) {
    countBadge.textContent = `${count}개 선택됨`;
    countBadge.style.display = 'inline-block';
  } else {
    countBadge.textContent = '선택 없음';
    countBadge.style.display = 'none';
  }
}

// ----------------------------------------------------
// 학교 관련 처리
// ----------------------------------------------------
function updateSchoolBadge() {
  if (!state.school) return;
  document.getElementById('currentSchoolName').textContent = state.school.SCHUL_NM;
  document.getElementById('currentSchoolOffice').textContent = state.school.ATPT_OFCDC_SC_NM || '';
  document.getElementById('currentSchoolKind').textContent = state.school.SCHUL_KND_SC_NM || '학교';
}

function renderRecentSchoolChips() {
  const container = document.getElementById('recentSchoolChips');
  container.innerHTML = '';
  const recents = getRecentSchools();

  if (recents.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const label = document.createElement('span');
  label.className = 'chips-label';
  label.textContent = '최근:';
  container.appendChild(label);

  recents.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = s.SCHUL_NM;
    btn.addEventListener('click', () => {
      selectSchool(s);
    });
    container.appendChild(btn);
  });
}

function selectSchool(school) {
  state.school = school;
  saveSelectedSchool(school);
  updateSchoolBadge();
  closeSchoolModal();
  loadMealData();
}

function openSchoolModal() {
  const modal = document.getElementById('modalOverlay');
  modal.classList.add('open');
  const input = document.getElementById('inputSearchQuery');
  input.value = '';
  input.focus();
  document.getElementById('schoolSearchResults').innerHTML = `
    <div class="empty-state-box" style="padding: 24px 0;">
      <div style="font-size: 2rem; margin-bottom: 8px;">🏫</div>
      <div style="font-size: 0.95rem; color: #64748b;">찾으시는 학교 이름을 입력하고 검색해주세요.</div>
    </div>
  `;
}

function closeSchoolModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function handleSchoolSearch() {
  const query = document.getElementById('inputSearchQuery').value.trim();
  if (!query) {
    alert('학교명을 입력해주세요.');
    return;
  }

  const resultContainer = document.getElementById('schoolSearchResults');
  resultContainer.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <div class="loading-spinner"></div>
      <div style="margin-top: 10px; font-size: 0.9rem; color: #64748b;">학교 정보를 검색하는 중입니다...</div>
    </div>
  `;

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=30&SCHUL_NM=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
      const schools = data.schoolInfo[1].row;
      renderSchoolSearchResults(schools);
    } else {
      resultContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">'${escapeHtml(query)}' 검색 결과가 없습니다.</div>
          <div class="empty-state-desc">학교명을 다시 확인하고 검색해주세요.</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('학교 검색 실패:', error);
    resultContainer.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">검색 중 오류가 발생했습니다.</div>
        <div class="empty-state-desc">네트워크 상태를 확인해주세요.</div>
      </div>
    `;
  }
}

function renderSchoolSearchResults(schools) {
  const container = document.getElementById('schoolSearchResults');
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'school-result-list';

  schools.forEach(sch => {
    const item = document.createElement('div');
    item.className = 'school-result-item';
    item.innerHTML = `
      <div class="result-school-name">${escapeHtml(sch.SCHUL_NM)}</div>
      <div class="result-school-desc">
        <span>${escapeHtml(sch.ATPT_OFCDC_SC_NM)}</span> | 
        <span>${escapeHtml(sch.SCHUL_KND_SC_NM || '')}</span> | 
        <span>${escapeHtml(sch.ORG_RDNMA || sch.LCTN_SC_NM || '')}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      selectSchool(sch);
    });
    list.appendChild(item);
  });

  container.appendChild(list);
}

// ----------------------------------------------------
// 날짜 및 뷰 전환 처리
// ----------------------------------------------------
function formatDateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateDisplay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  return `${year}-${month}-${day} (${dayName})`;
}

function updateDateDisplay() {
  const datePicker = document.getElementById('datePicker');
  const year = state.date.getFullYear();
  const month = String(state.date.getMonth() + 1).padStart(2, '0');
  const day = String(state.date.getDate()).padStart(2, '0');
  datePicker.value = `${year}-${month}-${day}`;
  
  const textElem = document.getElementById('currentDateText');
  if (textElem) {
    textElem.textContent = formatDateDisplay(state.date);
  }
}

function switchViewMode(mode) {
  state.viewMode = mode;
  document.getElementById('btnViewDaily').classList.toggle('active', mode === 'daily');
  document.getElementById('btnViewWeekly').classList.toggle('active', mode === 'weekly');
  
  document.getElementById('dailyViewSection').style.display = (mode === 'daily') ? 'block' : 'none';
  document.getElementById('weeklyViewSection').style.display = (mode === 'weekly') ? 'block' : 'none';
  
  loadMealData();
}

// ----------------------------------------------------
// 식단 문자열 파싱 (알레르기 번호 정밀 추출)
// ----------------------------------------------------
function parseDietDish(dishString) {
  if (!dishString) return [];
  
  // <br/>, <br>, \n 등으로 분리
  const rawItems = dishString.split(/<br\s*\/?>|\r?\n/i);
  
  return rawItems.map(item => {
    let clean = item.trim();
    if (!clean) return null;

    let allergies = [];
    let name = clean;

    // 1) 괄호 형태 끝부분: 볶음밥(1.5.6)
    const parenMatch = name.match(/\(([\d\.\s,]+)\)$/);
    if (parenMatch) {
      allergies = parenMatch[1].split(/[\.\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter(n => n >= 1 && n <= 19);
      name = name.replace(/\(([\d\.\s,]+)\)$/, '').trim();
    } else {
      // 2) 끝부분에 마침표와 숫자로 구성된 패턴: 쇠고기미역국5.6.16. 또는 쌀밥
      const endMatch = name.match(/^(.*?)([\d\.\s]+)$/);
      if (endMatch) {
        const candidateNums = endMatch[2].split(/[\.\s]+/)
          .filter(Boolean)
          .map(Number)
          .filter(n => n >= 1 && n <= 19);
        
        if (candidateNums.length > 0) {
          allergies = candidateNums;
          name = endMatch[1].trim();
        }
      }
    }

    // 끝부분 마침표나 공백 정리
    name = name.replace(/[\.\s]+$/, '').trim();

    return {
      raw: item,
      name: name || clean,
      allergies: Array.from(new Set(allergies)).sort((a, b) => a - b)
    };
  }).filter(Boolean);
}

// ----------------------------------------------------
// 나이스 API 식단 데이터 조회
// ----------------------------------------------------
async function loadMealData() {
  if (!state.school) return;

  if (state.viewMode === 'daily') {
    await loadDailyMeal();
  } else {
    await loadWeeklyMeal();
  }
}

async function loadDailyMeal() {
  const container = document.getElementById('dailyViewSection');
  container.innerHTML = `
    <div style="text-align: center; padding: 50px 0;">
      <div class="loading-spinner"></div>
      <div style="margin-top: 14px; font-weight: 600; color: #64748b;">급식 정보를 불러오는 중입니다...</div>
    </div>
  `;

  const ymd = formatDateToYMD(state.date);
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=10&ATPT_OFCDC_SC_CODE=${state.school.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${state.school.SD_SCHUL_CODE}&MLSV_YMD=${ymd}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
      state.dailyMeals = data.mealServiceDietInfo[1].row;
      renderDailyMealView();
    } else {
      state.dailyMeals = [];
      renderDailyEmptyState();
    }
  } catch (err) {
    console.error('급식 정보 로드 실패:', err);
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">급식 정보를 불러오지 못했습니다.</div>
        <div class="empty-state-desc">잠시 후 다시 시도해주세요.</div>
      </div>
    `;
  }
}

function renderDailyEmptyState() {
  const container = document.getElementById('dailyViewSection');
  const isWeekend = (state.date.getDay() === 0 || state.date.getDay() === 6);
  
  container.innerHTML = `
    <div class="card empty-state-box">
      <div class="empty-state-icon">🍱</div>
      <div class="empty-state-title">${formatDateDisplay(state.date)}의 급식 정보가 없습니다.</div>
      <div class="empty-state-desc">
        ${isWeekend ? '주말에는 급식이 운영되지 않습니다. 평일 날짜로 이동해보세요!' : '해당 날짜에 등록된 식단표가 없거나 방학/재량휴업일일 수 있습니다.'}
      </div>
      <div style="margin-top: 18px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="goToNearestWeekday()">다음 평일로 이동</button>
        <button class="btn btn-primary" onclick="goToSampleDate('2024-04-03')">🍱 급식 등록 날짜(2024-04-03)로 바로보기</button>
      </div>
    </div>
  `;

  // 배너 숨기기
  document.getElementById('allergyAlertBanner').classList.remove('active');
}

window.goToSampleDate = function(dateStr) {
  state.date = new Date(dateStr + 'T00:00:00');
  updateDateDisplay();
  loadMealData();
};

window.goToNearestWeekday = function() {
  const d = new Date(state.date);
  // 월요일(1) ~ 금요일(5) 찾기
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  
  state.date = d;
  updateDateDisplay();
  loadMealData();
};

// ----------------------------------------------------
// 일일 급식 뷰 렌더링
// ----------------------------------------------------
function renderDailyMealView() {
  const container = document.getElementById('dailyViewSection');
  container.innerHTML = '';

  // 1. 식사 종류(조식/중식/석식) 탭 생성
  const tabsWrapper = document.createElement('div');
  tabsWrapper.className = 'meal-type-tabs';

  const mealMap = {};
  state.dailyMeals.forEach(m => {
    mealMap[m.MMEAL_SC_CODE] = m;
  });

  // 사용 가능한 식사 목록 중 현재 선택된 탭이 없으면 기본 중식(2) 또는 첫 번째 것 선택
  if (!mealMap[state.mealType]) {
    if (mealMap['2']) state.mealType = '2';
    else if (mealMap['1']) state.mealType = '1';
    else if (mealMap['3']) state.mealType = '3';
    else state.mealType = Object.keys(mealMap)[0];
  }

  const mealNames = { '1': '🌅 조식 (아침)', '2': '☀️ 중식 (점심)', '3': '🌙 석식 (저녁)' };

  ['1', '2', '3'].forEach(code => {
    if (mealMap[code]) {
      const btn = document.createElement('button');
      btn.className = `meal-tab-btn ${state.mealType === code ? 'active' : ''}`;
      btn.innerHTML = `${mealNames[code]} <span class="badge-pill">제공</span>`;
      btn.addEventListener('click', () => {
        state.mealType = code;
        renderDailyMealView();
      });
      tabsWrapper.appendChild(btn);
    }
  });

  container.appendChild(tabsWrapper);

  // 2. 현재 선택된 식사 카드 렌더링
  const currentMeal = mealMap[state.mealType];
  if (!currentMeal) return;

  const mealCard = document.createElement('div');
  mealCard.className = 'card';

  // 메뉴 파싱
  const parsedItems = parseDietDish(currentMeal.DDISH_NM);

  // 상단 헤더
  const headerRow = document.createElement('div');
  headerRow.className = 'card-header-row';
  headerRow.innerHTML = `
    <div>
      <h3 class="card-title">${mealNames[currentMeal.MMEAL_SC_CODE] || currentMeal.MMEAL_SC_NM} 식단</h3>
      <div class="card-subtitle">${formatDateDisplay(state.date)} / 급식인원: ${currentMeal.MLSV_FGR || '-'}명</div>
    </div>
  `;
  mealCard.appendChild(headerRow);

  // 메뉴 리스트 그리드
  const menuGrid = document.createElement('div');
  menuGrid.className = 'menu-list-grid';
  menuGrid.id = 'menuListGrid';

  parsedItems.forEach((item, index) => {
    const itemCard = document.createElement('div');
    itemCard.className = 'menu-item-card';
    itemCard.setAttribute('data-index', index);
    itemCard.setAttribute('data-allergies', JSON.stringify(item.allergies));

    // 알레르기 칩 목록 생성
    const chipsHtml = item.allergies.map(id => {
      const info = ALLERGY_INFO[id] || { name: `알레르기${id}`, icon: '⚠️' };
      return `<span class="allergy-chip" data-id="${id}">${info.icon} ${info.short || info.name}</span>`;
    }).join('');

    itemCard.innerHTML = `
      <div class="menu-item-main">
        <div class="menu-title">${escapeHtml(item.name)}</div>
        <div class="menu-status-badge"></div>
      </div>
      <div class="menu-allergies-row">
        ${chipsHtml || '<span style="font-size:0.75rem; color:#94a3b8;">알레르기 정보 없음</span>'}
      </div>
    `;

    menuGrid.appendChild(itemCard);
  });

  mealCard.appendChild(menuGrid);

  // 하단 메타 정보 (칼로리 & 상세정보 아코디언)
  const metaBar = document.createElement('div');
  metaBar.className = 'meal-meta-summary';
  metaBar.innerHTML = `
    <div class="calorie-info-text">
      <span>⚡ 총 열량:</span>
      <span style="font-size: 1.05rem;">${escapeHtml(currentMeal.CAL_INFO || '정보 없음')}</span>
    </div>
    <button type="button" class="details-toggle-btn" id="btnToggleNutrition">
      <span>영양성분 및 원산지 보기</span>
      <span id="nutritionToggleIcon">▼</span>
    </button>
  `;
  mealCard.appendChild(metaBar);

  // 영양성분 및 원산지 상세 박스
  const detailsBox = document.createElement('div');
  detailsBox.className = 'details-content-box';
  detailsBox.id = 'detailsContentBox';
  detailsBox.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong style="color: #0f172a; display: block; margin-bottom: 4px;">🥗 영양 성분 정보</strong>
      <div>${currentMeal.NTR_INFO || '등록된 영양 정보가 없습니다.'}</div>
    </div>
    <div>
      <strong style="color: #0f172a; display: block; margin-bottom: 4px;">🌾 원산지 정보</strong>
      <div>${currentMeal.ORPLC_INFO || '등록된 원산지 정보가 없습니다.'}</div>
    </div>
  `;
  mealCard.appendChild(detailsBox);

  container.appendChild(mealCard);

  // 아코디언 토글 이벤트
  const toggleBtn = document.getElementById('btnToggleNutrition');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const box = document.getElementById('detailsContentBox');
      const icon = document.getElementById('nutritionToggleIcon');
      const isOpen = box.classList.toggle('open');
      icon.textContent = isOpen ? '▲' : '▼';
    });
  }

  // 알레르기 강조 반영
  updateAllergyHighlights();
}

// ----------------------------------------------------
// 🔥 알레르기 성분 실시간 빨간색 강한 강조 로직 🔥
// ----------------------------------------------------
function updateAllergyHighlights() {
  const menuCards = document.querySelectorAll('.menu-item-card');
  let dangerCount = 0;
  const matchedAllergyNames = new Set();

  menuCards.forEach(card => {
    const rawAllergies = card.getAttribute('data-allergies');
    if (!rawAllergies) return;
    
    const allergies = JSON.parse(rawAllergies);
    // 선택된 알레르기와의 교집합 검출
    const matched = allergies.filter(id => state.selectedAllergies.has(id));
    const badgeContainer = card.querySelector('.menu-status-badge');
    const chipElements = card.querySelectorAll('.allergy-chip');

    // 각 칩 스타일 업데이트
    chipElements.forEach(chip => {
      const chipId = Number(chip.getAttribute('data-id'));
      if (state.selectedAllergies.has(chipId)) {
        chip.classList.add('matched-danger');
      } else {
        chip.classList.remove('matched-danger');
      }
    });

    if (matched.length > 0) {
      // 🚨 해당 성분이 들어간 메뉴: 빨간색으로 강하게 강조! 🚨
      dangerCount++;
      card.classList.add('has-danger');

      matched.forEach(id => {
        if (ALLERGY_INFO[id]) {
          matchedAllergyNames.add(ALLERGY_INFO[id].short || ALLERGY_INFO[id].name);
        }
      });

      if (badgeContainer) {
        badgeContainer.innerHTML = `
          <span class="danger-warning-badge">
            ⚠️ 알레르기 주의!
          </span>
        `;
      }
    } else {
      // 안전한 메뉴
      card.classList.remove('has-danger');
      if (badgeContainer) {
        if (state.selectedAllergies.size > 0 && allergies.length > 0) {
          badgeContainer.innerHTML = `<span class="safe-badge">✓ 안심</span>`;
        } else {
          badgeContainer.innerHTML = '';
        }
      }
    }
  });

  // 상단 종합 알림 배너 업데이트
  updateAlertBanner(dangerCount, Array.from(matchedAllergyNames));

  // 주간 뷰가 열려있을 때 주간 뷰 하이라이트도 동시 업데이트
  if (state.viewMode === 'weekly') {
    updateWeeklyHighlights();
  }
}

function updateAlertBanner(dangerCount, names) {
  const banner = document.getElementById('allergyAlertBanner');
  if (!banner) return;

  if (dangerCount > 0 && state.selectedAllergies.size > 0) {
    banner.classList.add('active');
    document.getElementById('alertBannerCount').textContent = `${dangerCount}개`;
    document.getElementById('alertBannerIngredients').textContent = names.join(', ');
  } else {
    banner.classList.remove('active');
  }
}

// ----------------------------------------------------
// 주간 급식 조회 및 렌더링
// ----------------------------------------------------
async function loadWeeklyMeal() {
  const container = document.getElementById('weeklyViewSection');
  container.innerHTML = `
    <div style="text-align: center; padding: 50px 0;">
      <div class="loading-spinner"></div>
      <div style="margin-top: 14px; font-weight: 600; color: #64748b;">이번 주 급식표를 조회하는 중입니다...</div>
    </div>
  `;

  // 이번 주의 월요일과 금요일 날짜 계산
  const current = new Date(state.date);
  const day = current.getDay();
  // 월요일로 이동 (일요일은 0이므로 조정)
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diffToMonday));
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const fromYmd = formatDateToYMD(monday);
  const toYmd = formatDateToYMD(friday);

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=50&ATPT_OFCDC_SC_CODE=${state.school.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${state.school.SD_SCHUL_CODE}&MLSV_FROM_YMD=${fromYmd}&MLSV_TO_YMD=${toYmd}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
      renderWeeklyMealView(data.mealServiceDietInfo[1].row, monday);
    } else {
      container.innerHTML = `
        <div class="card empty-state-box">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">이번 주 식단 정보가 없습니다.</div>
          <div class="empty-state-desc">방학 기간이거나 등록된 급식 데이터가 없습니다.</div>
          <div style="margin-top: 18px; display: flex; justify-content: center;">
            <button class="btn btn-primary" onclick="goToSampleDate('2024-04-03')">🍱 식단 등록 주간(2024년 4월 첫째 주)으로 바로보기</button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('주간 식단 로드 실패:', err);
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">주간 급식을 불러오지 못했습니다.</div>
      </div>
    `;
  }
}

function renderWeeklyMealView(rows, monday) {
  const container = document.getElementById('weeklyViewSection');
  container.innerHTML = '';

  const weeklyWrapper = document.createElement('div');
  weeklyWrapper.className = 'weekly-container';

  // 날짜별로 중식(코드 2) 우선 그룹핑
  const mealsByDate = {};
  rows.forEach(r => {
    // 중식 우선, 없으면 다른 식사
    if (!mealsByDate[r.MLSV_YMD] || r.MMEAL_SC_CODE === '2') {
      mealsByDate[r.MLSV_YMD] = r;
    }
  });

  const dayNames = ['월', '화', '수', '목', '금'];
  const todayYmd = formatDateToYMD(new Date());

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ymd = formatDateToYMD(d);
    const isToday = (ymd === todayYmd);
    const meal = mealsByDate[ymd];

    const dayCard = document.createElement('div');
    dayCard.className = `weekly-day-card ${isToday ? 'is-today' : ''}`;

    let menuHtml = '';
    if (meal && meal.DDISH_NM) {
      const items = parseDietDish(meal.DDISH_NM);
      menuHtml = items.map(it => {
        return `<li class="weekly-menu-item" data-allergies='${JSON.stringify(it.allergies)}'>${escapeHtml(it.name)}</li>`;
      }).join('');
    } else {
      menuHtml = `<li style="color:#94a3b8; font-size:0.8rem; padding: 12px 0;">급식 없음</li>`;
    }

    dayCard.innerHTML = `
      <div class="weekly-day-header">
        <span>${d.getMonth() + 1}/${d.getDate()} (${dayNames[i]})</span>
        ${isToday ? '<span style="font-size: 0.72rem; color: #2563eb; background:#dbeafe; padding: 1px 6px; border-radius:4px;">오늘</span>' : ''}
      </div>
      <ul class="weekly-menu-list">
        ${menuHtml}
      </ul>
      ${meal ? `<div style="font-size:0.75rem; color:#64748b; margin-top:8px; text-align:right;">⚡ ${escapeHtml(meal.CAL_INFO || '')}</div>` : ''}
    `;

    weeklyWrapper.appendChild(dayCard);
  }

  container.appendChild(weeklyWrapper);
  updateWeeklyHighlights();
}

function updateWeeklyHighlights() {
  const items = document.querySelectorAll('.weekly-menu-item');
  items.forEach(item => {
    const rawAllergies = item.getAttribute('data-allergies');
    if (!rawAllergies) return;
    const allergies = JSON.parse(rawAllergies);
    const matched = allergies.filter(id => state.selectedAllergies.has(id));

    if (matched.length > 0) {
      item.classList.add('weekly-danger');
      const warningIcons = matched.map(id => ALLERGY_INFO[id] ? ALLERGY_INFO[id].icon : '⚠️').join('');
      // 기존 텍스트 뒤에 경고 아이콘 추가
      if (!item.querySelector('.weekly-danger-icon')) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'weekly-danger-icon';
        iconSpan.style.marginLeft = '4px';
        iconSpan.textContent = ` ⚠️${warningIcons}`;
        item.appendChild(iconSpan);
      }
    } else {
      item.classList.remove('weekly-danger');
      const iconSpan = item.querySelector('.weekly-danger-icon');
      if (iconSpan) iconSpan.remove();
    }
  });
}

// ----------------------------------------------------
// 유틸리티 함수
// ----------------------------------------------------
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
