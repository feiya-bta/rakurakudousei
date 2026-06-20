// --- デフォルトデータ構造 ---
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
// 冷蔵庫データが既存データに存在しない場合は初期化
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
    const isBrandNewSession = appData.isNewAccount || !appData.users[1].name || !appData.users[2].name;

    if (isBrandNewSession) {
        appData.isNewAccount = true;
        container.classList.add("onboarding-mode");
        if (activeEditorUser !== 1 && activeEditorUser !== 2) activeEditorUser = 1;
        switchProfileEditor(activeEditorUser);
        document.getElementById("modal-profile").classList.add("open");
    } else {
        container.classList.remove("onboarding-mode");
    }
}

function saveData() {
    localStorage.setItem("rakuraku_domo_data", JSON.stringify(appData));
}

// ===== ユーザーセレクター =====
function renderUserSelectors() {
    const selector = document.getElementById("user-selector");
    const u1Name = appData.users[1].name || "ユーザー1";
    const u2Name = appData.users[2].name || "ユーザー2";
    selector.innerHTML = `
        <option value="1">${u1Name} として操作</option>
        <option value="2">${u2Name} として操作</option>
    `;
    selector.value = appData.currentOperator;
}

// ===== 支払いタイムライン =====
function renderTimeline() {
    const container = document.getElementById("payment-timeline");
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
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(d);
}

// ===== 買い物リスト =====
function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
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

// ===== 精算 =====
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

    const now = new Date();
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById("settlement-month-label").innerText = `${monthLabel} の清算`;

    const resultTextDiv = document.getElementById("settlement-result-text");
    if (u1Demands === u2Demands) {
        resultTextDiv.innerHTML = `現在、お互いの精算額は相殺されて <span class="settlement-result-amount">0 円</span> です。`;
    } else if (u1Demands > u2Demands) {
        const diff = u1Demands - u2Demands;
        resultTextDiv.innerHTML = `${u2Name} は ${u1Name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
    } else {
        const diff = u2Demands - u1Demands;
        resultTextDiv.innerHTML = `${u1Name} は ${u2Name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
    }

    document.getElementById("label-confirm-user1").innerText = `${u1Name} の確認`;
    document.getElementById("label-confirm-user2").innerText = `${u2Name} の確認`;

    const btn1 = document.getElementById("btn-confirm-user1");
    const btn2 = document.getElementById("btn-confirm-user2");

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

function updateThemeColor() {
    const card = document.getElementById("settlement-card");
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

// ===== 冷蔵庫 =====
const FRIDGE_CATEGORIES = ["冷蔵室", "冷凍室", "常温室"];

function renderFridge() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    FRIDGE_CATEGORIES.forEach(cat => {
        const listEl = document.getElementById(`list-${cat}`);
        const countEl = document.getElementById(`count-${cat}`);
        const items = appData.fridgeItems.filter(i => i.category === cat);

        countEl.textContent = items.length;
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
                const expDate = new Date(`${item.expiry}T00:00:00`);
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
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(d) + "まで";
}

window.editFridgeItem = function(id) {
    const item = appData.fridgeItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById("fridge-modal-title").innerText = "食材を編集";
    document.getElementById("fridge-edit-id").value = item.id;
    document.getElementById("fridge-name").value = item.name;
    document.getElementById("fridge-qty").value = item.qty;
    document.getElementById("fridge-unit").value = item.unit;
    document.getElementById("fridge-category").value = item.category;
    document.getElementById("fridge-expiry").value = item.expiry || "";
    validateFridgeInput();
    document.getElementById("modal-fridge-entry").classList.add("open");
};

window.deleteFridgeItem = function(id) {
    if (confirm("この食材を削除しますか？")) {
        appData.fridgeItems = appData.fridgeItems.filter(i => i.id !== id);
        saveData();
        renderFridge();
    }
};

function validateFridgeInput() {
    const name = document.getElementById("fridge-name").value.trim();
    document.getElementById("btn-save-fridge").disabled = !name;
}

// ===== 履歴 =====
function renderArchive() {
    const filterSelect = document.getElementById("archive-month-filter");
    const timeline = document.getElementById("archive-timeline");

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

// ===== CSV エクスポート / インポート =====
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

// ===== 支払い入力バリデーション =====
function validatePaymentInput() {
    const title = document.getElementById("pay-title").value.trim();
    const amount = parseInt(document.getElementById("pay-amount").value);
    const dateVal = document.getElementById("pay-date").value;
    document.getElementById("btn-save-payment").disabled = (!title || isNaN(amount) || amount <= 0 || !dateVal);
}

function updateCalculatedAmount() {
    const amount = parseInt(document.getElementById("pay-amount").value) || 0;
    const ratio = parseInt(document.getElementById("pay-ratio").value);
    document.getElementById("ratio-display").innerText = ratio;
    document.getElementById("pay-calc-amount").value = `${Math.round(amount * (ratio / 100)).toLocaleString()} 円`;
}

// ===== イベントリスナー =====
function setupEventListeners() {
    // タブナビゲーション
    document.querySelectorAll(".app-nav .nav-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            document.querySelectorAll(".app-nav .nav-item").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
        });
    });

    // ユーザー切替
    document.getElementById("user-selector").addEventListener("change", (e) => {
        appData.currentOperator = parseInt(e.target.value);
        saveData();
        renderSettlement();
    });

    // 支払い FAB
    document.getElementById("fab-add-payment").addEventListener("click", () => {
        document.getElementById("payment-modal-title").innerText = "支払いを記録";
        document.getElementById("pay-edit-id").value = "";
        document.getElementById("pay-title").value = "";
        document.getElementById("pay-amount").value = "";
        document.getElementById("pay-date").value = new Date().toISOString().split('T')[0];
        document.getElementById("pay-ratio").value = 50;
        document.getElementById("pay-memo").value = "";
        updateCalculatedAmount();
        validatePaymentInput();
        document.getElementById("modal-payment-entry").classList.add("open");
    });

    document.getElementById("btn-close-payment").addEventListener("click", () => {
        document.getElementById("modal-payment-entry").classList.remove("open");
    });

    document.getElementById("pay-ratio").addEventListener("input", updateCalculatedAmount);
    document.getElementById("pay-title").addEventListener("input", validatePaymentInput);
    document.getElementById("pay-date").addEventListener("change", validatePaymentInput);
    document.getElementById("pay-amount").addEventListener("input", () => {
        updateCalculatedAmount();
        validatePaymentInput();
    });

    document.getElementById("btn-save-payment").addEventListener("click", () => {
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
        document.getElementById("modal-payment-entry").classList.remove("open");
    });

    // 買い物リスト追加
    document.getElementById("btn-add-shopping").addEventListener("click", () => {
        const input = document.getElementById("shopping-item-name");
        const text = input.value.trim();
        if (!text) return;
        const category = document.getElementById("shopping-category").value;
        appData.shoppingList.push({ id: Date.now(), text, category, checked: false });
        input.value = "";
        saveData();
        renderShoppingList();
    });

    document.getElementById("shopping-item-name").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("btn-add-shopping").click();
    });

    // 精算確認ボタン
    document.getElementById("btn-confirm-user1").addEventListener("click", () => {
        if (appData.currentOperator === 1) {
            appData.confirmations[1] = !appData.confirmations[1];
            saveData(); renderSettlement(); updateThemeColor();
        }
    });
    document.getElementById("btn-confirm-user2").addEventListener("click", () => {
        if (appData.currentOperator === 2) {
            appData.confirmations[2] = !appData.confirmations[2];
            saveData(); renderSettlement(); updateThemeColor();
        }
    });

    // CSV エクスポート / インポート
    document.getElementById("btn-csv-export").addEventListener("click", exportCSV);
    document.getElementById("csv-import-input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) { importCSV(file); e.target.value = ""; }
    });

    // 履歴フィルター
    document.getElementById("archive-month-filter").addEventListener("change", renderArchive);

    // 設定モーダル
    document.getElementById("btn-settings").addEventListener("click", () => {
        switchProfileEditor(1);
        document.getElementById("modal-profile").classList.add("open");
    });
    document.getElementById("btn-close-profile").addEventListener("click", () => {
        document.getElementById("modal-profile").classList.remove("open");
    });
    document.getElementById("edit-name").addEventListener("input", () => updateAvatarPreview(activeEditorUser));

    document.getElementById("btn-save-profile").addEventListener("click", () => {
        if (activeEditorUser === 1 || activeEditorUser === 2) {
            const inputName = document.getElementById("edit-name").value.trim();
            appData.users[activeEditorUser].name = inputName || `ユーザー ${activeEditorUser}`;
        }
        if (appData.isNewAccount) {
            if (activeEditorUser === 1) { activeEditorUser = 2; switchProfileEditor(2); return; }
            else if (activeEditorUser === 2) { appData.isNewAccount = false; }
        }
        saveData();
        initApp();
        document.getElementById("modal-profile").classList.remove("open");
    });

    // 冷蔵庫 FAB
    document.getElementById("fab-add-fridge").addEventListener("click", () => {
        document.getElementById("fridge-modal-title").innerText = "食材を追加";
        document.getElementById("fridge-edit-id").value = "";
        document.getElementById("fridge-name").value = "";
        document.getElementById("fridge-qty").value = "";
        document.getElementById("fridge-unit").value = "個";
        document.getElementById("fridge-category").value = "冷蔵室";
        document.getElementById("fridge-expiry").value = "";
        validateFridgeInput();
        document.getElementById("modal-fridge-entry").classList.add("open");
    });

    document.getElementById("btn-close-fridge").addEventListener("click", () => {
        document.getElementById("modal-fridge-entry").classList.remove("open");
    });

    document.getElementById("fridge-name").addEventListener("input", validateFridgeInput);

    document.getElementById("btn-save-fridge").addEventListener("click", () => {
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
        document.getElementById("modal-fridge-entry").classList.remove("open");
    });

    // アコーディオン
    document.querySelectorAll(".accordion-header").forEach(header => {
        header.addEventListener("click", () => {
            const section = header.closest(".accordion-section");
            const body = section.querySelector(".accordion-body");
            const isOpen = body.classList.contains("open");
            body.classList.toggle("open", !isOpen);
            section.classList.toggle("collapsed", isOpen);
        });
    });
}

// ===== プロフィールエディター =====
window.editPayment = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;
    document.getElementById("payment-modal-title").innerText = "支出を編集";
    document.getElementById("pay-edit-id").value = pay.id;
    document.getElementById("pay-title").value = pay.title;
    document.getElementById("pay-amount").value = pay.amount;
    document.getElementById("pay-date").value = pay.date;
    document.getElementById("pay-ratio").value = pay.ratio;
    document.getElementById("pay-memo").value = pay.memo || "";
    updateCalculatedAmount();
    validatePaymentInput();
    document.getElementById("modal-payment-entry").classList.add("open");
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

    document.getElementById("modal-tab-u1").innerText = appData.users[1].name || "ユーザー1";
    document.getElementById("modal-tab-u2").innerText = appData.users[2].name || "ユーザー2";

    const titleEl = document.getElementById("modal-profile-title");
    const subtitleEl = document.getElementById("modal-profile-subtitle");
    const progressFill = document.getElementById("onboarding-progress-fill");
    const saveBtn = document.getElementById("btn-save-profile");

    if (appData.isNewAccount && (type === 1 || type === 2)) {
        titleEl.innerText = type === 1 ? "ようこそ！" : "もう一人のプロフィール";
        subtitleEl.innerText = type === 1
            ? "あなたの名前とテーマカラーを設定してください"
            : "次に、もう一人の名前とテーマカラーを設定してください";
        progressFill.style.width = type === 1 ? "50%" : "100%";
        saveBtn.innerText = type === 1 ? "次へ" : "はじめる";
    } else {
        titleEl.innerText = "プロフィールの編集";
        saveBtn.innerText = "保存して閉じる";
    }

    const formUser = document.getElementById("form-user-edit");
    const formColor = document.getElementById("form-settled-color-edit");

    if (type === 1 || type === 2) {
        formUser.style.display = "block"; formColor.style.display = "none";
        document.getElementById("edit-name").value = appData.users[type].name;
        updateAvatarPreview(type);
    } else if (type === 3) {
        formUser.style.display = "none"; formColor.style.display = "block";
    }
    renderColorPicker(type);
};

function renderColorPicker(type) {
    const isUserType = type === 1 || type === 2;
    const picker = document.getElementById(isUserType ? "user-color-picker" : "settled-color-picker");
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
    const nameVal = (document.getElementById("edit-name").value || "").trim();
    preview.style.backgroundColor = appData.users[type].color;
    preview.innerText = nameVal ? nameVal.charAt(0).toUpperCase() : "?";
}
