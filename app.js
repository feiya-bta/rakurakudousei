// ==========================================
// 1. DEFAULT DATA STRUCTURE & INITIALIZATION
// ==========================================
const DEFAULT_DATA = {
    users: {
        1: { name: "", color: "#f2cbd6" },
        2: { name: "", color: "#d6efff" }
    },
    settledColor: "#b2ebd4",
    payments: [],
    shoppingList: [],
    fridgeItems: [],
    confirmations: { 1: false, 2: false },
    currentOperator: 1,
    isNewAccount: true
};

let appData = JSON.parse(localStorage.getItem("rakuraku_domo_data")) || JSON.parse(JSON.stringify(DEFAULT_DATA));

// Ensure fridge collection is safe
if (!appData.fridgeItems) appData.fridgeItems = [];

let activeEditorUser = 1;
const PALETTE = ["#b2ebd4", "#bdf7cc", "#d6efff", "#fce2d0", "#f2cbd6", "#f0a3b3", "#c5b6e6"];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    saveData();
    renderUserSelectors();
    renderTimeline();
    renderShoppingList();
    renderSettlement();
    renderFridge();
    renderArchive();
    updateThemeColor();

    const container = document.querySelector(".app-container");
    if (!container) return; // Prevent crash if container structure is missing

    const isBrandNewSession = appData.isNewAccount || !appData.users[1].name || !appData.users[2].name;

    if (isBrandNewSession) {
        appData.isNewAccount = true;
        container.classList.add("onboarding-mode");
        if (activeEditorUser !== 1 && activeEditorUser !== 2) activeEditorUser = 1;
        switchProfileEditor(activeEditorUser);
        
        const modalProfile = document.getElementById("modal-profile");
        if (modalProfile) modalProfile.classList.add("open");
    } else {
        container.classList.remove("onboarding-mode");
    }
}

function saveData() {
    localStorage.setItem("rakuraku_domo_data", JSON.stringify(appData));
}

// Helper to normalize Date Strings safely across Safari/Chrome engines
function parseSafeDate(dateStr) {
    if (!dateStr) return new Date();
    const normalized = dateStr.replace(/\//g, "-");
    return new Date(`${normalized}T00:00:00`);
}

// ==========================================
// 2. USER SELECTOR MANAGEMENT
// ==========================================
function renderUserSelectors() {
    const selector = document.getElementById("user-selector");
    if (!selector) return;

    const u1Name = appData.users[1].name || "ユーザー1";
    const u2Name = appData.users[2].name || "ユーザー2";
    selector.innerHTML = `
        <option value="1">${u1Name} として操作</option>
        <option value="2">${u2Name} として操作</option>
    `;
    selector.value = appData.currentOperator;
}

// ==========================================
// 3. PAYMENT TIMELINE MANAGEMENT
// ==========================================
function renderTimeline() {
    const container = document.getElementById("payment-timeline");
    if (!container) return;
    container.innerHTML = "";

    const activePayments = appData.payments.filter(p => !p.settled);
    if (activePayments.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.75rem; padding:40px 0;">未精算の支払いはありません</p>`;
        return;
    }

    activePayments.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.id - a.id;
    });

    let lastDate = null;
    activePayments.forEach(pay => {
        if (pay.date !== lastDate) {
            lastDate = pay.date;
            const divider = document.createElement("div");
            divider.className = "timeline-date-divider";
            divider.innerHTML = `<span>${formatDateLabel(pay.date)}</span>`;
            container.appendChild(divider);
        }

        const user = appData.users[pay.userId] || { name: "不明", color: "#ffffff" };
        const opponentRatio = pay.ratio;
        const opponentCost = Math.round(pay.amount * (opponentRatio / 100));

        const card = document.createElement("div");
        card.className = "card";
        card.style.backgroundColor = user.color || "#ffffff";
        card.innerHTML = `
            <div class="card-header">
                <div class="card-user-info">${user.name || "ユーザー"} のお支払い</div>
                <div class="card-actions">
                    <span class="action-link edit" onclick="editPayment(${pay.id})">編集</span>
                    <span class="action-link delete" onclick="deletePayment(${pay.id})">削除</span>
                </div>
            </div>
            <div class="card-body">
                <h4>${pay.title}</h4>
                ${pay.memo ? `<span class="badge-date">${pay.memo}</span>` : ""}
                <div class="card-amount-row">
                    <span class="main-amount">${pay.amount.toLocaleString()} 円</span>
                </div>
                <div class="sub-split-info">
                    <span>相手の負担割合 (${opponentRatio}%)</span>
                    <span>${opponentCost.toLocaleString()} 円</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function formatDateLabel(dateStr) {
    const d = parseSafeDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(d);
}

// ==========================================
// 4. SHOPPING LIST MANAGEMENT
// ==========================================
function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    appData.shoppingList.forEach(item => {
        const li = document.createElement("li");
        li.className = `shopping-item ${item.checked ? 'checked' : ''}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;" onclick="toggleShoppingItem(${item.id})">
                <span class="material-icons-round" style="color:var(--text-sub); font-size:16px; flex-shrink:0;">
                    ${item.checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                ${item.category ? `<span class="item-category-badge">${item.category}</span>` : ""}
                <span>${item.text}</span>
            </div>
            <span class="material-icons-round" style="color:var(--danger-color); cursor:pointer; font-size:16px; flex-shrink:0;" onclick="deleteShoppingItem(${item.id})">delete</span>
        `;
        listContainer.appendChild(li);
    });
}

// ==========================================
// 5. SETTLEMENT ENGINE
// ==========================================
function renderSettlement() {
    const u1 = appData.users[1];
    const u2 = appData.users[2];
    const u1Name = u1.name || "ユーザー1";
    const u2Name = u2.name || "ユーザー2";

    let u1Demands = 0;
    let u2Demands = 0;

    appData.payments.forEach(p => {
        if (!p.settled) {
            const opponentAmount = Math.round(p.amount * (p.ratio / 100));
            if (p.userId === 1) u1Demands += opponentAmount;
            else u2Demands += opponentAmount;
        }
    });

    const resultTextDiv = document.getElementById("settlement-result-text");
    if (resultTextDiv) {
        if (u1Demands === u2Demands) {
            resultTextDiv.innerHTML = `現在、お互いの精算額は相殺されて <span class="settlement-result-amount">0 円</span> です。`;
        } else if (u1Demands > u2Demands) {
            const diff = u1Demands - u2Demands;
            resultTextDiv.innerHTML = `${u2Name} は ${u1Name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
        } else {
            const diff = u2Demands - u1Demands;
            resultTextDiv.innerHTML = `${u1Name} は ${u2Name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
        }
    }

    const lblU1 = document.getElementById("label-confirm-user1");
    const lblU2 = document.getElementById("label-confirm-user2");
    if (lblU1) lblU1.innerText = `${u1Name} の確認`;
    if (lblU2) lblU2.innerText = `${u2Name} の確認`;

    const btn1 = document.getElementById("btn-confirm-user1");
    const btn2 = document.getElementById("btn-confirm-user2");

    if (btn1 && btn2) {
        if (appData.currentOperator === 1) {
            btn1.disabled = false; btn1.classList.add("operable");
            btn2.disabled = true; btn2.classList.remove("operable");
        } else {
            btn1.disabled = true; btn1.classList.remove("operable");
            btn2.disabled = false; btn2.classList.add("operable");
        }

        if (appData.confirmations[1]) btn1.classList.add("confirmed"); else btn1.classList.remove("confirmed");
        if (appData.confirmations[2]) btn2.classList.add("confirmed"); else btn2.classList.remove("confirmed");
    }
}

function updateThemeColor() {
    const card = document.getElementById("settlement-card");
    if (!card) return;
    if (appData.confirmations[1] && appData.confirmations[2]) {
        card.style.backgroundColor = appData.settledColor;
        archiveCurrentMonthPayments();
    } else {
        card.style.backgroundColor = "#e2e8f0";
    }
}

function archiveCurrentMonthPayments() {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let updated = false;
    appData.payments.forEach(p => {
        if (!p.settled) { p.settled = true; p.settledMonth = monthStr; updated = true; }
    });
    if (updated) {
        saveData();
        setTimeout(() => {
            appData.confirmations[1] = false;
            appData.confirmations[2] = false;
            saveData();
            initApp();
        }, 1500);
    }
}

// ==========================================
// 6. FRIDGE MANAGEMENT
// ==========================================
const FRIDGE_CATEGORIES = ["冷蔵室", "冷凍室", "常温室"];

function renderFridge() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    FRIDGE_CATEGORIES.forEach(cat => {
        const listEl = document.getElementById(`list-${cat}`);
        const countEl = document.getElementById(`count-${cat}`);
        if (!listEl) return;

        const items = appData.fridgeItems.filter(i => i.category === cat);
        if (countEl) countEl.textContent = items.length;

        listEl.innerHTML = "";

        if (items.length === 0) {
            listEl.innerHTML = `<li class="fridge-empty-hint">まだ登録されていません</li>`;
            return;
        }

        items.forEach(item => {
            const li = document.createElement("li");
            li.className = "fridge-item";

            let expiryHtml = "";
            if (item.expiry) {
                const expDate = parseSafeDate(item.expiry);
                const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                const expiryLabel = formatExpiryLabel(item.expiry);
                const cls = diffDays <= 3 ? "expiry-soon" : "expiry-ok";
                expiryHtml = `<span class="fridge-item-expiry ${cls}">${expiryLabel}</span>`;
            }

            li.innerHTML = `
                <span class="fridge-item-name">${item.name}</span>
                <span class="fridge-item-qty">${item.qty} ${item.unit}</span>
                ${expiryHtml}
                <span class="material-icons-round" style="font-size:15px; color:var(--text-sub); cursor:pointer; flex-shrink:0;" onclick="editFridgeItem(${item.id})">edit</span>
                <span class="material-icons-round" style="font-size:15px; color:var(--danger-color); cursor:pointer; flex-shrink:0;" onclick="deleteFridgeItem(${item.id})">delete</span>
            `;
            listEl.appendChild(li);
        });
    });
}

function formatExpiryLabel(dateStr) {
    const d = parseSafeDate(dateStr);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(d) + "まで";
}

window.editFridgeItem = function(id) {
    const item = appData.fridgeItems.find(i => i.id === id);
    if (!item) return;
    
    const titleEl = document.getElementById("fridge-modal-title");
    const editIdEl = document.getElementById("fridge-edit-id");
    const nameEl = document.getElementById("fridge-name");
    const qtyEl = document.getElementById("fridge-qty");
    const unitEl = document.getElementById("fridge-unit");
    const categoryEl = document.getElementById("fridge-category");
    const expiryEl = document.getElementById("fridge-expiry");
    const modalEl = document.getElementById("modal-fridge-entry");

    if (titleEl) titleEl.innerText = "食材を編集";
    if (editIdEl) editIdEl.value = item.id;
    if (nameEl) nameEl.value = item.name;
    if (qtyEl) qtyEl.value = item.qty;
    if (unitEl) unitEl.value = item.unit;
    if (categoryEl) categoryEl.value = item.category;
    if (expiryEl) expiryEl.value = item.expiry || "";
    
    validateFridgeInput();
    if (modalEl) modalEl.classList.add("open");
};

window.deleteFridgeItem = function(id) {
    if (confirm("この食材を削除しますか？")) {
        appData.fridgeItems = appData.fridgeItems.filter(i => i.id !== id);
        saveData();
        renderFridge();
    }
};

function validateFridgeInput() {
    const nameInput = document.getElementById("fridge-name");
    const btnSave = document.getElementById("btn-save-fridge");
    if (!nameInput || !btnSave) return;
    const name = nameInput.value.trim();
    btnSave.disabled = !name;
}

// ==========================================
// 7. HISTORICAL ARCHIVE SYSTEM
// ==========================================
function renderArchive() {
    const filterSelect = document.getElementById("archive-month-filter");
    const timeline = document.getElementById("archive-timeline");
    if (!filterSelect || !timeline) return;

    const months = [...new Set(appData.payments.filter(p => p.settled).map(p => p.settledMonth))];
    months.sort((a, b) => b.localeCompare(a));

    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = "";

    if (months.length === 0) {
        filterSelect.innerHTML = `<option value="">履歴なし</option>`;
        timeline.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.75rem; padding:40px 0;">アーカイブされたデータはありません</p>`;
        return;
    }

    months.forEach(m => { filterSelect.innerHTML += `<option value="${m}">${m}</option>`; });
    filterSelect.value = months.includes(currentFilter) ? currentFilter : months[0];

    const selectedMonth = filterSelect.value;
    timeline.innerHTML = "";

    appData.payments.filter(p => p.settled && p.settledMonth === selectedMonth).forEach(pay => {
        const user = appData.users[pay.userId] || { name: "ユーザー" };
        const item = document.createElement("div");
        item.className = "card";
        item.style.backgroundColor = "#ffffff";
        item.style.border = "1px solid var(--border-color)";
        item.innerHTML = `
            <div class="card-header" style="font-size:0.65rem; color:var(--text-sub)">
                <span>記録者: ${user.name}</span>
                <span>${pay.date}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.75rem;">
                <span>${pay.title}</span>
                <span style="margin-left:auto;">${pay.amount.toLocaleString()} 円</span>
            </div>
        `;
        timeline.appendChild(item);
    });
}

// ==========================================
// 8. DATA EXPORT / IMPORT ENGINE (CSV)
// ==========================================
function exportCSV() {
    const rows = [["種別", "ID", "ユーザーID", "タイトル", "金額", "割合", "メモ", "日付", "精算済", "精算月"]];
    appData.payments.forEach(p => {
        rows.push(["支払い", p.id, p.userId, p.title, p.amount, p.ratio, p.memo || "", p.date, p.settled ? "1" : "0", p.settledMonth || ""]);
    });

    const shoppingRows = [["種別", "ID", "商品名", "カテゴリ", "チェック済"]];
    appData.shoppingList.forEach(s => {
        shoppingRows.push(["買い物", s.id, s.text, s.category || "", s.checked ? "1" : "0"]);
    });

    const fridgeRows = [["種別", "ID", "商品名", "数量", "単位", "場所", "賞味期限"]];
    appData.fridgeItems.forEach(f => {
        fridgeRows.push(["冷蔵庫", f.id, f.name, f.qty, f.unit, f.category, f.expiry || ""]);
    });

    const allRows = [...rows, [], ...shoppingRows, [], ...fridgeRows];
    const csvContent = allRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `らくらく同棲_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result.replace(/^\uFEFF/, "");
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const payments = [];
            const shoppingList = [];
            const fridgeItems = [];

            lines.forEach(line => {
                const cols = parseCSVLine(line);
                if (!cols || cols.length < 2) return;
                const type = cols[0];
                if (type === "支払い" && cols.length >= 10) {
                    payments.push({
                        id: parseInt(cols[1]) || Date.now(),
                        userId: parseInt(cols[2]) || 1,
                        title: cols[3],
                        amount: parseInt(cols[4]) || 0,
                        ratio: parseInt(cols[5]) || 50,
                        memo: cols[6],
                        date: cols[7],
                        settled: cols[8] === "1",
                        settledMonth: cols[9]
                    });
                } else if (type === "買い物" && cols.length >= 5) {
                    shoppingList.push({
                        id: parseInt(cols[1]) || Date.now(),
                        text: cols[2],
                        category: cols[3],
                        checked: cols[4] === "1"
                    });
                } else if (type === "冷蔵庫" && cols.length >= 7) {
                    fridgeItems.push({
                        id: parseInt(cols[1]) || Date.now(),
                        name: cols[2],
                        qty: parseFloat(cols[3]) || 1,
                        unit: cols[4],
                        category: cols[5],
                        expiry: cols[6]
                    });
                }
            });

            if (payments.length > 0 || shoppingList.length > 0 || fridgeItems.length > 0) {
                if (confirm(`インポートします。\n支払い: ${payments.length}件、買い物: ${shoppingList.length}件、冷蔵庫: ${fridgeItems.length}件\n現在のデータは上書きされます。よろしいですか？`)) {
                    appData.payments = payments;
                    appData.shoppingList = shoppingList;
                    appData.fridgeItems = fridgeItems;
                    saveData();
                    initApp();
                    alert("インポートが完了しました。");
                }
            } else {
                alert("有効なデータが見つかりませんでした。CSVのフォーマットを確認してください。");
            }
        } catch (err) {
            alert("CSVの読み込みに失敗しました。ファイルを確認してください。");
        }
    };
    reader.readAsText(file, "UTF-8");
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current); current = "";
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ==========================================
// 9. FORM VALIDATIONS & INPUT COMPUTATION
// ==========================================
function validatePaymentInput() {
    const titleInput = document.getElementById("pay-title");
    const amountInput = document.getElementById("pay-amount");
    const dateInput = document.getElementById("pay-date");
    const btnSave = document.getElementById("btn-save-payment");

    if (!titleInput || !amountInput || !dateInput || !btnSave) return;

    const title = titleInput.value.trim();
    const amount = parseInt(amountInput.value);
    const dateVal = dateInput.value;
    btnSave.disabled = (!title || isNaN(amount) || amount <= 0 || !dateVal);
}

function updateCalculatedAmount() {
    const amountInput = document.getElementById("pay-amount");
    const ratioInput = document.getElementById("pay-ratio");
    const ratioDisplay = document.getElementById("ratio-display");
    const calcAmountInput = document.getElementById("pay-calc-amount");

    if (!amountInput || !ratioInput) return;

    const amount = parseInt(amountInput.value) || 0;
    const ratio = parseInt(ratioInput.value);
    
    if (ratioDisplay) ratioDisplay.innerText = ratio;
    if (calcAmountInput) calcAmountInput.value = `${Math.round(amount * (ratio / 100)).toLocaleString()} 円`;
}

// ==========================================
// 10. PROTECTED EVENT LIFECYCLES
// ==========================================
function setupEventListeners() {
    // Tab Navigation UI Lifecycle
    document.querySelectorAll(".app-nav .nav-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            document.querySelectorAll(".app-nav .nav-item").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            const targetPanel = document.getElementById(targetTab);
            if (targetPanel) targetPanel.classList.add("active");
        });
    });

    // Operational Context Switcher
    const userSelector = document.getElementById("user-selector");
    if (userSelector) {
        userSelector.addEventListener("change", (e) => {
            appData.currentOperator = parseInt(e.target.value);
            saveData();
            renderSettlement();
        });
    }

    // Payment FAB & Control Interface
    const fabAddPayment = document.getElementById("fab-add-payment");
    if (fabAddPayment) {
        fabAddPayment.addEventListener("click", () => {
            const titleEl = document.getElementById("payment-modal-title");
            const editIdEl = document.getElementById("pay-edit-id");
            const titleInput = document.getElementById("pay-title");
            const amountInput = document.getElementById("pay-amount");
            const dateInput = document.getElementById("pay-date");
            const ratioInput = document.getElementById("pay-ratio");
            const memoInput = document.getElementById("pay-memo");
            const modalPayment = document.getElementById("modal-payment-entry");

            if (titleEl) titleEl.innerText = "支払いを記録";
            if (editIdEl) editIdEl.value = "";
            if (titleInput) titleInput.value = "";
            if (amountInput) amountInput.value = "";
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            if (ratioInput) ratioInput.value = 50;
            if (memoInput) memoInput.value = "";
            
            updateCalculatedAmount();
            validatePaymentInput();
            if (modalPayment) modalPayment.classList.add("open");
        });
    }

    const btnClosePayment = document.getElementById("btn-close-payment");
    if (btnClosePayment) {
        btnClosePayment.addEventListener("click", () => {
            const modalPayment = document.getElementById("modal-payment-entry");
            if (modalPayment) modalPayment.classList.remove("open");
        });
    }

    // Input Reactive Calculation Bindings
    const payRatio = document.getElementById("pay-ratio");
    const payTitle = document.getElementById("pay-title");
    const payDate = document.getElementById("pay-date");
    const payAmount = document.getElementById("pay-amount");

    if (payRatio) payRatio.addEventListener("input", updateCalculatedAmount);
    if (payTitle) payTitle.addEventListener("input", validatePaymentInput);
    if (payDate) payDate.addEventListener("change", validatePaymentInput);
    if (payAmount) {
        payAmount.addEventListener("input", () => {
            updateCalculatedAmount();
            validatePaymentInput();
        });
    }

    const btnSavePayment = document.getElementById("btn-save-payment");
    if (btnSavePayment) {
        btnSavePayment.addEventListener("click", () => {
            const editId = document.getElementById("pay-edit-id").value;
            const title = document.getElementById("pay-title").value.trim();
            const amount = parseInt(document.getElementById("pay-amount").value);
            const dateVal = document.getElementById("pay-date").value || new Date().toISOString().split('T')[0];
            const ratio = parseInt(document.getElementById("pay-ratio").value);
            const memo = document.getElementById("pay-memo").value.trim();

            if (editId) {
                const existing = appData.payments.find(p => p.id === parseInt(editId));
                if (existing) { existing.title = title; existing.amount = amount; existing.date = dateVal; existing.ratio = ratio; existing.memo = memo; }
            } else {
                appData.payments.push({ id: Date.now(), userId: appData.currentOperator, title, amount, ratio, memo, date: dateVal, settled: false, settledMonth: "" });
            }

            appData.confirmations[1] = false;
            appData.confirmations[2] = false;
            saveData();
            initApp();
            const modalPayment = document.getElementById("modal-payment-entry");
            if (modalPayment) modalPayment.classList.remove("open");
        });
    }

    // Shopping Add Systems
    const btnAddShopping = document.getElementById("btn-add-shopping");
    if (btnAddShopping) {
        btnAddShopping.addEventListener("click", () => {
            const input = document.getElementById("shopping-item-name");
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            const category = document.getElementById("shopping-category").value;
            appData.shoppingList.push({ id: Date.now(), text, category, checked: false });
            input.value = "";
            saveData();
            renderShoppingList();
        });
    }

    const shoppingItemName = document.getElementById("shopping-item-name");
    if (shoppingItemName) {
        shoppingItemName.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const btnAdd = document.getElementById("btn-add-shopping");
                if (btnAdd) btnAdd.click();
            }
        });
    }

    // Confirmation Triggers
    const btnConfirmU1 = document.getElementById("btn-confirm-user1");
    if (btnConfirmU1) {
        btnConfirmU1.addEventListener("click", () => {
            if (appData.currentOperator === 1) {
                appData.confirmations[1] = !appData.confirmations[1];
                saveData(); renderSettlement(); updateThemeColor();
            }
        });
    }
    const btnConfirmU2 = document.getElementById("btn-confirm-user2");
    if (btnConfirmU2) {
        btnConfirmU2.addEventListener("click", () => {
            if (appData.currentOperator === 2) {
                appData.confirmations[2] = !appData.confirmations[2];
                saveData(); renderSettlement(); updateThemeColor();
            }
        });
    }

    // Data I/O Triggers
    const btnCsvExport = document.getElementById("btn-csv-export");
    if (btnCsvExport) btnCsvExport.addEventListener("click", exportCSV);

    const csvImportInput = document.getElementById("csv-import-input");
    if (csvImportInput) {
        csvImportInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) { importCSV(file); e.target.value = ""; }
        });
    }

    // Historical Filtering Trigger
    const archiveMonthFilter = document.getElementById("archive-month-filter");
    if (archiveMonthFilter) archiveMonthFilter.addEventListener("change", renderArchive);

    // Profile Settings UI Listeners
    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            switchProfileEditor(1);
            const modalProfile = document.getElementById("modal-profile");
            if (modalProfile) modalProfile.classList.add("open");
        });
    }
    const btnCloseProfile = document.getElementById("btn-close-profile");
    if (btnCloseProfile) {
        btnCloseProfile.addEventListener("click", () => {
            const modalProfile = document.getElementById("modal-profile");
            if (modalProfile) modalProfile.classList.remove("open");
        });
    }
    const editName = document.getElementById("edit-name");
    if (editName) {
        editName.addEventListener("input", () => updateAvatarPreview(activeEditorUser));
    }

    const btnSaveProfile = document.getElementById("btn-save-profile");
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener("click", () => {
            const editNameInput = document.getElementById("edit-name");
            if (editNameInput && (activeEditorUser === 1 || activeEditorUser === 2)) {
                const inputName = editNameInput.value.trim();
                appData.users[activeEditorUser].name = inputName || `ユーザー ${activeEditorUser}`;
            }
            if (appData.isNewAccount) {
                if (activeEditorUser === 1) { activeEditorUser = 2; switchProfileEditor(2); return; }
                else if (activeEditorUser === 2) { appData.isNewAccount = false; }
            }
            saveData();
            initApp();
            const modalProfile = document.getElementById("modal-profile");
            if (modalProfile) modalProfile.classList.remove("open");
        });
    }

    // Fridge Creation Interface
    const fabAddFridge = document.getElementById("fab-add-fridge");
    if (fabAddFridge) {
        fabAddFridge.addEventListener("click", () => {
            const titleEl = document.getElementById("fridge-modal-title");
            const editIdEl = document.getElementById("fridge-edit-id");
            const nameEl = document.getElementById("fridge-name");
            const qtyEl = document.getElementById("fridge-qty");
            const unitEl = document.getElementById("fridge-unit");
            const categoryEl = document.getElementById("fridge-category");
            const expiryEl = document.getElementById("fridge-expiry");
            const modalFridge = document.getElementById("modal-fridge-entry");

            if (titleEl) titleEl.innerText = "食材を追加";
            if (editIdEl) editIdEl.value = "";
            if (nameEl) nameEl.value = "";
            if (qtyEl) qtyEl.value = "";
            if (unitEl) unitEl.value = "個";
            if (categoryEl) categoryEl.value = "冷蔵室";
            if (expiryEl) expiryEl.value = "";
            
            validateFridgeInput();
            if (modalFridge) modalFridge.classList.add("open");
        });
    }

    const btnCloseFridge = document.getElementById("btn-close-fridge");
    if (btnCloseFridge) {
        btnCloseFridge.addEventListener("click", () => {
            const modalFridge = document.getElementById("modal-fridge-entry");
            if (modalFridge) modalFridge.classList.remove("open");
        });
    }

    const fridgeNameInput = document.getElementById("fridge-name");
    if (fridgeNameInput) fridgeNameInput.addEventListener("input", validateFridgeInput);

    const btnSaveFridge = document.getElementById("btn-save-fridge");
    if (btnSaveFridge) {
        btnSaveFridge.addEventListener("click", () => {
            const editId = document.getElementById("fridge-edit-id").value;
            const name = document.getElementById("fridge-name").value.trim();
            const qty = parseFloat(document.getElementById("fridge-qty").value) || 1;
            const unit = document.getElementById("fridge-unit").value;
            const category = document.getElementById("fridge-category").value;
            const expiry = document.getElementById("fridge-expiry").value || "";

            if (editId) {
                const existing = appData.fridgeItems.find(i => i.id === parseInt(editId));
                if (existing) { existing.name = name; existing.qty = qty; existing.unit = unit; existing.category = category; existing.expiry = expiry; }
            } else {
                appData.fridgeItems.push({ id: Date.now(), name, qty, unit, category, expiry });
            }

            saveData();
            renderFridge();
            const modalFridge = document.getElementById("modal-fridge-entry");
            if (modalFridge) modalFridge.classList.remove("open");
        });
    }

    // Core Content Accordion Layout System
    document.querySelectorAll(".accordion-header").forEach(header => {
        header.addEventListener("click", () => {
            const section = header.closest(".accordion-section");
            if (!section) return;
            const body = section.querySelector(".accordion-body");
            if (!body) return;
            const isOpen = body.classList.contains("open");
            body.classList.toggle("open", !isOpen);
            section.classList.toggle("collapsed", isOpen);
        });
    });
}

// ==========================================
// 11. PROFILE MODAL EDIT SYSTEM UI
// ==========================================
window.editPayment = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;

    const titleEl = document.getElementById("payment-modal-title");
    const editIdEl = document.getElementById("pay-edit-id");
    const titleInput = document.getElementById("pay-title");
    const amountInput = document.getElementById("pay-amount");
    const dateInput = document.getElementById("pay-date");
    const ratioInput = document.getElementById("pay-ratio");
    const memoInput = document.getElementById("pay-memo");
    const modalPayment = document.getElementById("modal-payment-entry");

    if (titleEl) titleEl.innerText = "支出を編集";
    if (editIdEl) editIdEl.value = pay.id;
    if (titleInput) titleInput.value = pay.title;
    if (amountInput) amountInput.value = pay.amount;
    if (dateInput) dateInput.value = pay.date;
    if (ratioInput) ratioInput.value = pay.ratio;
    if (memoInput) memoInput.value = pay.memo || "";
    
    updateCalculatedAmount();
    validatePaymentInput();
    if (modalPayment) modalPayment.classList.add("open");
};

window.deletePayment = function(id) {
    if (confirm("この支出を削除しますか？")) {
        appData.payments = appData.payments.filter(p => p.id !== id);
        saveData(); initApp();
    }
};

window.toggleShoppingItem = function(id) {
    const item = appData.shoppingList.find(i => i.id === id);
    if (item) item.checked = !item.checked;
    saveData(); renderShoppingList();
};

window.deleteShoppingItem = function(id) {
    appData.shoppingList = appData.shoppingList.filter(i => i.id !== id);
    saveData(); renderShoppingList();
};

window.switchProfileEditor = function(type) {
    activeEditorUser = type;
    document.querySelectorAll(".modal-tab-btn").forEach((b, idx) => {
        if (idx + 1 === type) b.classList.add("active"); else b.classList.remove("active");
    });

    const tabU1 = document.getElementById("modal-tab-u1");
    const tabU2 = document.getElementById("modal-tab-u2");
    if (tabU1) tabU1.innerText = appData.users[1].name || "ユーザー1";
    if (tabU2) tabU2.innerText = appData.users[2].name || "ユーザー2";

    const titleEl = document.getElementById("modal-profile-title");
    const subtitleEl = document.getElementById("modal-profile-subtitle");
    const progressFill = document.getElementById("onboarding-progress-fill");
    const saveBtn = document.getElementById("btn-save-profile");

    if (appData.isNewAccount && (type === 1 || type === 2)) {
        if (titleEl) titleEl.innerText = type === 1 ? "ようこそ！" : "もう一人のプロフィール";
        if (subtitleEl) subtitleEl.innerText = type === 1
            ? "あなたの名前とテーマカラーを設定してください"
            : "次に、もう一人の名前とテーマカラーを設定してください";
        if (progressFill) progressFill.style.width = type === 1 ? "50%" : "100%";
        if (saveBtn) saveBtn.innerText = type === 1 ? "次へ" : "はじめる";
    } else {
        if (titleEl) titleEl.innerText = "プロフィールの編集";
        if (saveBtn) saveBtn.innerText = "保存して閉じる";
    }

    const formUser = document.getElementById("form-user-edit");
    const formColor = document.getElementById("form-settled-color-edit");

    if (type === 1 || type === 2) {
        if (formUser) formUser.style.display = "block"; 
        if (formColor) formColor.style.display = "none";
        const editNameInput = document.getElementById("edit-name");
        if (editNameInput) editNameInput.value = appData.users[type].name;
        updateAvatarPreview(type);
    } else if (type === 3) {
        if (formUser) formUser.style.display = "none"; 
        if (formColor) formColor.style.display = "block";
    }
    renderColorPicker(type);
};

function renderColorPicker(type) {
    const isUserType = type === 1 || type === 2;
    const picker = document.getElementById(isUserType ? "user-color-picker" : "settled-color-picker");
    if (!picker) return;

    const currentColor = isUserType ? appData.users[type].color : appData.settledColor;
    picker.innerHTML = "";
    PALETTE.forEach(c => {
        const dot = document.createElement("div");
        dot.className = `color-dot ${currentColor === c ? 'selected' : ''}`;
        dot.style.backgroundColor = c;
        dot.onclick = () => {
            if (isUserType) { appData.users[type].color = c; updateAvatarPreview(type); }
            else { appData.settledColor = c; }
            renderColorPicker(type);
        };
        picker.appendChild(dot);
    });
}

function updateAvatarPreview(type) {
    if (type !== 1 && type !== 2) return;
    const preview = document.getElementById("user-avatar-preview");
    if (!preview) return;

    const nameInput = document.getElementById("edit-name");
    const nameVal = nameInput ? nameInput.value.trim() : "";
    preview.style.backgroundColor = appData.users[type].color;
    preview.innerText = nameVal ? nameVal.charAt(0).toUpperCase() : "?";
}
