// --- STATE MANAGEMENT ---
let accounts = JSON.parse(localStorage.getItem('shift_accounts')) || ['世英'];
let currentAccount = localStorage.getItem('shift_current_account') || accounts[0] || '';
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let selectedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
let shiftsData = JSON.parse(localStorage.getItem('shifts_data')) || {};

// --- DOM ELEMENTS ---
const dropdownBtn = document.getElementById('custom-dropdown-btn'); // Maps to our native select element
const newAccountInput = document.getElementById('new-account-name');
const createAccountBtn = document.getElementById('btn-create-account');
const editAccountBtn = document.getElementById('btn-edit-account');
const deleteAccountBtn = document.getElementById('btn-delete-account');
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');
const prevMonthBtn = document.getElementById('btn-prev-month');
const nextMonthBtn = document.getElementById('btn-next-month');
const currentMonthBtn = document.getElementById('btn-current-month');

const shorthandInput = document.getElementById('shorthand-input');
const parseBtn = document.getElementById('btn-parse');
const sampleBtn = document.getElementById('btn-sample');

const selectedDateBadge = document.getElementById('selected-date-badge');
const shiftsListContainer = document.getElementById('shifts-list-container');
const addShiftTextBtn = document.getElementById('btn-add-shift-text');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('btn-close-modal');
const inputShiftDate = document.getElementById('input-shift-date');
const inputShiftTitle = document.getElementById('input-shift-title');
const inputShiftStart = document.getElementById('input-shift-start');
const inputShiftEnd = document.getElementById('input-shift-end');
const deleteModalBtn = document.getElementById('btn-delete-modal');
const saveModalBtn = document.getElementById('btn-save-modal');

const summaryCount = document.getElementById('summary-count');
const summaryHours = document.getElementById('summary-hours');
const summaryHeader = document.getElementById('summary-header');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toast-text');

// --- NAVIGATION TAB DOM REFERENCING ---
const tabCalendarBtn = document.getElementById('tab-calendar-btn');
const tabParserBtn = document.getElementById('tab-parser-btn');
const contentTabCalendar = document.getElementById('content-tab-calendar');
const contentTabParser = document.getElementById('content-tab-parser');

// --- DARK MODE TOGGLE (見た目のみ／機能への影響なし) ---
const btnDarkMode = document.getElementById('btn-dark-mode');
const darkModeIcon = document.getElementById('dark-mode-icon');

function initDarkMode() {
  const saved = localStorage.getItem('shift_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (darkModeIcon) darkModeIcon.textContent = 'light_mode';
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('shift_theme', 'light');
    if (darkModeIcon) darkModeIcon.textContent = 'dark_mode';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('shift_theme', 'dark');
    if (darkModeIcon) darkModeIcon.textContent = 'light_mode';
  }
}

if (btnDarkMode) btnDarkMode.onclick = toggleDarkMode;

let editingShiftId = null;

// --- TOAST NOTIFICATION ---
function showToast(message) {
  toastText.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('opacity-100'), 10);
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

// --- TAB ROUTING ENGINE MANAGEMENT ---
function switchTab(targetTab) {
  if (targetTab === 'calendar') {
    tabCalendarBtn.classList.add('active');
    tabParserBtn.classList.remove('active');

    contentTabCalendar.classList.remove('hidden');
    contentTabParser.classList.add('hidden');

    renderCalendar();
    renderShiftsList();
    updateSummary();
  } else if (targetTab === 'parser') {
    tabParserBtn.classList.add('active');
    tabCalendarBtn.classList.remove('active');

    contentTabParser.classList.remove('hidden');
    contentTabCalendar.classList.add('hidden');
  }
}

tabCalendarBtn.onclick = () => switchTab('calendar');
tabParserBtn.onclick = () => switchTab('parser');

// --- DROPDOWN LOGIC FOR NATIVE SELECT ---
function renderDropdown() {
  dropdownBtn.innerHTML = '';
  if (!currentAccount && accounts.length > 0) currentAccount = accounts[0];

  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account;
    option.textContent = account;
    if (account === currentAccount) {
      option.selected = true;
    }
    dropdownBtn.appendChild(option);
  });
}

// Watch dropdown selection changes
dropdownBtn.onchange = (e) => {
  currentAccount = e.target.value;
  localStorage.setItem('shift_current_account', currentAccount);
  renderCalendar();
  renderShiftsList();
  updateSummary();
};

function saveAccountsState() {
  localStorage.setItem('shift_accounts', JSON.stringify(accounts));
  localStorage.setItem('shift_current_account', currentAccount);
}

createAccountBtn.onclick = () => {
  const name = newAccountInput.value.trim();
  if (!name) return showToast('名前を入力してください');
  if (accounts.includes(name)) return showToast('この名前は既に登録されています');
  accounts.push(name);
  currentAccount = name;
  saveAccountsState();
  newAccountInput.value = '';
  renderDropdown();
  renderCalendar();
  renderShiftsList();
  updateSummary();
  showToast(`「${name}」を作成しました`);
};

// --- CALENDAR SYSTEM ---
function renderCalendar() {
  calendarGrid.innerHTML = '';
  const displayMonthName = currentMonth + 1;
  calendarTitle.querySelector('span').textContent = `${currentYear}年 ${displayMonthName}月`;
  summaryHeader.querySelector('span').textContent = `${displayMonthName}月の勤務サマリー`;

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

  const accountShifts = (currentAccount && shiftsData[currentAccount]) ? shiftsData[currentAccount] : {};

  // Previous Month Padding Days
  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const cell = document.createElement('div');
    cell.className = 'calendar-cell pad';
    cell.textContent = dayNum;
    calendarGrid.appendChild(cell);
  }

  // Active Month Days
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = dateStr === selectedDateStr;

    cell.className = `calendar-cell ${isSelected ? 'selected' : ''}`;

    const dayLabel = document.createElement('div');
    dayLabel.textContent = day;
    cell.appendChild(dayLabel);

    if (accountShifts[dateStr] && accountShifts[dateStr].length > 0) {
      const shiftContainer = document.createElement('div');
      shiftContainer.className = 'shift-chip-list';

      accountShifts[dateStr].forEach(shift => {
        const block = document.createElement('div');
        block.className = 'shift-chip';
        block.innerHTML = `
          <span>${shift.start}</span>
          <span class="arrow">↓</span>
          <span>${shift.end}</span>
        `;
        shiftContainer.appendChild(block);
      });
      cell.appendChild(shiftContainer);
    }

    cell.onclick = () => {
      selectedDateStr = dateStr;
      renderCalendar();
      renderShiftsList();
    };

    calendarGrid.appendChild(cell);
  }
}

prevMonthBtn.onclick = () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
  updateSummary();
};

nextMonthBtn.onclick = () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
  updateSummary();
};

currentMonthBtn.onclick = () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  renderCalendar();
  renderShiftsList();
  updateSummary();
};

// --- SHIFT MANAGEMENT & DETAIL LISTS ---
function renderShiftsList() {
  selectedDateBadge.textContent = `${selectedDateStr} のシフトリスト`;
  shiftsListContainer.innerHTML = '';

  if (!currentAccount) {
    shiftsListContainer.innerHTML = '<p class="empty-hint">アカウントを作成または選択してください。</p>';
    return;
  }

  const accountShifts = shiftsData[currentAccount] || {};
  const dayShifts = accountShifts[selectedDateStr] || [];

  if (dayShifts.length === 0) {
    shiftsListContainer.innerHTML = '<p class="empty-hint">この日の予定はありません。</p>';
    return;
  }

  dayShifts.forEach(shift => {
    const card = document.createElement('div');
    card.className = 'entry-row';
    card.innerHTML = `
      <div class="entry-icon-circle">
        <span class="material-icons-round">schedule</span>
      </div>
      <div class="entry-main">
        <div class="entry-top">
          <span class="entry-title">${shift.title || '一括登録シフト'}</span>
        </div>
        <div class="entry-sub">${shift.start} 〜 ${shift.end}</div>
      </div>
      <div class="entry-actions">
        <button class="entry-icon-btn edit-action-trigger"><span class="material-icons-round">edit</span></button>
        <button class="entry-icon-btn danger delete-action-trigger"><span class="material-icons-round">delete</span></button>
      </div>
    `;

    card.querySelector('.edit-action-trigger').onclick = (e) => {
      e.stopPropagation();
      openModal(true, shift);
    };

    card.querySelector('.delete-action-trigger').onclick = (e) => {
      e.stopPropagation();
      deleteShift(shift.id);
    };

    shiftsListContainer.appendChild(card);
  });
}

function openModal(isEdit = false, shift = null) {
  if (!currentAccount) return showToast('先にアカウントを選択してください');

  modal.classList.remove('hidden');
  if (isEdit && shift) {
    editingShiftId = shift.id;
    modalTitle.querySelector('span').textContent = 'シフトの編集';
    inputShiftDate.value = selectedDateStr;
    inputShiftTitle.value = shift.title;
    inputShiftStart.value = shift.start;
    inputShiftEnd.value = shift.end;
    deleteModalBtn.classList.remove('hidden');
  } else {
    editingShiftId = null;
    modalTitle.querySelector('span').textContent = '新規シフトの登録';
    inputShiftDate.value = selectedDateStr;
    inputShiftTitle.value = '';
    inputShiftStart.value = '09:00';
    inputShiftEnd.value = '18:00';
    deleteModalBtn.classList.add('hidden');
  }
}

closeModalBtn.onclick = () => modal.classList.add('hidden');

saveModalBtn.onclick = () => {
  const date = inputShiftDate.value;
  const title = inputShiftTitle.value.trim() || 'シフト';
  const start = inputShiftStart.value;
  const end = inputShiftEnd.value;

  if (!date || !start || !end) return showToast('必要項目を入力してください');

  if (!shiftsData[currentAccount]) shiftsData[currentAccount] = {};
  if (!shiftsData[currentAccount][date]) shiftsData[currentAccount][date] = [];

  if (editingShiftId) {
    for (const d in shiftsData[currentAccount]) {
      shiftsData[currentAccount][d] = shiftsData[currentAccount][d].filter(s => s.id !== editingShiftId);
    }
    if (!shiftsData[currentAccount][date]) shiftsData[currentAccount][date] = [];
    shiftsData[currentAccount][date].push({ id: editingShiftId, title, start, end });
    showToast('シフトを更新しました');
  } else {
    shiftsData[currentAccount][date].push({ id: Date.now().toString(), title, start, end });
    showToast('新規シフトを登録しました');
  }

  localStorage.setItem('shifts_data', JSON.stringify(shiftsData));
  modal.classList.add('hidden');
  renderCalendar();
  renderShiftsList();
  updateSummary();
};

function deleteShift(id) {
  if (!shiftsData[currentAccount]) return;
  for (const date in shiftsData[currentAccount]) {
    shiftsData[currentAccount][date] = shiftsData[currentAccount][date].filter(s => s.id !== id);
  }
  localStorage.setItem('shifts_data', JSON.stringify(shiftsData));
  renderCalendar();
  renderShiftsList();
  updateSummary();
  showToast('シフトを削除しました');
}

deleteModalBtn.onclick = () => {
  if (editingShiftId) {
    deleteShift(editingShiftId);
    modal.classList.add('hidden');
  }
};

addShiftTextBtn.onclick = () => openModal(false);

// --- TEXT PARSER ENGINE (SHORTHAND FORMAT) ---
parseBtn.onclick = () => {
  const text = shorthandInput.value.trim();
  if (!currentAccount) return showToast('アカウントを選択してください');
  if (!text) return showToast('文字列を入力してください');

  const blocks = text.split(';');
  let successCount = 0;

  if (!shiftsData[currentAccount]) shiftsData[currentAccount] = {};

  blocks.forEach(block => {
    if (!block.trim()) return;
    const tokens = block.split(',').map(t => t.trim());
    if (tokens.length >= 3) {
      const datePart = tokens[0];
      const startTime = tokens[1];
      const endTime = tokens[2];

      const dateRegex = /^(\d{1,2})\/(\d{1,2})$/;
      const match = datePart.match(dateRegex);

      if (match) {
        const m = match[1].padStart(2, '0');
        const d = match[2].padStart(2, '0');
        const formattedDate = `${currentYear}-${m}-${d}`;

        if (!shiftsData[currentAccount][formattedDate]) {
          shiftsData[currentAccount][formattedDate] = [];
        }

        shiftsData[currentAccount][formattedDate].push({
          id: 'parsed-' + Math.random().toString(36).substr(2, 9),
          title: '一括登録シフト',
          start: startTime,
          end: endTime
        });
        successCount++;
      }
    }
  });

  if (successCount > 0) {
    localStorage.setItem('shifts_data', JSON.stringify(shiftsData));
    shorthandInput.value = '';

    // Smoothly bounce user right back to the fresh calendar view
    switchTab('calendar');
    showToast(`${successCount}件のシフトを一括登録しました！`);
  } else {
    showToast('パースに失敗しました。書式を確認してください');
  }
};

sampleBtn.onclick = () => {
  const currentMonthStr = String(currentMonth + 1).padStart(2, '0');
  shorthandInput.value = `${currentMonthStr}/04, 17:30, 23:30; ${currentMonthStr}/05, 22:00, 29:00; ${currentMonthStr}/12, 21:00, 29:00`;
};

// --- SUMMARIES ---
function updateSummary() {
  if (!currentAccount || !shiftsData[currentAccount]) {
    summaryCount.textContent = '0回';
    summaryHours.textContent = '0';
    return;
  }

  let totalShifts = 0;
  let totalMinutes = 0;
  const accountShifts = shiftsData[currentAccount];

  for (const dateStr in accountShifts) {
    const [y, m] = dateStr.split('-').map(Number);
    if (y === currentYear && (m - 1) === currentMonth) {
      const dayShifts = accountShifts[dateStr];
      totalShifts += dayShifts.length;

      dayShifts.forEach(shift => {
        const [sh, sm] = shift.start.split(':').map(Number);
        const [eh, em] = shift.end.split(':').map(Number);
        let startTotal = (sh * 60) + sm;
        let endTotal = (eh * 60) + em;
        if (endTotal < startTotal) endTotal += 24 * 60;
        totalMinutes += (endTotal - startTotal);
      });
    }
  }

  summaryCount.textContent = `${totalShifts}回`;
  summaryHours.textContent = (totalMinutes / 60).toFixed(1).replace('.0', '');
}
// --- ACCOUNT EDIT & DELETE MANAGEMENT ---

// アカウント名編集ロジック
editAccountBtn.onclick = () => {
  if (!currentAccount) return showToast('編集するアカウントがありません');

  // ポップアップ入力で新しい名前を求める
  const newName = prompt(`「${currentAccount}」の新しい名前を入力してください：`, currentAccount);

  if (newName === null) return; // キャンセルされた場合
  const trimmedName = newName.trim();
  if (!trimmedName) return showToast('名前を入力してください');
  if (trimmedName === currentAccount) return;
  if (accounts.includes(trimmedName)) return showToast('この名前は既に登録されています');

  const oldAccount = currentAccount;

  // 1. リストの登録名を更新
  accounts = accounts.map(acc => acc === oldAccount ? trimmedName : acc);

  // 2. シフトデータのキー名も新しい名前に引っ越し
  if (shiftsData[oldAccount]) {
    shiftsData[trimmedName] = shiftsData[oldAccount];
    delete shiftsData[oldAccount];
    localStorage.setItem('shifts_data', JSON.stringify(shiftsData));
  }

  currentAccount = trimmedName;
  saveAccountsState();

  // 3. 画面の再描画
  renderDropdown();
  renderCalendar();
  renderShiftsList();
  updateSummary();
  showToast(`アカウント名を「${trimmedName}」に変更しました`);
};

// アカウント削除ロジック（確認アラート付き）
deleteAccountBtn.onclick = () => {
  if (!currentAccount) return showToast('削除するアカウントがありません');

  // 確認用のブラウザアラートを表示
  const confirmDelete = confirm(`「${currentAccount}」のアカウントを削除しますが大丈夫ですか？\n※この操作は取り消せません。紐づくシフトデータもすべて削除されます。`);

  if (confirmDelete) {
    const oldAccount = currentAccount;

    // 1. アカウント配列から除外
    accounts = accounts.filter(acc => acc !== oldAccount);

    // 2. シフトデータからも該当アカウントの枠を削除
    if (shiftsData[oldAccount]) {
      delete shiftsData[oldAccount];
      localStorage.setItem('shifts_data', JSON.stringify(shiftsData));
    }

    // 3. 次に選択状態にするアカウントの決定
    currentAccount = accounts.length > 0 ? accounts[0] : '';

    saveAccountsState();

    // 4. 画面の再描画
    renderDropdown();
    renderCalendar();
    renderShiftsList();
    updateSummary();
    showToast(`「${oldAccount}」のアカウントを削除しました`);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  renderDropdown();
  renderCalendar();
  renderShiftsList();
  updateSummary();
});
