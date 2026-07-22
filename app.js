// ==========================================
// 1. DEFAULT DATA STRUCTURE & INITIALIZATION
// ==========================================
const DEFAULT_DATA = {
    users: {
        1: { name: "", photo: null },
        2: { name: "", photo: null }
    },
    payments: [],
    shoppingList: [],
    fridgeItems: [],
    cleaningItems: [],
    shoppingCategories: [],
    confirmations: { 1: false, 2: false },
    currentOperator: 1,
    isNewAccount: true,
    lastSettlement: null
};

let appData = JSON.parse(localStorage.getItem("rakuraku_domo_data")) || JSON.parse(JSON.stringify(DEFAULT_DATA));

// Ensure fridge collection is safe
if (!appData.fridgeItems) appData.fridgeItems = [];
if (!appData.cleaningItems) appData.cleaningItems = [];
if (!appData.cleaningCategories) appData.cleaningCategories = getDefaultCleaningCategories();
if (!appData.shoppingCategories || appData.shoppingCategories.length === 0) appData.shoppingCategories = getDefaultShoppingCategories();
if (!("lastSettlement" in appData)) appData.lastSettlement = null;

let activeEditorUser = 1;
let activeCleaningCategory = null;

// アバター表示用ヘルパー：写真があれば写真を、なければ透明な円に頭文字を表示
function buildAvatarHtml(user, sizeClass) {
    const cls = sizeClass || "entry-avatar";
    const name = (user && user.name) || "";
    const initial = (name || "?").charAt(0).toUpperCase();
    if (user && user.photo) {
        return `<div class="${cls} has-photo" title="${name}"><img src="${user.photo}" alt=""></div>`;
    }
    return `<div class="${cls}" title="${name || 'ユーザー'}">${initial}</div>`;
}

function getDefaultShoppingCategories() {
    return [
        { id: 1, name: "百均" },
        { id: 2, name: "食材" },
        { id: 3, name: "薬局" },
        { id: 4, name: "文具" },
        { id: 5, name: "他" }
    ];
}

let collapsedShoppingCategories = new Set();

function getDefaultCleaningCategories() {
    return [
        { id: 1, name: "床掃除", icon: "cleaning_services" },
        { id: 2, name: "玄関", icon: "meeting_room" },
        { id: 3, name: "シンク", icon: "water_drop" },
        { id: 4, name: "風呂場", icon: "bathtub" },
        { id: 5, name: "カビ掃除", icon: "blur_on" },
        { id: 6, name: "ベッドシーツ", icon: "bed" },
        { id: 7, name: "洗濯物", icon: "local_laundry_service" },
        { id: 8, name: "電子レンジ", icon: "kitchen" }
    ];
}

// カテゴリアイコン選択肢（日常生活・掃除に関連するもの 100種）
const CLEANING_ICON_OPTIONS = [
    "cleaning_services", "local_laundry_service", "dry_cleaning", "iron", "soap",
    "sanitizer", "delete", "delete_outline", "recycling", "auto_delete",
    "kitchen", "microwave", "blender", "coffee_maker", "local_dining",
    "restaurant", "flatware", "countertops", "dining", "liquor",
    "local_cafe", "local_pizza", "egg", "bakery_dining", "icecream",
    "bathtub", "shower", "bathroom", "wc", "hot_tub",
    "spa", "bed", "king_bed", "single_bed", "hotel",
    "chair", "weekend", "chair_alt", "meeting_room", "door_front",
    "garage", "yard", "grass", "eco", "park",
    "deck", "balcony", "fence", "roofing", "stairs",
    "elevator", "house", "other_houses", "apartment", "domain",
    "cottage", "villa", "cabin", "house_siding", "foundation",
    "water_drop", "ac_unit", "air", "thermostat", "fireplace",
    "lightbulb", "power", "electrical_services", "plumbing", "wifi",
    "tv", "speaker", "router", "build", "handyman",
    "construction", "home_repair_service", "hardware", "square_foot", "inventory_2",
    "checkroom", "backpack", "luggage", "shelves", "pets",
    "local_florist", "local_grocery_store", "shopping_cart", "receipt_long", "calendar_month",
    "task_alt", "check_circle", "event", "schedule", "alarm",
    "timer", "today", "brush", "format_paint", "content_cut",
    "water", "opacity", "blur_on", "filter_vintage", "window"
];

let selectedCategoryIcon = null;

document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    initApp();
    setupEventListeners();
});

function initApp() {
    saveData();
    renderUserSelectors();
    renderTimeline();
    renderShoppingCategorySelect();
    renderShoppingList();
    renderSettlement();
    renderPreviousSettlement();
    renderFridge();
    renderArchive();
    renderCleaningCategories();
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
        container.innerHTML = `<p class="empty-hint">未精算の支払いはありません</p>`;
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

        const user = appData.users[pay.userId] || { name: "不明" };
        const opponentRatio = pay.ratio;
        const opponentCost = Math.round(pay.amount * (opponentRatio / 100));

        const row = document.createElement("div");
        row.className = "entry-row";
        row.innerHTML = `
            ${buildAvatarHtml(user)}
            <div class="entry-main">
                <div class="entry-top">
                    <span class="entry-title">${pay.title}</span>
                    <span class="entry-amount">${opponentCost.toLocaleString()} 円</span>
                </div>
                <div class="entry-sub">
                    <span class="entry-sub-left">${user.name || "ユーザー"}が${pay.amount.toLocaleString()}円を払った${pay.memo ? " ・ " + pay.memo : ""} ・ 相手負担${opponentRatio}%</span>
                    <div class="entry-actions">
                        <span class="material-icons-round entry-icon-btn" onclick="editPayment(${pay.id})">edit</span>
                        <span class="material-icons-round entry-icon-btn danger" onclick="deletePayment(${pay.id})">delete</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(row);
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
function renderShoppingCategorySelect() {
    const sel = document.getElementById("shopping-category");
    if (!sel) return;
    sel.innerHTML = appData.shoppingCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
}

function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    // カテゴリ設定の並び順を基準に表示。削除済みカテゴリの商品も念のため末尾に表示する
    const orderedNames = appData.shoppingCategories.map(c => c.name);
    appData.shoppingList.forEach(item => {
        if (!orderedNames.includes(item.category)) orderedNames.push(item.category);
    });

    let hasAny = false;
    orderedNames.forEach(catName => {
        const items = appData.shoppingList.filter(i => i.category === catName);
        if (items.length === 0) return;
        hasAny = true;

        const isOpen = !collapsedShoppingCategories.has(catName);
        const block = document.createElement("div");
        block.className = "shopping-category-block";
        block.innerHTML = `
            <div class="shopping-category-divider" onclick="toggleShoppingCategory('${catName.replace(/'/g, "\\'")}')">
                <span>${catName}</span>
            </div>
            <div class="shopping-category-items ${isOpen ? "open" : ""}">
                ${items.map(item => buildShoppingItemHtml(item)).join("")}
            </div>
        `;
        listContainer.appendChild(block);
    });

    if (!hasAny) {
        listContainer.innerHTML = `<p class="empty-hint">やるべきことはまだないです</p>`;
    }
}

function buildShoppingItemHtml(item) {
    return `
        <div class="shopping-item ${item.checked ? "checked" : ""}">
            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0;" onclick="toggleShoppingItem(${item.id})">
                <span class="material-icons-round" style="color:var(--text-sub); font-size:16px; flex-shrink:0;">
                    ${item.checked ? "check_box" : "check_box_outline_blank"}
                </span>
                <span class="shopping-item-text">${item.text}</span>
            </div>
            <span class="material-icons-round" style="color:var(--danger-color); cursor:pointer; font-size:16px; flex-shrink:0;" onclick="deleteShoppingItem(${item.id})">delete</span>
        </div>
    `;
}

window.toggleShoppingCategory = function(catName) {
    if (collapsedShoppingCategories.has(catName)) collapsedShoppingCategories.delete(catName);
    else collapsedShoppingCategories.add(catName);
    renderShoppingList();
};

// ----- やることカテゴリ管理（一覧・追加・編集・削除・並べ替え） -----
function renderShoppingCategoryManage() {
    const container = document.getElementById("shopping-category-manage-list");
    if (!container) return;
    container.innerHTML = "";

    if (appData.shoppingCategories.length === 0) {
        container.innerHTML = `<p class="empty-hint">カテゴリがありません</p>`;
        return;
    }

    appData.shoppingCategories.forEach((cat, idx) => {
        const count = appData.shoppingList.filter(i => i.category === cat.name).length;
        const row = document.createElement("div");
        row.className = "category-list-item category-manage-item";
        row.innerHTML = `
            <div class="category-item-main">
                <span class="category-item-name">${cat.name}</span>
                <span class="category-item-sub">${count}件</span>
            </div>
            <div class="entry-actions">
                <span class="material-icons-round entry-icon-btn" style="${idx === 0 ? "opacity:0.25; pointer-events:none;" : ""}" onclick="moveShoppingCategory(${cat.id}, -1)">arrow_upward</span>
                <span class="material-icons-round entry-icon-btn" style="${idx === appData.shoppingCategories.length - 1 ? "opacity:0.25; pointer-events:none;" : ""}" onclick="moveShoppingCategory(${cat.id}, 1)">arrow_downward</span>
                <span class="material-icons-round entry-icon-btn" onclick="editShoppingCategory(${cat.id})">edit</span>
                <span class="material-icons-round entry-icon-btn danger" onclick="deleteShoppingCategory(${cat.id})">delete</span>
            </div>
        `;
        container.appendChild(row);
    });
}

window.openShoppingCategoryManage = function() {
    renderShoppingCategoryManage();
    const modal = document.getElementById("modal-shopping-category-manage");
    if (modal) modal.classList.add("open");
};

window.moveShoppingCategory = function(id, direction) {
    const idx = appData.shoppingCategories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= appData.shoppingCategories.length) return;
    const arr = appData.shoppingCategories;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    saveData();
    renderShoppingCategoryManage();
    renderShoppingCategorySelect();
    renderShoppingList();
};

window.editShoppingCategory = function(id) {
    openShoppingCategoryEntry(id);
};

window.deleteShoppingCategory = function(id) {
    const cat = appData.shoppingCategories.find(c => c.id === id);
    if (!cat) return;
    const relatedCount = appData.shoppingList.filter(i => i.category === cat.name).length;
    const msg = relatedCount > 0
        ? `「${cat.name}」を削除しますか？\nこのカテゴリのやること ${relatedCount}件 も一緒に削除されます。`
        : `「${cat.name}」を削除しますか？`;
    if (confirm(msg)) {
        appData.shoppingCategories = appData.shoppingCategories.filter(c => c.id !== id);
        appData.shoppingList = appData.shoppingList.filter(i => i.category !== cat.name);
        saveData();
        renderShoppingCategoryManage();
        renderShoppingCategorySelect();
        renderShoppingList();
    }
};

window.openShoppingCategoryEntry = function(categoryId) {
    const editIdEl = document.getElementById("shopping-category-edit-id");
    const nameEl = document.getElementById("shopping-category-name");
    const titleEl = document.getElementById("shopping-category-entry-title");
    const saveBtn = document.getElementById("btn-save-shopping-category");

    if (categoryId) {
        const cat = appData.shoppingCategories.find(c => c.id === categoryId);
        if (!cat) return;
        if (editIdEl) editIdEl.value = cat.id;
        if (nameEl) nameEl.value = cat.name;
        if (titleEl) titleEl.innerText = "カテゴリを編集";
        if (saveBtn) { saveBtn.innerText = "保存する"; saveBtn.disabled = false; }
    } else {
        if (editIdEl) editIdEl.value = "";
        if (nameEl) nameEl.value = "";
        if (titleEl) titleEl.innerText = "カテゴリを追加";
        if (saveBtn) { saveBtn.innerText = "追加する"; saveBtn.disabled = true; }
    }

    const modal = document.getElementById("modal-shopping-category-entry");
    if (modal) modal.classList.add("open");
};

// ==========================================
// 5. SETTLEMENT ENGINE
// ==========================================

// 今月 (YYYY-MM) を返す
function getCurrentMonthStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 精算対象の支払い一覧：未精算 かつ 支払い日が「今月まで」のもの
// （未来日で記録された支払いは、その月になるまで今回の精算に含めない）
function getPendingPaymentsForSettlement() {
    const currentMonth = getCurrentMonthStr();
    return appData.payments.filter(p => !p.settled && p.date && p.date.slice(0, 7) <= currentMonth);
}

function renderSettlement() {
    const u1 = appData.users[1];
    const u2 = appData.users[2];
    const u1Name = u1.name || "ユーザー1";
    const u2Name = u2.name || "ユーザー2";
    const currentMonth = getCurrentMonthStr();

    const monthLabelEl = document.getElementById("settlement-month-label");
    if (monthLabelEl) monthLabelEl.textContent = `${currentMonth} の精算`;

    let u1Demands = 0;
    let u2Demands = 0;

    getPendingPaymentsForSettlement().forEach(p => {
        const opponentAmount = Math.round(p.amount * (p.ratio / 100));
        if (p.userId === 1) u1Demands += opponentAmount;
        else u2Demands += opponentAmount;
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
        card.classList.add("settled");
        archiveCurrentMonthPayments();
    } else {
        card.classList.remove("settled");
    }
}

function archiveCurrentMonthPayments() {
    const monthStr = getCurrentMonthStr();
    const pending = getPendingPaymentsForSettlement();
    if (pending.length === 0) return;

    // 精算前の内容をスナップショットとして保存し、精算後も「前回の精算」として表示し続ける
    const monthLabelEl = document.getElementById("settlement-month-label");
    const items = pending.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => {
        const user = appData.users[p.userId] || { name: "不明" };
        return {
            title: p.title,
            date: p.date,
            payerName: user.name || "ユーザー",
            opponentCost: Math.round(p.amount * (p.ratio / 100))
        };
    });
    appData.lastSettlement = {
        label: monthLabelEl ? monthLabelEl.textContent : monthStr,
        items
    };

    const settlementId = Date.now();
    pending.forEach(p => { p.settled = true; p.settledMonth = monthStr; p.settlementId = settlementId; p.settledAt = settlementId; });
    saveData();
    setTimeout(() => {
        appData.confirmations[1] = false;
        appData.confirmations[2] = false;
        saveData();
        initApp();
    }, 1500);
}

function renderPreviousSettlement() {
    const card = document.getElementById("settlement-card-previous");
    if (!card) return;
    if (!appData.lastSettlement) {
        card.style.display = "none";
        return;
    }
    card.style.display = "block";
    card.classList.remove("expanded");

    const labelEl = document.getElementById("settlement-previous-label");
    if (labelEl) labelEl.textContent = `${appData.lastSettlement.label}（精算済み）`;

    const u1Name = appData.users[1].name || "ユーザー1";
    const u2Name = appData.users[2].name || "ユーザー2";
    const confLabel1 = document.getElementById("settlement-previous-label-user1");
    const confLabel2 = document.getElementById("settlement-previous-label-user2");
    if (confLabel1) confLabel1.innerText = `${u1Name} の確認`;
    if (confLabel2) confLabel2.innerText = `${u2Name} の確認`;

    const itemsEl = document.getElementById("settlement-previous-items");
    if (itemsEl) {
        const items = appData.lastSettlement.items || [];
        if (items.length === 0) {
            itemsEl.innerHTML = `<p class="settlement-previous-empty">内訳データがありません</p>`;
        } else {
            itemsEl.innerHTML = items.map(it => `
                <div class="settlement-previous-item-row">
                    <span class="sp-item-title">${formatDateLabel(it.date)} ・ ${it.payerName}が立替 ・ ${it.title}</span>
                    <span class="sp-item-amount">${it.opponentCost.toLocaleString()} 円</span>
                </div>
            `).join("");
        }
    }
}

window.toggleSettlementPreviousDetail = function() {
    const card = document.getElementById("settlement-card-previous");
    if (card) card.classList.toggle("expanded");
};

// ==========================================
// 6. FRIDGE MANAGEMENT
// ==========================================
const FRIDGE_CATEGORIES = [
    { key: "冷蔵室", icon: "kitchen" },
    { key: "冷凍室", icon: "ac_unit" },
    { key: "常温室", icon: "eco" }
];

let activeFridgeCategory = null;

function renderFridge() {
    const container = document.getElementById("fridge-category-list");
    if (!container) return;
    container.innerHTML = "";

    FRIDGE_CATEGORIES.forEach(cat => {
        const items = appData.fridgeItems.filter(i => i.category === cat.key);
        let subLabel = "まだ登録されていません";

        if (items.length > 0) {
            const withExpiry = items.filter(i => i.expiry).sort((a, b) => a.expiry.localeCompare(b.expiry));
            if (withExpiry.length > 0) {
                subLabel = `${items.length}件 ・ ${withExpiry[0].name} ${formatExpiryLabel(withExpiry[0].expiry)}`;
            } else {
                subLabel = `${items.length}件`;
            }
        }

        const row = document.createElement("div");
        row.className = "category-list-item";
        row.onclick = () => openFridgeDetail(cat.key);
        row.innerHTML = `
            <span class="material-icons-round category-item-icon">${cat.icon}</span>
            <div class="category-item-main">
                <span class="category-item-name">${cat.key}</span>
                <span class="category-item-sub">${subLabel}</span>
            </div>
            <span class="material-icons-round category-item-chevron">chevron_right</span>
        `;
        container.appendChild(row);
    });
}

window.openFridgeDetail = function(category) {
    activeFridgeCategory = category;
    const titleEl = document.getElementById("fridge-detail-title");
    if (titleEl) titleEl.innerText = category;
    renderFridgeDetail();
    const modal = document.getElementById("modal-fridge-detail");
    if (modal) modal.classList.add("open");
};

function renderFridgeDetail() {
    const listEl = document.getElementById("fridge-detail-list");
    if (!listEl || !activeFridgeCategory) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = appData.fridgeItems.filter(i => i.category === activeFridgeCategory);
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
            <div class="stock-controls">
                <button class="stock-btn" onclick="adjustStock(${item.id}, -1)" title="減らす">
                    <span class="material-icons-round">remove</span>
                </button>
                <button class="stock-btn" onclick="adjustStock(${item.id}, 1)" title="増やす">
                    <span class="material-icons-round">add</span>
                </button>
            </div>
            <span class="fridge-item-name">${item.name}</span>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:auto;">
                ${expiryHtml}
                <span class="fridge-item-qty">${item.qty} ${item.unit}</span>
                <span class="material-icons-round" style="font-size:15px; color:var(--text-sub); cursor:pointer; flex-shrink:0;" onclick="editFridgeItem(${item.id})">edit</span>
                <span class="material-icons-round" style="font-size:15px; color:var(--danger-color); cursor:pointer; flex-shrink:0;" onclick="deleteFridgeItem(${item.id})">delete</span>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function formatExpiryLabel(dateStr) {
    const d = parseSafeDate(dateStr);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(d) + "まで";
}

window.adjustStock = function(id, direction) {
    const item = appData.fridgeItems.find(i => i.id === id);
    if (!item) return;
    const step = item.unit === "グラム" ? 10 : 1;
    item.qty = Math.max(0, item.qty + direction * step);
    saveData();
    renderFridgeDetail();
    renderFridge();
};

// ==========================================
// 6b. CLEANING LOG MANAGEMENT
// ==========================================
function renderCleaningCategories() {
    const container = document.getElementById("cleaning-category-list");
    if (!container) return;
    container.innerHTML = "";

    if (appData.cleaningCategories.length === 0) {
        container.innerHTML = `<p class="empty-hint">カテゴリがまだありません。右上の設定からカテゴリを追加してください</p>`;
        return;
    }

    appData.cleaningCategories.forEach(cat => {
        const items = appData.cleaningItems.filter(i => i.category === cat.name);
        const last = items.length ? items.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)) : null;
        const lastLabel = last ? `最終: ${formatCleaningDateTime(last.timestamp)}` : "まだ記録なし";

        const row = document.createElement("div");
        row.className = "category-list-item";
        row.onclick = () => openCleaningDetail(cat.name);
        row.innerHTML = `
            <span class="material-icons-round category-item-icon">${cat.icon}</span>
            <div class="category-item-main">
                <span class="category-item-name">${cat.name}</span>
                <span class="category-item-sub">${lastLabel}</span>
            </div>
            <span class="material-icons-round category-item-chevron">chevron_right</span>
        `;
        container.appendChild(row);
    });
}

// ----- カテゴリ管理（一覧・追加・編集・削除） -----
function renderCleaningCategoryManage() {
    const container = document.getElementById("cleaning-category-manage-list");
    if (!container) return;
    container.innerHTML = "";

    if (appData.cleaningCategories.length === 0) {
        container.innerHTML = `<p class="empty-hint">カテゴリがありません</p>`;
        return;
    }

    appData.cleaningCategories.forEach(cat => {
        const count = appData.cleaningItems.filter(i => i.category === cat.name).length;
        const row = document.createElement("div");
        row.className = "category-list-item category-manage-item";
        row.innerHTML = `
            <span class="material-icons-round category-item-icon">${cat.icon}</span>
            <div class="category-item-main">
                <span class="category-item-name">${cat.name}</span>
                <span class="category-item-sub">${count}件の記録</span>
            </div>
            <div class="entry-actions">
                <span class="material-icons-round entry-icon-btn" onclick="editCleaningCategory(${cat.id})">edit</span>
                <span class="material-icons-round entry-icon-btn danger" onclick="deleteCleaningCategory(${cat.id})">delete</span>
            </div>
        `;
        container.appendChild(row);
    });
}

window.openCleaningCategoryManage = function() {
    renderCleaningCategoryManage();
    const modal = document.getElementById("modal-cleaning-category-manage");
    if (modal) modal.classList.add("open");
};

function renderIconGrid() {
    const grid = document.getElementById("cleaning-category-icon-grid");
    if (!grid) return;
    grid.innerHTML = "";
    CLEANING_ICON_OPTIONS.forEach(icon => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icon-picker-item" + (icon === selectedCategoryIcon ? " selected" : "");
        btn.innerHTML = `<span class="material-icons-round">${icon}</span>`;
        btn.addEventListener("click", () => {
            selectedCategoryIcon = icon;
            grid.querySelectorAll(".icon-picker-item").forEach(el => el.classList.remove("selected"));
            btn.classList.add("selected");
            validateCategoryInput();
        });
        grid.appendChild(btn);
    });
}

function validateCategoryInput() {
    const nameEl = document.getElementById("cleaning-category-name");
    const saveBtn = document.getElementById("btn-save-cleaning-category");
    if (!nameEl || !saveBtn) return;
    const name = nameEl.value.trim();
    saveBtn.disabled = !name || !selectedCategoryIcon;
}

window.openCleaningCategoryEntry = function(categoryId) {
    const editIdEl = document.getElementById("cleaning-category-edit-id");
    const nameEl = document.getElementById("cleaning-category-name");
    const titleEl = document.getElementById("cleaning-category-entry-title");
    const saveBtn = document.getElementById("btn-save-cleaning-category");

    if (categoryId) {
        const cat = appData.cleaningCategories.find(c => c.id === categoryId);
        if (!cat) return;
        if (editIdEl) editIdEl.value = cat.id;
        if (nameEl) nameEl.value = cat.name;
        selectedCategoryIcon = cat.icon;
        if (titleEl) titleEl.innerText = "カテゴリを編集";
        if (saveBtn) saveBtn.innerText = "保存する";
    } else {
        if (editIdEl) editIdEl.value = "";
        if (nameEl) nameEl.value = "";
        selectedCategoryIcon = null;
        if (titleEl) titleEl.innerText = "カテゴリを追加";
        if (saveBtn) saveBtn.innerText = "追加する";
    }

    renderIconGrid();
    validateCategoryInput();
    const modal = document.getElementById("modal-cleaning-category-entry");
    if (modal) modal.classList.add("open");
};

window.editCleaningCategory = function(id) {
    openCleaningCategoryEntry(id);
};

window.deleteCleaningCategory = function(id) {
    const cat = appData.cleaningCategories.find(c => c.id === id);
    if (!cat) return;
    const relatedCount = appData.cleaningItems.filter(i => i.category === cat.name).length;
    const msg = relatedCount > 0
        ? `「${cat.name}」を削除しますか？\nこのカテゴリの記録 ${relatedCount}件 も一緒に削除されます。`
        : `「${cat.name}」を削除しますか？`;
    if (confirm(msg)) {
        appData.cleaningCategories = appData.cleaningCategories.filter(c => c.id !== id);
        appData.cleaningItems = appData.cleaningItems.filter(i => i.category !== cat.name);
        saveData();
        renderCleaningCategories();
        renderCleaningCategoryManage();
    }
};

function formatCleaningDateTime(ts) {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

window.openCleaningDetail = function(category) {
    activeCleaningCategory = category;
    const titleEl = document.getElementById("cleaning-detail-title");
    if (titleEl) titleEl.innerText = category;
    renderCleaningDetail();
    const modal = document.getElementById("modal-cleaning-detail");
    if (modal) modal.classList.add("open");
};

function renderCleaningDetail() {
    const container = document.getElementById("cleaning-detail-timeline");
    if (!container || !activeCleaningCategory) return;
    container.innerHTML = "";

    const items = appData.cleaningItems
        .filter(i => i.category === activeCleaningCategory)
        .sort((a, b) => b.timestamp - a.timestamp);

    if (items.length === 0) {
        container.innerHTML = `<p class="empty-hint">まだ記録がありません</p>`;
        return;
    }

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "entry-row";
        row.innerHTML = `
            <span class="material-icons-round cleaning-entry-icon">task_alt</span>
            <div class="entry-main">
                <div class="entry-top">
                    <span class="entry-title">${item.note ? item.note : "掃除しました"}</span>
                    <span class="entry-amount cleaning-entry-date">${formatCleaningDateTime(item.timestamp)}</span>
                </div>
                <div class="entry-sub">
                    <span class="entry-sub-left"></span>
                    <div class="entry-actions">
                        <span class="material-icons-round entry-icon-btn" onclick="editCleaningItem(${item.id})">edit</span>
                        <span class="material-icons-round entry-icon-btn danger" onclick="deleteCleaningItem(${item.id})">delete</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

window.editCleaningItem = function(id) {
    const item = appData.cleaningItems.find(i => i.id === id);
    if (!item) return;
    const editIdEl = document.getElementById("cleaning-edit-id");
    const noteEl = document.getElementById("cleaning-entry-note");
    const titleEl = document.getElementById("cleaning-entry-modal-title");
    if (editIdEl) editIdEl.value = item.id;
    if (noteEl) noteEl.value = item.note || "";
    if (titleEl) titleEl.innerText = "記録を編集";
    const modal = document.getElementById("modal-cleaning-entry");
    if (modal) modal.classList.add("open");
};

window.deleteCleaningItem = function(id) {
    if (confirm("この記録を削除しますか？")) {
        appData.cleaningItems = appData.cleaningItems.filter(i => i.id !== id);
        saveData();
        renderCleaningDetail();
        renderCleaningCategories();
    }
};

// ダークモード
function initDarkMode() {
    const saved = localStorage.getItem("rakuraku_theme");
    if (saved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        const icon = document.getElementById("dark-mode-icon");
        if (icon) icon.textContent = "light_mode";
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const icon = document.getElementById("dark-mode-icon");
    if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("rakuraku_theme", "light");
        if (icon) icon.textContent = "dark_mode";
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("rakuraku_theme", "dark");
        if (icon) icon.textContent = "light_mode";
    }
}

window.editFridgeItem = function(id) {
    const item = appData.fridgeItems.find(i => i.id === id);
    if (!item) return;
    
    const titleEl = document.getElementById("fridge-modal-title");
    const editIdEl = document.getElementById("fridge-edit-id");
    const nameEl = document.getElementById("fridge-name");
    const qtyEl = document.getElementById("fridge-qty");
    const unitEl = document.getElementById("fridge-unit");
    const expiryEl = document.getElementById("fridge-expiry");
    const modalEl = document.getElementById("modal-fridge-entry");

    if (titleEl) titleEl.innerText = "食材を編集";
    if (editIdEl) editIdEl.value = item.id;
    if (nameEl) nameEl.value = item.name;
    if (qtyEl) qtyEl.value = item.qty;
    if (unitEl) unitEl.value = item.unit;
    if (expiryEl) expiryEl.value = item.expiry || "";
    
    validateFridgeInput();
    if (modalEl) modalEl.classList.add("open");
};

window.deleteFridgeItem = function(id) {
    if (confirm("この食材を削除しますか？")) {
        appData.fridgeItems = appData.fridgeItems.filter(i => i.id !== id);
        saveData();
        renderFridgeDetail();
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
    const container = document.getElementById("history-accordion");
    if (!container) return;
    container.innerHTML = "";

    const settledPayments = appData.payments.filter(p => p.settled);
    if (settledPayments.length === 0) {
        container.innerHTML = `<p class="empty-hint">アーカイブされたデータはありません</p>`;
        return;
    }

    // 精算1回ごとに独立したグループにする（同じ月・同じ日でも混ぜない）。
    // 古いデータ（settlementId未設定）は月をキーにフォールバックする
    const groupsMap = new Map();
    settledPayments.forEach(p => {
        const key = p.settlementId || `month-${p.settledMonth}`;
        if (!groupsMap.has(key)) {
            groupsMap.set(key, { key, settledMonth: p.settledMonth, settledAt: p.settledAt || null, payments: [] });
        }
        groupsMap.get(key).payments.push(p);
    });

    const groups = [...groupsMap.values()];
    groups.sort((a, b) => {
        const aKey = a.settledAt || a.settledMonth;
        const bKey = b.settledAt || b.settledMonth;
        return String(bKey).localeCompare(String(aKey));
    });

    groups.forEach(group => {
        const groupPayments = group.payments.slice().sort((a, b) => b.date.localeCompare(a.date));
        const titleLabel = group.settledAt
            ? `${formatSettledFullDateLabel(group.settledAt)}の精算`
            : `${formatMonthLabel(group.settledMonth)}の精算`;
        const subtitle = `対象: ${formatMonthLabel(group.settledMonth)} ・ ${groupPayments.length}件`;

    const section = document.createElement("div");
        section.className = "accordion-section collapsed";
        section.innerHTML = `
            <div class="accordion-header" onclick="toggleHistorySection(this)">
                <span class="material-icons-round accordion-icon">calendar_month</span>
                <div class="accordion-title-group">
                    <span class="accordion-title">${titleLabel}</span>
                    <span class="accordion-subtitle">${subtitle}</span>
                </div>
                <div class="accordion-header-actions">
                    <span class="material-icons-round accordion-delete-btn" onclick="deleteHistoryGroup(event, '${group.key}')" title="この精算を削除">delete</span>
                    <span class="material-icons-round accordion-chevron">expand_more</span>
                </div>
            </div>
            <div class="accordion-body">
                <div class="timeline">${groupPayments.map(pay => buildHistoryEntryHtml(pay)).join("")}</div>
            </div>
        `;
        container.appendChild(section);
    });
}

function formatSettledAtLabel(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(d);
}

function formatSettledFullDateLabel(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function buildHistoryEntryHtml(pay) {
    const user = appData.users[pay.userId] || { name: "不明" };
    const opponentCost = Math.round(pay.amount * (pay.ratio / 100));
    return `
        <div class="entry-row">
            ${buildAvatarHtml(user)}
            <div class="entry-main">
                <div class="entry-top">
                    <span class="entry-title">${pay.title}</span>
                    <span class="entry-amount">${opponentCost.toLocaleString()} 円</span>
                </div>
                <div class="entry-sub">
                    <span class="entry-sub-left">${formatDateLabel(pay.date)} ・ ${user.name || "ユーザー"}が${pay.amount.toLocaleString()}円を払った${pay.memo ? " ・ " + pay.memo : ""} ・ 相手負担${pay.ratio}%</span>
                </div>
            </div>
        </div>
    `;
}

window.deleteHistoryGroup = function(event, groupKey) {
    event.stopPropagation();
    if (confirm("この精算の履歴データをすべて完全に削除しますか？\nこの操作は取り消せません。")) {
        appData.payments = appData.payments.filter(p => {
            const pKey = String(p.settlementId || `month-${p.settledMonth}`);
            return pKey !== String(groupKey);
        });
        saveData();
        renderArchive();
    }
};

function formatMonthLabel(monthStr) {
    const parts = monthStr.split("-");
    if (parts.length !== 2) return monthStr;
    return `${parts[0]}年${parseInt(parts[1], 10)}月`;
}

window.toggleHistorySection = function(headerEl) {
    const section = headerEl.closest(".accordion-section");
    if (!section) return;
    const body = section.querySelector(".accordion-body");
    if (!body) return;
    const isOpen = body.classList.contains("open");
    body.classList.toggle("open", !isOpen);
    section.classList.toggle("collapsed", isOpen);
};

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
        shoppingRows.push(["やること", s.id, s.text, s.category || "", s.checked ? "1" : "0"]);
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
                } else if (type === "やること" && cols.length >= 5) {
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
                if (confirm(`インポートします。\n支払い: ${payments.length}件、やること: ${shoppingList.length}件、冷蔵庫: ${fridgeItems.length}件\n現在のデータは上書きされます。よろしいですか？`)) {
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
    // Dark Mode Toggle
    const btnDarkMode = document.getElementById("btn-dark-mode");
    if (btnDarkMode) btnDarkMode.addEventListener("click", toggleDarkMode);

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

    // Previous Settlement Collapsible Toggle
    const settlementPreviousHeader = document.getElementById("settlement-previous-header");
    if (settlementPreviousHeader) {
        settlementPreviousHeader.addEventListener("click", toggleSettlementPreviousDetail);
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

    // History Menu (moved out of tab nav into header menu row)
    const btnHistory = document.getElementById("btn-history");
    if (btnHistory) {
        btnHistory.addEventListener("click", () => {
            renderArchive();
            const modalHistory = document.getElementById("modal-history");
            if (modalHistory) modalHistory.classList.add("open");
        });
    }
    const btnCloseHistory = document.getElementById("btn-close-history");
    if (btnCloseHistory) {
        btnCloseHistory.addEventListener("click", () => {
            const modalHistory = document.getElementById("modal-history");
            if (modalHistory) modalHistory.classList.remove("open");
        });
    }
    const btnHistoryCsv = document.getElementById("btn-history-csv");
    if (btnHistoryCsv) {
        btnHistoryCsv.addEventListener("click", () => {
            const csvModal = document.getElementById("modal-csv-management");
            if (csvModal) csvModal.classList.add("open");
        });
    }

    // Cleaning Log UI Listeners
    const btnCloseCleaningDetail = document.getElementById("btn-close-cleaning-detail");
    if (btnCloseCleaningDetail) {
        btnCloseCleaningDetail.addEventListener("click", () => {
            const modal = document.getElementById("modal-cleaning-detail");
            if (modal) modal.classList.remove("open");
        });
    }

    const fabAddCleaningEntry = document.getElementById("fab-add-cleaning-entry");
    if (fabAddCleaningEntry) {
        fabAddCleaningEntry.addEventListener("click", () => {
            const editIdEl = document.getElementById("cleaning-edit-id");
            const noteEl = document.getElementById("cleaning-entry-note");
            const titleEl = document.getElementById("cleaning-entry-modal-title");
            if (editIdEl) editIdEl.value = "";
            if (noteEl) noteEl.value = "";
            if (titleEl) titleEl.innerText = "記録を追加";
            const modal = document.getElementById("modal-cleaning-entry");
            if (modal) modal.classList.add("open");
        });
    }

    const btnCloseCleaningEntry = document.getElementById("btn-close-cleaning-entry");
    if (btnCloseCleaningEntry) {
        btnCloseCleaningEntry.addEventListener("click", () => {
            const modal = document.getElementById("modal-cleaning-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnSaveCleaningEntry = document.getElementById("btn-save-cleaning-entry");
    if (btnSaveCleaningEntry) {
        btnSaveCleaningEntry.addEventListener("click", () => {
            const editId = document.getElementById("cleaning-edit-id").value;
            const note = document.getElementById("cleaning-entry-note").value.trim();

            if (editId) {
                const existing = appData.cleaningItems.find(i => i.id === parseInt(editId));
                if (existing) existing.note = note;
            } else {
                if (!activeCleaningCategory) return;
                appData.cleaningItems.push({
                    id: Date.now(),
                    category: activeCleaningCategory,
                    note,
                    timestamp: Date.now()
                });
            }

            saveData();
            renderCleaningDetail();
            renderCleaningCategories();
            const modal = document.getElementById("modal-cleaning-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    // Cleaning Category Management UI Listeners
    const btnCloseCleaningCategoryManage = document.getElementById("btn-close-cleaning-category-manage");
    if (btnCloseCleaningCategoryManage) {
        btnCloseCleaningCategoryManage.addEventListener("click", () => {
            const modal = document.getElementById("modal-cleaning-category-manage");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnAddCleaningCategory = document.getElementById("btn-add-cleaning-category");
    if (btnAddCleaningCategory) {
        btnAddCleaningCategory.addEventListener("click", () => {
            openCleaningCategoryEntry(null);
        });
    }

    const btnCloseCleaningCategoryEntry = document.getElementById("btn-close-cleaning-category-entry");
    if (btnCloseCleaningCategoryEntry) {
        btnCloseCleaningCategoryEntry.addEventListener("click", () => {
            const modal = document.getElementById("modal-cleaning-category-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    const cleaningCategoryNameInput = document.getElementById("cleaning-category-name");
    if (cleaningCategoryNameInput) cleaningCategoryNameInput.addEventListener("input", validateCategoryInput);

    const btnSaveCleaningCategory = document.getElementById("btn-save-cleaning-category");
    if (btnSaveCleaningCategory) {
        btnSaveCleaningCategory.addEventListener("click", () => {
            const editId = document.getElementById("cleaning-category-edit-id").value;
            const name = document.getElementById("cleaning-category-name").value.trim();
            if (!name || !selectedCategoryIcon) return;

            if (editId) {
                const existing = appData.cleaningCategories.find(c => c.id === parseInt(editId));
                if (existing) {
                    const oldName = existing.name;
                    existing.name = name;
                    existing.icon = selectedCategoryIcon;
                    if (oldName !== name) {
                        appData.cleaningItems.forEach(item => {
                            if (item.category === oldName) item.category = name;
                        });
                        if (activeCleaningCategory === oldName) activeCleaningCategory = name;
                    }
                }
            } else {
                appData.cleaningCategories.push({ id: Date.now(), name, icon: selectedCategoryIcon });
            }

            saveData();
            renderCleaningCategories();
            renderCleaningCategoryManage();
            const modal = document.getElementById("modal-cleaning-category-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    // Profile Settings UI Listeners（掃除タブ表示中は代わりにカテゴリ管理を開く）
    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            const activeTab = document.querySelector(".tab-panel.active");
            if (activeTab && activeTab.id === "tab-cleaning") {
                openCleaningCategoryManage();
                return;
            }
            if (activeTab && activeTab.id === "tab-shopping") {
                openShoppingCategoryManage();
                return;
            }
            switchProfileEditor(1);
            const modalProfile = document.getElementById("modal-profile");
            if (modalProfile) modalProfile.classList.add("open");
        });
    }

    // CSV管理モーダル（精算タブの履歴設定から開く）
    const btnCloseCsvManagement = document.getElementById("btn-close-csv-management");
    if (btnCloseCsvManagement) {
        btnCloseCsvManagement.addEventListener("click", () => {
            const modal = document.getElementById("modal-csv-management");
            if (modal) modal.classList.remove("open");
        });
    }

    // やることカテゴリ管理 UI Listeners
    const btnCloseShoppingCategoryManage = document.getElementById("btn-close-shopping-category-manage");
    if (btnCloseShoppingCategoryManage) {
        btnCloseShoppingCategoryManage.addEventListener("click", () => {
            const modal = document.getElementById("modal-shopping-category-manage");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnAddShoppingCategory = document.getElementById("btn-add-shopping-category");
    if (btnAddShoppingCategory) {
        btnAddShoppingCategory.addEventListener("click", () => openShoppingCategoryEntry(null));
    }

    const btnCloseShoppingCategoryEntry = document.getElementById("btn-close-shopping-category-entry");
    if (btnCloseShoppingCategoryEntry) {
        btnCloseShoppingCategoryEntry.addEventListener("click", () => {
            const modal = document.getElementById("modal-shopping-category-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    const shoppingCategoryNameInput = document.getElementById("shopping-category-name");
    if (shoppingCategoryNameInput) {
        shoppingCategoryNameInput.addEventListener("input", () => {
            const saveBtn = document.getElementById("btn-save-shopping-category");
            if (saveBtn) saveBtn.disabled = !shoppingCategoryNameInput.value.trim();
        });
    }

    const btnSaveShoppingCategory = document.getElementById("btn-save-shopping-category");
    if (btnSaveShoppingCategory) {
        btnSaveShoppingCategory.addEventListener("click", () => {
            const editId = document.getElementById("shopping-category-edit-id").value;
            const name = document.getElementById("shopping-category-name").value.trim();
            if (!name) return;

            if (editId) {
                const existing = appData.shoppingCategories.find(c => c.id === parseInt(editId));
                if (existing) {
                    const oldName = existing.name;
                    existing.name = name;
                    if (oldName !== name) {
                        appData.shoppingList.forEach(item => {
                            if (item.category === oldName) item.category = name;
                        });
                    }
                }
            } else {
                appData.shoppingCategories.push({ id: Date.now(), name });
            }

            saveData();
            renderShoppingCategoryManage();
            renderShoppingCategorySelect();
            renderShoppingList();
            const modal = document.getElementById("modal-shopping-category-entry");
            if (modal) modal.classList.remove("open");
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

    const editPhotoInput = document.getElementById("edit-photo-input");
    if (editPhotoInput) {
        editPhotoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) handlePhotoFile(file, activeEditorUser);
            e.target.value = "";
        });
    }

    const btnRemovePhoto = document.getElementById("btn-remove-photo");
    if (btnRemovePhoto) {
        btnRemovePhoto.addEventListener("click", () => {
            if (activeEditorUser !== 1 && activeEditorUser !== 2) return;
            appData.users[activeEditorUser].photo = null;
            updateAvatarPreview(activeEditorUser);
        });
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
            const expiryEl = document.getElementById("fridge-expiry");
            const modalFridge = document.getElementById("modal-fridge-entry");

            if (titleEl) titleEl.innerText = "食材を追加";
            if (editIdEl) editIdEl.value = "";
            if (nameEl) nameEl.value = "";
            if (qtyEl) qtyEl.value = "";
            if (unitEl) unitEl.value = "個";
            if (expiryEl) expiryEl.value = "";
            
            validateFridgeInput();
            if (modalFridge) modalFridge.classList.add("open");
        });
    }

    const btnCloseFridgeDetail = document.getElementById("btn-close-fridge-detail");
    if (btnCloseFridgeDetail) {
        btnCloseFridgeDetail.addEventListener("click", () => {
            const modal = document.getElementById("modal-fridge-detail");
            if (modal) modal.classList.remove("open");
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
            const expiry = document.getElementById("fridge-expiry").value || "";

            if (editId) {
                const existing = appData.fridgeItems.find(i => i.id === parseInt(editId));
                if (existing) { existing.name = name; existing.qty = qty; existing.unit = unit; existing.expiry = expiry; }
            } else {
                const category = activeFridgeCategory || "冷蔵室";
                appData.fridgeItems.push({ id: Date.now(), name, qty, unit, category, expiry });
            }

            saveData();
            renderFridge();
            renderFridgeDetail();
            const modalFridge = document.getElementById("modal-fridge-entry");
            if (modalFridge) modalFridge.classList.remove("open");
        });
    }

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

window.updateShoppingCategory = function(id, category) {
    const item = appData.shoppingList.find(i => i.id === id);
    if (item) item.category = category;
    saveData();
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

    if (appData.isNewAccount) {
        if (titleEl) titleEl.innerText = type === 1 ? "ようこそ！" : "もう一人のプロフィール";
        if (subtitleEl) subtitleEl.innerText = type === 1
            ? "あなたの名前と写真を設定してください"
            : "次に、もう一人の名前と写真を設定してください";
        if (progressFill) progressFill.style.width = type === 1 ? "50%" : "100%";
        if (saveBtn) saveBtn.innerText = type === 1 ? "次へ" : "はじめる";
    } else {
        if (titleEl) titleEl.innerText = "プロフィールの編集";
        if (saveBtn) saveBtn.innerText = "保存して閉じる";
    }

    const editNameInput = document.getElementById("edit-name");
    if (editNameInput) editNameInput.value = appData.users[type].name;
    updateAvatarPreview(type);
};

function updateAvatarPreview(type) {
    if (type !== 1 && type !== 2) return;
    const preview = document.getElementById("user-avatar-preview");
    const btnRemove = document.getElementById("btn-remove-photo");
    if (!preview) return;

    const user = appData.users[type];
    const nameInput = document.getElementById("edit-name");
    const nameVal = nameInput ? nameInput.value.trim() : "";

    if (user.photo) {
        preview.innerHTML = `<img src="${user.photo}" alt="">`;
        preview.classList.add("has-photo");
        if (btnRemove) btnRemove.style.display = "inline-block";
    } else {
        preview.innerHTML = nameVal ? nameVal.charAt(0).toUpperCase() : "?";
        preview.classList.remove("has-photo");
        if (btnRemove) btnRemove.style.display = "none";
    }
}

// 選択した画像をリサイズ・圧縮して base64 として保存
function handlePhotoFile(file, type) {
    if (!file || (type !== 1 && type !== 2)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const maxSize = 240;
            let w = img.width, h = img.height;
            if (w > h) {
                if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
            } else {
                if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            appData.users[type].photo = dataUrl;
            updateAvatarPreview(type);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
