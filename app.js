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
    mealLogs: [], // 飲食日記 [{id, date, time, memo, type}]
    shoppingCategories: [],
    confirmations: { 1: false, 2: false },
    currentOperator: 1,
    isNewAccount: true,
    lastSettlement: null,
    shiftsData: {},
    tabConfig: null, // set to default via TAB_DEFINITIONS on init
    partialPayments: {}, // monthKey ("YYYY-MM") -> [{id, amount, date}]
    monthlyConfirmations: {}, // monthKey -> {1:false, 2:false}
    fontChoice: "zenmaru",
    fontSizeChoice: "m", // 激小=xs, 小=s, 普通=m, 大きい=l
    collapsedShoppingCategories: [] // 折りたたんだ（非表示にした）やることカテゴリの名前一覧
};

// タブの定義（アイコン・ラベル）。表示・非表示・並び順は appData.tabConfig で管理
const TAB_DEFINITIONS = [
    { id: "tab-payment", icon: "account_balance_wallet", label: "支払い" },
    { id: "tab-shopping", icon: "edit_note", label: "やること" },
    { id: "tab-settlement", icon: "receipt_long", label: "精算" },
    { id: "tab-fridge", icon: "kitchen", label: "冷蔵庫" },
    { id: "tab-cleaning", icon: "cleaning_services", label: "掃除" },
    { id: "tab-shift", icon: "event", label: "シフト" },
    { id: "tab-meal", icon: "restaurant", label: "飲食日記" }
];

// フォント選択肢（先頭の選択肢が既定。保存済みの選択が存在しない場合は先頭に切り替わる）
const FONT_OPTIONS = [
    { key: "zenmaru", label: "Zen Maru Gothic", stack: "'Zen Maru Gothic', sans-serif" },
    { key: "mplusrounded", label: "M PLUS Rounded 1c", stack: "'M PLUS Rounded 1c', sans-serif" },
    { key: "kosugimaru", label: "Kosugi Maru", stack: "'Kosugi Maru', sans-serif" }
];

// 文字サイズ選択肢（html のルート font-size を変えることで rem 単位の文字がすべて連動して拡縮する）
const FONT_SIZE_OPTIONS = [
    { key: "xs", label: "激小", scale: 0.85 },
    { key: "s", label: "小", scale: 0.925 },
    { key: "m", label: "普通", scale: 1 },
    { key: "l", label: "大きい", scale: 1.15 }
];

let appData = JSON.parse(localStorage.getItem("rakuraku_domo_data")) || JSON.parse(JSON.stringify(DEFAULT_DATA));

// 保存済みのフォント選択が削除済み（存在しない）の場合は、残っている先頭の選択肢へ自動で切り替える
function normalizeFontChoice() {
    if (!FONT_OPTIONS.some(f => f.key === appData.fontChoice)) {
        appData.fontChoice = FONT_OPTIONS[0].key;
    }
}

// Ensure fridge collection is safe
if (!appData.fridgeItems) appData.fridgeItems = [];
if (!appData.cleaningItems) appData.cleaningItems = [];
if (!appData.mealLogs) appData.mealLogs = [];
if (!appData.cleaningCategories) appData.cleaningCategories = getDefaultCleaningCategories();
if (!appData.shoppingCategories || appData.shoppingCategories.length === 0) appData.shoppingCategories = getDefaultShoppingCategories();
if (!("lastSettlement" in appData)) appData.lastSettlement = null;
if (!appData.shiftsData) appData.shiftsData = {};
if (!appData.partialPayments) appData.partialPayments = {};
if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};
if (!appData.fontChoice) appData.fontChoice = "zenmaru";
normalizeFontChoice();
if (!appData.fontSizeChoice) appData.fontSizeChoice = "m";
if (!appData.collapsedShoppingCategories) appData.collapsedShoppingCategories = [];

// 旧バージョン（単一の精算確認）を「今月の精算ボックス」の確認状態へ移行
if (appData.confirmations && (appData.confirmations[1] || appData.confirmations[2])) {
    const cm = getCurrentMonthStr();
    if (!appData.monthlyConfirmations[cm]) {
        appData.monthlyConfirmations[cm] = { 1: !!appData.confirmations[1], 2: !!appData.confirmations[2] };
    }
}

// 旧バージョン（アカウント制）のシフトデータをユーザー1/2ベースに移行
if (appData.shiftAccounts && appData.shiftAccounts.length > 0) {
    const migrated = { 1: {}, 2: {} };
    appData.shiftAccounts.forEach((acc, i) => {
        const uid = i === 0 ? 1 : 2;
        if (appData.shiftsData[acc.name]) {
            Object.assign(migrated[uid], appData.shiftsData[acc.name]);
        }
    });
    // 既に新形式（数値キー）のデータがあれば保持
    [1, 2].forEach(uid => {
        if (appData.shiftsData[uid]) Object.assign(migrated[uid], appData.shiftsData[uid]);
    });
    appData.shiftsData = migrated;
    delete appData.shiftAccounts;
    delete appData.shiftCurrentAccount;
}

// ユーザーごとに分かれていたシフトデータを、ユーザーA/Bで共有する1つのカレンダーに統合する
// （appData.shiftsData がユーザーIDキー(1/2)を持っている＝旧形式の場合のみ実行。
//   統合後は日付キー（YYYY-MM-DD）のみになるため、この分岐は自動的に通らなくなる）
if (appData.shiftsData && (appData.shiftsData[1] || appData.shiftsData[2])) {
    const mergedShared = {};
    [1, 2].forEach(uid => {
        const userShifts = appData.shiftsData[uid] || {};
        Object.keys(userShifts).forEach(dateStr => {
            if (!mergedShared[dateStr]) mergedShared[dateStr] = [];
            (userShifts[dateStr] || []).forEach(s => {
                mergedShared[dateStr].push({
                    id: s.id || generateShiftId(),
                    title: s.title || "",
                    start: s.start,
                    end: s.end,
                    userId: s.userId || uid
                });
            });
        });
    });
    appData.shiftsData = mergedShared;
}
if (!appData.shiftsData) appData.shiftsData = {};

// タブ表示設定の初期化・移行
if (!appData.tabConfig || !Array.isArray(appData.tabConfig) || appData.tabConfig.length === 0) {
    appData.tabConfig = TAB_DEFINITIONS.map(t => ({ id: t.id, visible: true }));
} else {
    const knownIds = TAB_DEFINITIONS.map(t => t.id);
    appData.tabConfig = appData.tabConfig.filter(t => knownIds.includes(t.id));
    knownIds.forEach(id => {
        if (!appData.tabConfig.find(t => t.id === id)) appData.tabConfig.push({ id, visible: true });
    });
    if (!appData.tabConfig.some(t => t.visible)) appData.tabConfig[0].visible = true;
}

let activeEditorUser = 1;
let duplicateOwnerId = null; // 複製した支払いの記録者（保存時にそのまま引き継ぐ）
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

// 折りたたんだ（非表示にした）やることカテゴリを appData に永続化する
let collapsedShoppingCategories = new Set(appData.collapsedShoppingCategories || []);

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


// ==========================================
// 0. 共通ダイアログ（確認・お知らせ）
// ブラウザ標準の confirm / alert の代わりに、アプリの雰囲気に合わせた
// シンプルなウィンドウを表示する。すべての確認・通知はここを通る。
// ==========================================
let appDialogEl = null;

function ensureAppDialog() {
    if (appDialogEl) return appDialogEl;
    const host = document.querySelector(".app-container") || document.body;
    appDialogEl = document.createElement("div");
    appDialogEl.className = "app-dialog-overlay";
    appDialogEl.innerHTML = `
        <div class="app-dialog" role="alertdialog" aria-modal="true">
            <h3 class="app-dialog-title"></h3>
            <ul class="app-dialog-lines"></ul>
            <button type="button" class="app-dialog-btn app-dialog-btn-confirm"></button>
            <button type="button" class="app-dialog-btn app-dialog-btn-cancel"></button>
        </div>
    `;
    host.appendChild(appDialogEl);
    return appDialogEl;
}

// opts: { title, lines:[{icon,text}], message, icon, confirmText, cancelText, danger, hideCancel } → Promise<boolean>
//   lines: タイトルの下に「アイコン＋説明」の行を並べる（message のみ渡した場合は icon を1行目に使う）
window.showDialog = function(opts) {
    const o = opts || {};
    return new Promise(resolve => {
        const el = ensureAppDialog();
        const card = el.querySelector(".app-dialog");
        const btnCancel = el.querySelector(".app-dialog-btn-cancel");
        const btnConfirm = el.querySelector(".app-dialog-btn-confirm");
        const linesEl = el.querySelector(".app-dialog-lines");

        let lines = Array.isArray(o.lines) ? o.lines.slice() : [];
        if (lines.length === 0 && o.message) {
            String(o.message).split("\n").forEach((t, i) => {
                if (t.trim()) lines.push({ icon: i === 0 ? (o.icon || "info") : "", text: t });
            });
        }
        linesEl.innerHTML = lines.map(l => `
            <li>
                <span class="material-icons-round">${escapeHtml(l.icon || "")}</span>
                <span>${escapeHtml(l.text)}</span>
            </li>
        `).join("");
        linesEl.style.display = lines.length ? "" : "none";

        el.querySelector(".app-dialog-title").textContent = o.title || "";
        card.classList.toggle("danger", !!o.danger);
        card.classList.toggle("notice", !!o.hideCancel);
        btnCancel.textContent = o.cancelText || "キャンセル";
        btnConfirm.textContent = o.confirmText || "OK";
        btnCancel.style.display = o.hideCancel ? "none" : "";

        const finish = (result) => {
            el.classList.remove("open");
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
            el.onclick = null;
            resolve(result);
        };
        btnCancel.onclick = () => finish(false);
        btnConfirm.onclick = () => finish(true);
        // お知らせは背景タップでも閉じられる。確認は誤操作防止のため閉じない
        el.onclick = (e) => { if (e.target === el && o.hideCancel) finish(true); };

        void el.offsetWidth;
        el.classList.add("open");
    });
};

window.showConfirm = function(opts) { return window.showDialog(opts); };

window.showNotice = function(opts) {
    return window.showDialog(Object.assign({ hideCancel: true, confirmText: "OK" }, opts || {}));
};

// 削除確認：title＝「◯◯を削除しますか？」、lines＝内容の説明。最後に必ず「元に戻せません」の行を付ける
function confirmDelete(title, lines, opts) {
    const rows = (lines || []).slice();
    rows.push({ icon: "block", text: "元に戻せません" });
    return window.showDialog({
        title: title,
        lines: rows,
        confirmText: (opts && opts.confirmText) || "削除する",
        cancelText: "キャンセル",
        danger: true
    });
}

// 旧 alert の置き換え
function notify(message) {
    const done = /(完了|一括登録しました)/.test(String(message));
    return window.showNotice({
        icon: done ? "check_circle" : "info",
        title: done ? "完了しました" : "お知らせ",
        message: String(message)
    });
}

// ==========================================
// 0b. 入力中に「閉じる」を押したときの確認
// 追加・編集ウィンドウを開いた時点の入力内容を覚えておき、
// 内容が変わっている場合だけ「破棄しますか？」と確認する。
// ==========================================
const GUARDED_MODALS = [
    ["modal-payment-entry", "btn-close-payment"],
    ["modal-shopping-item-entry", "btn-close-shopping-item"],
    ["modal-partial-payment", "btn-close-partial-payment"],
    ["modal-cleaning-entry", "btn-close-cleaning-entry"],
    ["modal-cleaning-category-entry", "btn-close-cleaning-category-entry"],
    ["modal-shopping-category-entry", "btn-close-shopping-category-entry"],
    ["modal-fridge-entry", "btn-close-fridge"],
    ["modal-shift-entry", "btn-close-shift-entry"],
    ["modal-shift-bulk", "btn-close-shift-bulk"],
    ["modal-meal-entry", "btn-close-meal-entry"]
];

function snapshotModal(modal) {
    const fields = Array.from(modal.querySelectorAll("input, select, textarea"))
        .filter(el => el.type !== "file")
        .map(el => (el.type === "checkbox" ? String(el.checked) : el.value));
    if (modal.id === "modal-cleaning-category-entry") fields.push(String(selectedCategoryIcon));
    return fields.join("\u0001");
}

function initCloseGuards() {
    GUARDED_MODALS.forEach(([modalId, closeBtnId]) => {
        const modal = document.getElementById(modalId);
        const btn = document.getElementById(closeBtnId);
        if (!modal || !btn) return;

        let snap = null;
        new MutationObserver(() => {
            if (modal.classList.contains("open")) {
                if (snap === null) snap = snapshotModal(modal);
            } else {
                snap = null;
            }
        }).observe(modal, { attributes: true, attributeFilter: ["class"] });

        // 他の「閉じる」処理より先に登録し、変更がある場合は確認が済むまで止める
        btn.addEventListener("click", async (e) => {
            if (snap === null || snapshotModal(modal) === snap) return;
            e.stopImmediatePropagation();
            const ok = await window.showDialog({
                title: "入力内容を破棄しますか？",
                lines: [
                    { icon: "edit_note", text: "保存されていない内容があります。" },
                    { icon: "block", text: "破棄すると元に戻せません" }
                ],
                danger: true,
                confirmText: "破棄して閉じる",
                cancelText: "編集を続ける"
            });
            if (ok) {
                snap = null;
                modal.classList.remove("open");
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initFont();
    initFontSize();
    initTheme();
    initDarkMode();
    initApp();
    setupEventListeners();
});

function initApp() {
    saveData();
    renderNav();
    renderUserSelectors();
    renderTimeline();
    renderShoppingCategorySelect();
    renderShoppingList();
    renderSettlement();
    renderFridge();
    renderArchive();
    renderCleaningCategories();
    renderShiftTab();
    renderMealTab();

    const container = document.querySelector(".app-container");
    if (!container) return; // Prevent crash if container structure is missing

    const isBrandNewSession = appData.isNewAccount || !appData.users[1].name || !appData.users[2].name;

    if (isBrandNewSession) {
        appData.isNewAccount = true;
        container.classList.add("onboarding-mode");
        if (activeEditorUser !== 1 && activeEditorUser !== 2) activeEditorUser = 1;
        switchProfileEditor(activeEditorUser);

        const modalProfile = document.getElementById("modal-profile");
        if (modalProfile) {
            modalProfile.classList.remove("fullpage");
            modalProfile.classList.add("open");
        }
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
// 1a. 共通ユーティリティ（エスケープ / ドラッグ並べ替え）
// ==========================================
function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 渡された id 配列の順番に合わせて配列を並べ替える（未知の要素は末尾に残す）
function reorderByIds(list, ids, getId) {
    const map = new Map(list.map(item => [String(getId(item)), item]));
    const next = [];
    ids.forEach(id => {
        const key = String(id);
        if (map.has(key)) {
            next.push(map.get(key));
            map.delete(key);
        }
    });
    map.forEach(item => next.push(item));
    return next;
}

// リストの行をドラッグ＆ドロップで並べ替えできるようにする（タッチ／マウス両対応）
// 対象は container 内の [data-drag-id] を持つ行。行内の .drag-handle を掴んで動かす。
function enableDragReorder(container, onReorder) {
    if (!container || container.dataset.dragBound === "1") return;
    container.dataset.dragBound = "1";

    let dragEl = null;
    let handleEl = null;
    let activePointerId = null;
    let startY = 0;
    let moved = false;

    const getRows = () => Array.from(container.querySelectorAll("[data-drag-id]"));

    function onPointerMove(e) {
        if (!dragEl || (activePointerId !== null && e.pointerId !== activePointerId)) return;
        if (e.cancelable) e.preventDefault();

        const offset = e.clientY - startY;
        if (!moved && Math.abs(offset) < 3) return;
        moved = true;
        dragEl.style.transform = `translateY(${offset}px)`;

        // 指を速く動かした（イベントがまとめられた）場合も一気に正しい位置まで入れ替える
        let swapped = true;
        let guard = 0;
        while (swapped && guard++ < 60) {
            swapped = false;

            const rows = getRows();
            const dragRect = dragEl.getBoundingClientRect();
            const dragMid = dragRect.top + dragRect.height / 2;
            const dragIdx = rows.indexOf(dragEl);

            for (let i = 0; i < rows.length; i++) {
                const other = rows[i];
                if (other === dragEl) continue;

                const otherRect = other.getBoundingClientRect();
                const otherMid = otherRect.top + otherRect.height / 2;
                const shouldSwap = (i < dragIdx && dragMid < otherMid) || (i > dragIdx && dragMid > otherMid);
                if (!shouldSwap) continue;

                const dragBefore = dragRect.top;
                const otherBefore = otherRect.top;

                if (i < dragIdx) container.insertBefore(dragEl, other);
                else container.insertBefore(dragEl, other.nextSibling);

                // 並びが変わってもドラッグ中の行が指（カーソル）に追従するよう基準位置を補正
                const dragAfter = dragEl.getBoundingClientRect().top;
                startY += (dragAfter - dragBefore);
                dragEl.style.transform = `translateY(${e.clientY - startY}px)`;

                // 押しのけられた行はスッと移動させる
                const otherAfter = other.getBoundingClientRect().top;
                other.style.transition = "none";
                other.style.transform = `translateY(${otherBefore - otherAfter}px)`;
                requestAnimationFrame(() => {
                    other.style.transition = "transform 0.18s ease";
                    other.style.transform = "";
                });

                swapped = true;
                break;
            }
        }
    }

    function cleanUp() {
        if (!dragEl) return null;

        const rows = getRows();
        rows.forEach(r => {
            r.style.transition = "";
            r.style.transform = "";
        });
        dragEl.classList.remove("drag-active");
        container.classList.remove("drag-sorting");

        if (handleEl) {
            try {
                if (activePointerId !== null && handleEl.releasePointerCapture && handleEl.hasPointerCapture && handleEl.hasPointerCapture(activePointerId)) {
                    handleEl.releasePointerCapture(activePointerId);
                }
            } catch (err) { /* noop */ }
        }
        // 行をDOM上で移動させるとポインターキャプチャが外れることがあるため、
        // 追従イベントは window で受け取る
        window.removeEventListener("pointermove", onPointerMove, true);
        window.removeEventListener("pointerup", onPointerEnd, true);
        window.removeEventListener("pointercancel", onPointerAbort, true);

        const didMove = moved;
        dragEl = null;
        handleEl = null;
        activePointerId = null;
        moved = false;

        return didMove ? rows.map(r => r.getAttribute("data-drag-id")) : null;
    }

    function onPointerEnd(e) {
        if (activePointerId !== null && e && e.pointerId !== activePointerId) return;
        const order = cleanUp();
        if (order && typeof onReorder === "function") onReorder(order);
    }

    function onPointerAbort(e) {
        if (activePointerId !== null && e && e.pointerId !== activePointerId) return;
        cleanUp();
    }

    container.addEventListener("pointerdown", (e) => {
        if (dragEl) return;
        const handle = e.target.closest ? e.target.closest(".drag-handle") : null;
        if (!handle || !container.contains(handle)) return;
        const row = handle.closest("[data-drag-id]");
        if (!row) return;

        if (e.cancelable) e.preventDefault();

        dragEl = row;
        handleEl = handle;
        activePointerId = e.pointerId;
        startY = e.clientY;
        moved = false;

        dragEl.style.transition = "none";
        dragEl.classList.add("drag-active");
        container.classList.add("drag-sorting");

        try {
            if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
        } catch (err) { /* noop */ }

        window.addEventListener("pointermove", onPointerMove, true);
        window.addEventListener("pointerup", onPointerEnd, true);
        window.addEventListener("pointercancel", onPointerAbort, true);
    });
}

// ==========================================
// 1b. TAB VISIBILITY & ORDER MANAGEMENT
// ==========================================
function renderNav() {
    const nav = document.getElementById("app-nav");
    if (!nav) return;

    const visibleTabs = appData.tabConfig.filter(t => t.visible);

    nav.innerHTML = visibleTabs.map(t => {
        const def = TAB_DEFINITIONS.find(d => d.id === t.id);
        if (!def) return "";
        return `
            <button class="nav-item" data-tab="${def.id}">
                <span class="material-icons-round">${def.icon}</span>
                <span>${def.label}</span>
            </button>
        `;
    }).join("");

    // 初回表示時、または現在アクティブなタブが非表示になった場合は
    // 「タブの表示設定」で一番上に並べたタブを開く
    const currentActivePanel = document.querySelector(".tab-panel.active");
    let activeId = currentActivePanel ? currentActivePanel.id : null;
    if (!activeId || !visibleTabs.find(t => t.id === activeId)) {
        activeId = visibleTabs.length > 0 ? visibleTabs[0].id : null;
    }

    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === activeId));

    nav.querySelectorAll(".nav-item").forEach(btn => {
        const targetTab = btn.getAttribute("data-tab");
        btn.classList.toggle("active", targetTab === activeId);
        btn.addEventListener("click", (e) => {
            const tabId = e.currentTarget.getAttribute("data-tab");
            nav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            const targetPanel = document.getElementById(tabId);
            if (targetPanel) targetPanel.classList.add("active");
            if (tabId === "tab-shift") renderShiftTab();
            if (tabId === "tab-meal") renderMealTab();
        });
    });

    if (activeId === "tab-shift") renderShiftTab();
    if (activeId === "tab-meal") renderMealTab();
}

function renderTabSettingsList() {
    const container = document.getElementById("tab-settings-list");
    if (!container) return;
    container.innerHTML = "";

    const visibleCount = appData.tabConfig.filter(t => t.visible).length;

    appData.tabConfig.forEach((t) => {
        const def = TAB_DEFINITIONS.find(d => d.id === t.id);
        if (!def) return;
        const lockToggle = t.visible && visibleCount === 1;

        const row = document.createElement("div");
        row.className = "category-list-item category-manage-item" + (t.visible ? "" : " tab-settings-item-disabled");
        row.setAttribute("data-drag-id", t.id);
        row.innerHTML = `
            <span class="material-icons-round drag-handle" title="ドラッグして並べ替え">drag_indicator</span>
            <span class="material-icons-round category-item-icon">${def.icon}</span>
            <div class="category-item-main">
                <span class="category-item-name">${def.label}</span>
            </div>
            <div class="entry-actions" style="align-items:center;">
                <label class="tab-toggle-switch">
                    <input type="checkbox" ${t.visible ? "checked" : ""} ${lockToggle ? "disabled" : ""} onchange="toggleTabVisible('${t.id}', this.checked)">
                    <span class="tab-toggle-slider"></span>
                </label>
            </div>
        `;
        container.appendChild(row);
    });

    enableDragReorder(container, (ids) => {
        appData.tabConfig = reorderByIds(appData.tabConfig, ids, t => t.id);
        saveData();
        renderTabSettingsList();
        renderNav();
    });
}

window.toggleTabVisible = function(id, visible) {
    const visibleCount = appData.tabConfig.filter(t => t.visible).length;
    if (!visible && visibleCount <= 1) {
        notify("最低1つのタブを表示する必要があります");
        renderTabSettingsList();
        return;
    }
    const t = appData.tabConfig.find(t => t.id === id);
    if (t) t.visible = visible;
    saveData();
    renderTabSettingsList();
    renderNav();
};

// ==========================================
// 2. USER SELECTOR MANAGEMENT
// ==========================================
function userAvatarInner(uid) {
    const u = appData.users[uid] || {};
    if (u.photo) return { html: `<img src="${u.photo}" alt="">`, photo: true };
    const name = (u.name || `ユーザー${uid}`).trim();
    return { html: escapeHtml(name.charAt(0).toUpperCase()), photo: false };
}

function renderUserSelectors() {
    const avatar = document.getElementById("user-switch-avatar");
    if (avatar) {
        const a = userAvatarInner(appData.currentOperator);
        avatar.innerHTML = a.html;
        avatar.classList.toggle("has-photo", a.photo);
    }
    const btn = document.getElementById("btn-user-switch");
    if (btn) {
        const n = appData.users[appData.currentOperator].name || `ユーザー${appData.currentOperator}`;
        btn.title = `${n} として操作中（タップで切り替え）`;
    }
    renderUserSwitchList();
}

function renderUserSwitchList() {
    const list = document.getElementById("user-switch-list");
    if (!list) return;
    list.innerHTML = [1, 2].map(uid => {
        const name = appData.users[uid].name || `ユーザー${uid}`;
        const a = userAvatarInner(uid);
        const cur = appData.currentOperator === uid;
        return `
            <button type="button" class="user-switch-item${cur ? " current" : ""}" data-user="${uid}">
                <span class="user-switch-item-avatar${a.photo ? " has-photo" : ""}">${a.html}</span>
                <span class="user-switch-item-text">
                    <span class="user-switch-item-name">${escapeHtml(name)}</span>
                    <span class="user-switch-item-sub">${cur ? "操作中" : "このユーザーに切り替える"}</span>
                </span>
                <span class="material-icons-round user-switch-item-check">${cur ? "check_circle" : "radio_button_unchecked"}</span>
            </button>`;
    }).join("");
    list.querySelectorAll(".user-switch-item").forEach(el => {
        el.addEventListener("click", () => {
            setOperator(parseInt(el.getAttribute("data-user")));
            closeUserSwitch();
        });
    });
}

function openUserSwitch() {
    renderUserSwitchList();
    const ov = document.getElementById("user-switch-overlay");
    if (ov) ov.classList.add("open");
}

function closeUserSwitch() {
    const ov = document.getElementById("user-switch-overlay");
    if (ov) ov.classList.remove("open");
}

// 操作ユーザーの切り替え（シフトタブ表示中ならそのユーザーのシフトに切り替える）
function setOperator(uid) {
    if (uid !== 1 && uid !== 2) return;
    appData.currentOperator = uid;
    saveData();
    renderUserSelectors();
    renderSettlement();
    const activeTab = document.querySelector(".tab-panel.active");
    if (activeTab && activeTab.id === "tab-shift") renderShiftTab();
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
        row.className = "entry-row entry-row-clickable";
        row.onclick = () => editPayment(pay.id);
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
                        <span class="material-icons-round entry-icon-btn" title="記録者を入れ替え" onclick="event.stopPropagation(); changePaymentOwner(${pay.id})">swap_horiz</span>
                        <span class="material-icons-round entry-icon-btn" title="複製" onclick="event.stopPropagation(); duplicatePayment(${pay.id})">content_copy</span>
                        <span class="material-icons-round entry-icon-btn danger" title="削除" onclick="event.stopPropagation(); deletePayment(${pay.id})">delete</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

// 過去の支払い（精算済みも含む）の項目名を、重複なし・新しい順で返す
function getPaymentTitleSuggestions() {
    const sorted = (appData.payments || []).slice().sort((a, b) => {
        const ad = a.date || "", bd = b.date || "";
        if (ad !== bd) return bd.localeCompare(ad);
        return (b.id || 0) - (a.id || 0);
    });
    const seen = new Set();
    const titles = [];
    sorted.forEach(p => {
        const t = String(p.title || "").trim();
        if (t && !seen.has(t)) {
            seen.add(t);
            titles.push(t);
        }
    });
    return titles;
}

// 項目・内訳の入力候補（datalist）を最新の履歴で作り直す
function renderPaymentTitleSuggestions() {
    const list = document.getElementById("pay-title-suggestions");
    if (!list) return;
    list.innerHTML = getPaymentTitleSuggestions()
        .map(t => `<option value="${escapeHtml(t)}"></option>`)
        .join("");
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
    const options = appData.shoppingCategories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
    ["shopping-category"].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = options;
        if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
    });
}

function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    // 終了済みがないときは「終了済みを削除」を無効（色を変える）にする
    const clearBtn = document.getElementById("btn-clear-checked");
    if (clearBtn) clearBtn.disabled = !appData.shoppingList.some(i => i.checked);

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
                <span>${escapeHtml(catName)}</span>
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
                <span class="shopping-item-text">${escapeHtml(item.text)}</span>
            </div>
            <div class="shopping-item-actions">
                <span class="material-icons-round shopping-item-edit" title="編集" onclick="editShoppingItem(${item.id})">edit</span>
            </div>
        </div>
    `;
}

// カテゴリの表示・非表示（折りたたみ）を切り替える。次回起動時も状態が保たれるよう appData に保存する
window.toggleShoppingCategory = function(catName) {
    if (collapsedShoppingCategories.has(catName)) collapsedShoppingCategories.delete(catName);
    else collapsedShoppingCategories.add(catName);
    appData.collapsedShoppingCategories = Array.from(collapsedShoppingCategories);
    saveData();
    renderShoppingList();
};

// ----- やることの編集 -----
function validateShoppingItemInput() {
    const textEl = document.getElementById("shopping-item-edit-text");
    const saveBtn = document.getElementById("btn-save-shopping-item");
    if (!textEl || !saveBtn) return;
    saveBtn.disabled = !textEl.value.trim();
}

window.editShoppingItem = function(id) {
    const item = appData.shoppingList.find(i => i.id === id);
    if (!item) return;

    renderShoppingCategorySelect();

    const editIdEl = document.getElementById("shopping-item-edit-id");
    const textEl = document.getElementById("shopping-item-edit-text");
    const catEl = document.getElementById("shopping-item-edit-category");

    if (editIdEl) editIdEl.value = item.id;
    if (textEl) textEl.value = item.text;
    if (catEl) catEl.value = item.category || "";

    validateShoppingItemInput();
    const modal = document.getElementById("modal-shopping-item-entry");
    if (modal) modal.classList.add("open");
};

function saveShoppingItemEdit() {
    const editIdEl = document.getElementById("shopping-item-edit-id");
    const textEl = document.getElementById("shopping-item-edit-text");
    const catEl = document.getElementById("shopping-item-edit-category");
    if (!editIdEl || !textEl) return;

    const id = parseInt(editIdEl.value);
    const text = textEl.value.trim();
    if (!id || !text) return;

    const item = appData.shoppingList.find(i => i.id === id);
    if (item) {
        item.text = text;
        if (catEl && catEl.value) item.category = catEl.value;
    }

    saveData();
    renderShoppingList();
    const modal = document.getElementById("modal-shopping-item-entry");
    if (modal) modal.classList.remove("open");
}

// カテゴリ選択ページ（タップで即選択）
function openShoppingCategoryPicker() {
    const catEl = document.getElementById("shopping-item-edit-category");
    const list = document.getElementById("shopping-cat-chip-list");
    if (!catEl || !list) return;
    const current = catEl.value;
    const names = appData.shoppingCategories.map(c => c.name);
    // 削除済みカテゴリに属していても、現在の値は選べるようにする
    if (current && !names.includes(current)) names.push(current);

    list.innerHTML = names.length
        ? names.map(n => `<button type="button" class="title-chip${n === current ? " selected" : ""}" data-cat="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("")
        : '<p class="title-chip-empty">カテゴリがありません</p>';

    list.querySelectorAll(".title-chip").forEach(c => {
        c.addEventListener("click", () => {
            catEl.value = c.getAttribute("data-cat");
            catEl.dispatchEvent(new Event("input", { bubbles: true }));
            document.getElementById("modal-shopping-cat-picker").classList.remove("open");
        });
    });
    document.getElementById("modal-shopping-cat-picker").classList.add("open");
    const body = document.querySelector("#modal-shopping-cat-picker .modal-body");
    if (body) body.scrollTop = 0;
}

async function deleteShoppingItemFromEditor() {
    const id = parseInt(document.getElementById("shopping-item-edit-id").value);
    const item = appData.shoppingList.find(i => i.id === id);
    if (!item) return;
    const ok = await confirmDelete("このエントリを削除しますか？", [
        { icon: "delete_outline", text: `「${item.text}」をやることリストから削除します。` }
    ]);
    if (!ok) return;
    appData.shoppingList = appData.shoppingList.filter(i => i.id !== id);
    saveData();
    renderShoppingList();
    const modal = document.getElementById("modal-shopping-item-entry");
    if (modal) modal.classList.remove("open");
}

async function clearCheckedShoppingItems() {
    const count = appData.shoppingList.filter(i => i.checked).length;
    if (count === 0) return;
    const ok = await confirmDelete("終了済みをすべて削除しますか？", [
        { icon: "check_box", text: `チェック済みのやること ${count}件 を削除します。` }
    ]);
    if (!ok) return;
    appData.shoppingList = appData.shoppingList.filter(i => !i.checked);
    saveData();
    renderShoppingList();
}

// ----- やることカテゴリ管理（一覧・追加・編集・削除・並べ替え） -----
function renderShoppingCategoryManage() {
    const container = document.getElementById("shopping-category-manage-list");
    if (!container) return;
    container.innerHTML = "";

    if (appData.shoppingCategories.length === 0) {
        container.innerHTML = `<p class="empty-hint">カテゴリがありません</p>`;
        return;
    }

    appData.shoppingCategories.forEach((cat) => {
        const count = appData.shoppingList.filter(i => i.category === cat.name).length;
        const row = document.createElement("div");
        row.className = "category-list-item category-manage-item";
        row.setAttribute("data-drag-id", cat.id);
        row.innerHTML = `
            <span class="material-icons-round drag-handle" title="ドラッグして並べ替え">drag_indicator</span>
            <div class="category-item-main">
                <span class="category-item-name">${escapeHtml(cat.name)}</span>
                <span class="category-item-sub">${count}件</span>
            </div>
            <div class="entry-actions">
                <span class="material-icons-round entry-icon-btn" onclick="editShoppingCategory(${cat.id})">edit</span>
                <span class="material-icons-round entry-icon-btn danger" onclick="deleteShoppingCategory(${cat.id})">delete</span>
            </div>
        `;
        container.appendChild(row);
    });

    enableDragReorder(container, (ids) => {
        appData.shoppingCategories = reorderByIds(appData.shoppingCategories, ids, c => c.id);
        saveData();
        renderShoppingCategoryManage();
        renderShoppingCategorySelect();
        renderShoppingList();
    });
}

window.openShoppingCategoryManage = function() {
    renderShoppingCategoryManage();
    const modal = document.getElementById("modal-shopping-category-manage");
    if (modal) modal.classList.add("open");
};

window.editShoppingCategory = function(id) {
    openShoppingCategoryEntry(id);
};

window.deleteShoppingCategory = async function(id) {
    const cat = appData.shoppingCategories.find(c => c.id === id);
    if (!cat) return;
    const relatedCount = appData.shoppingList.filter(i => i.category === cat.name).length;
    const delLines = [{ icon: "delete_outline", text: "このカテゴリを削除します。" }];
    if (relatedCount > 0) delLines.push({ icon: "format_list_bulleted", text: `やること ${relatedCount}件 も一緒に削除されます。` });
    if (await confirmDelete(`「${cat.name}」を削除しますか？`, delLines)) {
        appData.shoppingCategories = appData.shoppingCategories.filter(c => c.id !== id);
        appData.shoppingList = appData.shoppingList.filter(i => i.category !== cat.name);
        collapsedShoppingCategories.delete(cat.name);
        appData.collapsedShoppingCategories = Array.from(collapsedShoppingCategories);
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
// 5. SETTLEMENT ENGINE（月ごとに独立した精算ボックス）
// ==========================================

// 今月 (YYYY-MM) を返す
function getCurrentMonthStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 未精算の支払いが存在する月＋今月（常に表示）の一覧を、新しい月順で返す
function getMonthsWithPendingPayments() {
    const set = new Set();
    appData.payments.forEach(p => {
        if (!p.settled && p.date) set.add(p.date.slice(0, 7));
    });
    set.add(getCurrentMonthStr());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
}

// 指定の月における未精算の立て替え額（ユーザー1・2それぞれが相手に請求できる額）
function computeMonthDemand(monthKey) {
    let u1Demands = 0;
    let u2Demands = 0;
    appData.payments.filter(p => !p.settled && p.date && p.date.slice(0, 7) === monthKey).forEach(p => {
        const opponentAmount = Math.round(p.amount * (p.ratio / 100));
        if (p.userId === 1) u1Demands += opponentAmount;
        else u2Demands += opponentAmount;
    });
    return { u1Demands, u2Demands };
}

function getPartialPaymentsForMonth(monthKey) {
    if (!appData.partialPayments) appData.partialPayments = {};
    return appData.partialPayments[monthKey] || [];
}

function getPartialPaidSum(monthKey) {
    return getPartialPaymentsForMonth(monthKey).reduce((sum, p) => sum + p.amount, 0);
}

function getMonthlyConfirmation(monthKey) {
    if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};
    if (!appData.monthlyConfirmations[monthKey]) appData.monthlyConfirmations[monthKey] = { 1: false, 2: false };
    return appData.monthlyConfirmations[monthKey];
}

function formatMonthLabel(monthStr) {
    const parts = monthStr.split("-");
    if (parts.length !== 2) return monthStr;
    return `${parts[0]}年${parseInt(parts[1], 10)}月`;
}

function renderSettlement() {
    const container = document.getElementById("settlement-boxes");
    if (!container) return;
    container.innerHTML = "";

    const months = getMonthsWithPendingPayments();
    months.forEach(monthKey => {
        container.appendChild(buildSettlementBoxEl(monthKey));
    });
}

function buildSettlementBoxEl(monthKey) {
    const u1 = appData.users[1];
    const u2 = appData.users[2];
    const u1Name = u1.name || "ユーザー1";
    const u2Name = u2.name || "ユーザー2";

    const { u1Demands, u2Demands } = computeMonthDemand(monthKey);
    const rawDiff = u1Demands - u2Demands;
    const absDiff = Math.abs(rawDiff);
    const partialPaid = getPartialPaidSum(monthKey);
    const owed = Math.max(0, absDiff - partialPaid);
    const conf = getMonthlyConfirmation(monthKey);

    let resultHtml;
    if (owed === 0) {
        resultHtml = `現在、お互いの精算額は相殺されて <span class="settlement-result-amount">0 円</span> です。`;
    } else if (rawDiff > 0) {
        resultHtml = `${u2Name} は ${u1Name} に<br><span class="settlement-result-amount">${owed.toLocaleString()} 円</span><br>お支払いください。`;
    } else {
        resultHtml = `${u1Name} は ${u2Name} に<br><span class="settlement-result-amount">${owed.toLocaleString()} 円</span><br>お支払いください。`;
    }

    const partials = getPartialPaymentsForMonth(monthKey).slice().sort((a, b) => b.date.localeCompare(a.date));
    const partialListHtml = partials.length > 0
        ? partials.map(pp => `
            <div class="partial-payment-row">
                <span class="pp-info">${formatDateLabel(pp.date)} ・ ${pp.amount.toLocaleString()}円 支払い済み</span>
                <div class="entry-actions">
                    <span class="material-icons-round entry-icon-btn" onclick="editPartialPayment('${monthKey}', ${pp.id})">edit</span>
                    <span class="material-icons-round entry-icon-btn danger" onclick="deletePartialPayment('${monthKey}', ${pp.id})">delete</span>
                </div>
            </div>
        `).join("")
        : `<p class="partial-payment-empty">まだ一部支払いの記録はありません</p>`;

    const card = document.createElement("div");
    card.className = "settlement-card" + (conf[1] && conf[2] ? " settled" : "");
    card.id = `settlement-card-${monthKey}`;
    card.innerHTML = `
        <div class="settlement-card-header">
            <p class="settlement-period">${formatMonthLabel(monthKey)} の精算</p>
            <button class="settlement-more-btn" onclick="openPartialPaymentModal('${monthKey}')" title="一部支払いを記録">
                <span class="material-icons-round">more_vert</span>
            </button>
        </div>
        <div class="settlement-result">${resultHtml}</div>
        <div class="confirmation-status">
            <button class="conf-btn" id="btn-confirm-user1-${monthKey}" onclick="toggleMonthConfirm('${monthKey}', 1)">
                <span class="material-icons-round check-icon">check_circle</span>
                <span class="label">${u1Name} の確認</span>
            </button>
            <button class="conf-btn" id="btn-confirm-user2-${monthKey}" onclick="toggleMonthConfirm('${monthKey}', 2)">
                <span class="material-icons-round check-icon">check_circle</span>
                <span class="label">${u2Name} の確認</span>
            </button>
        </div>
        <div class="partial-payment-list">
            <p class="partial-payment-list-title">一部支払いの履歴</p>
            ${partialListHtml}
        </div>
    `;

    const btn1 = card.querySelector(`#btn-confirm-user1-${monthKey}`);
    const btn2 = card.querySelector(`#btn-confirm-user2-${monthKey}`);
    if (btn1 && btn2) {
        if (appData.currentOperator === 1) {
            btn1.disabled = false; btn1.classList.add("operable");
            btn2.disabled = true; btn2.classList.remove("operable");
        } else {
            btn1.disabled = true; btn1.classList.remove("operable");
            btn2.disabled = false; btn2.classList.add("operable");
        }
        if (conf[1]) btn1.classList.add("confirmed");
        if (conf[2]) btn2.classList.add("confirmed");
    }

    return card;
}

window.toggleMonthConfirm = function(monthKey, userNum) {
    if (appData.currentOperator !== userNum) return;
    const conf = getMonthlyConfirmation(monthKey);
    conf[userNum] = !conf[userNum];
    saveData();
    renderSettlement();
    if (conf[1] && conf[2]) {
        archiveMonth(monthKey);
    }
};

// 指定の月を精算済みとしてアーカイブし、その月の精算ボックスをリセットする
function archiveMonth(monthKey) {
    const card = document.getElementById(`settlement-card-${monthKey}`);
    if (card) card.classList.add("settled");

    setTimeout(() => {
        const pending = appData.payments.filter(p => !p.settled && p.date && p.date.slice(0, 7) === monthKey);
        if (pending.length > 0) {
            const settlementId = Date.now();
            pending.forEach(p => { p.settled = true; p.settledMonth = monthKey; p.settlementId = settlementId; p.settledAt = settlementId; });
        }
        if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};
        appData.monthlyConfirmations[monthKey] = { 1: false, 2: false };
        if (appData.partialPayments) delete appData.partialPayments[monthKey];
        saveData();
        renderSettlement();
        renderArchive();
    }, 1500);
}

// ----- 一部支払い（分割払い）モーダル -----
window.openPartialPaymentModal = function(monthKey) {
    const monthInput = document.getElementById("partial-pay-month");
    const editIdInput = document.getElementById("partial-pay-edit-id");
    const amountInput = document.getElementById("partial-pay-amount");
    const dateInput = document.getElementById("partial-pay-date");
    const saveBtn = document.getElementById("btn-save-partial-payment");
    const titleEl = document.getElementById("partial-payment-modal-title");

    if (monthInput) monthInput.value = monthKey;
    if (editIdInput) editIdInput.value = "";
    if (amountInput) amountInput.value = "";
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
    if (saveBtn) saveBtn.disabled = true;
    if (titleEl) titleEl.innerText = "いくら払いますか？";

    const modal = document.getElementById("modal-partial-payment");
    if (modal) modal.classList.add("open");
};

// 一部支払いの記録を編集する（金額・日付を書き換える）
window.editPartialPayment = function(monthKey, id) {
    const entry = getPartialPaymentsForMonth(monthKey).find(p => p.id === id);
    if (!entry) return;

    const monthInput = document.getElementById("partial-pay-month");
    const editIdInput = document.getElementById("partial-pay-edit-id");
    const amountInput = document.getElementById("partial-pay-amount");
    const dateInput = document.getElementById("partial-pay-date");
    const saveBtn = document.getElementById("btn-save-partial-payment");
    const titleEl = document.getElementById("partial-payment-modal-title");

    if (monthInput) monthInput.value = monthKey;
    if (editIdInput) editIdInput.value = id;
    if (amountInput) amountInput.value = entry.amount;
    if (dateInput) dateInput.value = entry.date;
    if (saveBtn) saveBtn.disabled = false;
    if (titleEl) titleEl.innerText = "一部支払いを編集";

    const modal = document.getElementById("modal-partial-payment");
    if (modal) modal.classList.add("open");
};

// 一部支払いの記録を削除する
window.deletePartialPayment = async function(monthKey, id) {
    if (!(await confirmDelete("この一部支払いを削除しますか？", [{ icon: "delete_outline", text: "この一部支払いの記録を削除します。" }]))) return;
    if (!appData.partialPayments || !appData.partialPayments[monthKey]) return;
    appData.partialPayments[monthKey] = appData.partialPayments[monthKey].filter(p => p.id !== id);
    saveData();
    renderSettlement();
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
                <span class="category-item-name">${escapeHtml(cat.name)}</span>
                <span class="category-item-sub">${lastLabel}</span>
            </div>
            <span class="material-icons-round category-item-chevron">chevron_right</span>
        `;
        container.appendChild(row);
    });
}

// ----- カテゴリ管理（一覧・追加・編集・削除・並べ替え） -----
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
        row.setAttribute("data-drag-id", cat.id);
        row.innerHTML = `
            <span class="material-icons-round drag-handle" title="ドラッグして並べ替え">drag_indicator</span>
            <span class="material-icons-round category-item-icon">${cat.icon}</span>
            <div class="category-item-main">
                <span class="category-item-name">${escapeHtml(cat.name)}</span>
                <span class="category-item-sub">${count}件の記録</span>
            </div>
            <div class="entry-actions">
                <span class="material-icons-round entry-icon-btn" onclick="editCleaningCategory(${cat.id})">edit</span>
                <span class="material-icons-round entry-icon-btn danger" onclick="deleteCleaningCategory(${cat.id})">delete</span>
            </div>
        `;
        container.appendChild(row);
    });

    enableDragReorder(container, (ids) => {
        appData.cleaningCategories = reorderByIds(appData.cleaningCategories, ids, c => c.id);
        saveData();
        renderCleaningCategoryManage();
        renderCleaningCategories();
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

window.deleteCleaningCategory = async function(id) {
    const cat = appData.cleaningCategories.find(c => c.id === id);
    if (!cat) return;
    const relatedCount = appData.cleaningItems.filter(i => i.category === cat.name).length;
    const delLines = [{ icon: "delete_outline", text: "このカテゴリを削除します。" }];
    if (relatedCount > 0) delLines.push({ icon: "format_list_bulleted", text: `掃除の記録 ${relatedCount}件 も一緒に削除されます。` });
    if (await confirmDelete(`「${cat.name}」を削除しますか？`, delLines)) {
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
                    <span class="entry-title">${item.note ? escapeHtml(item.note) : "掃除しました"}</span>
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

window.deleteCleaningItem = async function(id) {
    if (await confirmDelete("この記録を削除しますか？", [{ icon: "delete_outline", text: "この掃除の記録を削除します。" }])) {
        appData.cleaningItems = appData.cleaningItems.filter(i => i.id !== id);
        saveData();
        renderCleaningDetail();
        renderCleaningCategories();
    }
};

// ==========================================
// ダークモード & フォント設定
// ==========================================
function initDarkMode() {
    const saved = localStorage.getItem("rakuraku_theme");
    if (saved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    }
}

function toggleDarkMode(forceState) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextDark = typeof forceState === "boolean" ? forceState : !isDark;
    if (nextDark) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("rakuraku_theme", "dark");
    } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("rakuraku_theme", "light");
    }
    syncDarkModeCheckbox();
}

function syncDarkModeCheckbox() {
    const chk = document.getElementById("chk-dark-mode");
    if (!chk) return;
    chk.checked = document.documentElement.getAttribute("data-theme") === "dark";
}

function applyFont(key) {
    const opt = FONT_OPTIONS.find(f => f.key === key) || FONT_OPTIONS[0];
    document.documentElement.style.setProperty("--app-font", opt.stack);
}

function initFont() {
    if (!appData.fontChoice) appData.fontChoice = "zenmaru";
    normalizeFontChoice();
    saveData();
    applyFont(appData.fontChoice);
}

window.selectFont = function(key) {
    appData.fontChoice = key;
    saveData();
    applyFont(key);
    renderFontOptions();
};

function renderFontOptions() {
    const container = document.getElementById("font-option-list");
    if (!container) return;
    container.innerHTML = FONT_OPTIONS.map(opt => `
        <div class="font-option-item ${appData.fontChoice === opt.key ? "selected" : ""}" onclick="selectFont('${opt.key}')">
            <span class="font-option-name" style="font-family:${opt.stack};">${opt.label}</span>
            <span class="material-icons-round font-option-check">${appData.fontChoice === opt.key ? "radio_button_checked" : "radio_button_unchecked"}</span>
        </div>
    `).join("");
}

// 文字サイズ：html のルート font-size を変えると、rem 単位の文字サイズがすべて連動して拡縮する
function applyFontSize(key) {
    const opt = FONT_SIZE_OPTIONS.find(f => f.key === key) || FONT_SIZE_OPTIONS.find(f => f.key === "m");
    document.documentElement.style.fontSize = `${16 * opt.scale}px`;
}

function initFontSize() {
    if (!appData.fontSizeChoice) appData.fontSizeChoice = "m";
    applyFontSize(appData.fontSizeChoice);
}

window.selectFontSize = function(key) {
    appData.fontSizeChoice = key;
    saveData();
    applyFontSize(key);
    renderFontSizeOptions();
};

function renderFontSizeOptions() {
    const container = document.getElementById("font-size-option-list");
    if (!container) return;
    container.innerHTML = FONT_SIZE_OPTIONS.map(opt => `
        <div class="font-size-option-item ${appData.fontSizeChoice === opt.key ? "selected" : ""}" onclick="selectFontSize('${opt.key}')">${opt.label}</div>
    `).join("");
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

window.deleteFridgeItem = async function(id) {
    if (await confirmDelete("この食材を削除しますか？", [{ icon: "delete_outline", text: "この食材を冷蔵庫から削除します。" }])) {
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

window.deleteHistoryGroup = async function(event, groupKey) {
    event.stopPropagation();
    if (await confirmDelete("この精算の履歴を削除しますか？", [{ icon: "delete_outline", text: "この精算の履歴データをすべて削除します。" }])) {
        appData.payments = appData.payments.filter(p => {
            const pKey = String(p.settlementId || `month-${p.settledMonth}`);
            return pKey !== String(groupKey);
        });
        saveData();
        renderArchive();
    }
};

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
// すべてのタブのデータ（支払い・やること・やることカテゴリ・冷蔵庫・掃除記録・
// 掃除カテゴリ・シフト・一部支払い・月次確認・ユーザー情報・各種設定）を
// もれなく書き出し／読み込みできるようにする
// ==========================================
function exportCSV() {
    const paymentRows = [["種別", "ID", "ユーザーID", "タイトル", "金額", "割合", "メモ", "日付", "精算済", "精算月", "精算ID", "精算日時"]];
    appData.payments.forEach(p => {
        paymentRows.push(["支払い", p.id, p.userId, p.title, p.amount, p.ratio, p.memo || "", p.date, p.settled ? "1" : "0", p.settledMonth || "", p.settlementId || "", p.settledAt || ""]);
    });

    const shoppingRows = [["種別", "ID", "商品名", "カテゴリ", "チェック済"]];
    appData.shoppingList.forEach(s => {
        shoppingRows.push(["やること", s.id, s.text, s.category || "", s.checked ? "1" : "0"]);
    });

    const shoppingCategoryRows = [["種別", "ID", "名前"]];
    appData.shoppingCategories.forEach(c => {
        shoppingCategoryRows.push(["やることカテゴリ", c.id, c.name]);
    });

    const fridgeRows = [["種別", "ID", "商品名", "数量", "単位", "場所", "賞味期限"]];
    appData.fridgeItems.forEach(f => {
        fridgeRows.push(["冷蔵庫", f.id, f.name, f.qty, f.unit, f.category, f.expiry || ""]);
    });

    const cleaningRows = [["種別", "ID", "カテゴリ", "メモ", "タイムスタンプ"]];
    appData.cleaningItems.forEach(c => {
        cleaningRows.push(["掃除記録", c.id, c.category, c.note || "", c.timestamp]);
    });

    const cleaningCategoryRows = [["種別", "ID", "名前", "アイコン"]];
    appData.cleaningCategories.forEach(c => {
        cleaningCategoryRows.push(["掃除カテゴリ", c.id, c.name, c.icon]);
    });

    const shiftRows = [["種別", "日付", "ID", "タイトル", "開始", "終了", "ユーザーID"]];
    Object.keys(appData.shiftsData || {}).forEach(dateStr => {
        (appData.shiftsData[dateStr] || []).forEach(s => {
            shiftRows.push(["シフト", dateStr, s.id, s.title || "", s.start, s.end, s.userId]);
        });
    });

    const partialRows = [["種別", "月", "ID", "金額", "日付"]];
    Object.keys(appData.partialPayments || {}).forEach(monthKey => {
        (appData.partialPayments[monthKey] || []).forEach(pp => {
            partialRows.push(["一部支払い", monthKey, pp.id, pp.amount, pp.date]);
        });
    });

    const confirmRows = [["種別", "月", "ユーザー1確認", "ユーザー2確認"]];
    Object.keys(appData.monthlyConfirmations || {}).forEach(monthKey => {
        const c = appData.monthlyConfirmations[monthKey];
        confirmRows.push(["月次確認", monthKey, c[1] ? "1" : "0", c[2] ? "1" : "0"]);
    });

    const mealRows = [["種別", "ID", "日付", "時間", "メモ", "種類"]];
    (appData.mealLogs || []).forEach(m => {
        mealRows.push(["飲食日記", m.id, m.date, m.time, m.memo, m.type]);
    });

    const userRows = [["種別", "ユーザーID", "名前", "写真"]];
    [1, 2].forEach(uid => {
        const u = appData.users[uid] || { name: "", photo: null };
        userRows.push(["ユーザー", uid, u.name || "", u.photo || ""]);
    });

    const settingsRows = [["種別", "キー", "値"]];
    settingsRows.push(["設定", "currentOperator", appData.currentOperator]);
    settingsRows.push(["設定", "fontChoice", appData.fontChoice || "zenmaru"]);
    settingsRows.push(["設定", "fontSizeChoice", appData.fontSizeChoice || "m"]);
    settingsRows.push(["設定", "themeChoice", appData.themeChoice || "strawberry"]);
    settingsRows.push(["設定", "tabConfig", JSON.stringify(appData.tabConfig || [])]);
    settingsRows.push(["設定", "collapsedShoppingCategories", JSON.stringify(appData.collapsedShoppingCategories || [])]);
    settingsRows.push(["設定", "lastSettlement", appData.lastSettlement || ""]);

    const allRows = [
        ...paymentRows, [],
        ...shoppingRows, [],
        ...shoppingCategoryRows, [],
        ...fridgeRows, [],
        ...cleaningRows, [],
        ...cleaningCategoryRows, [],
        ...shiftRows, [],
        ...partialRows, [],
        ...mealRows, [],
        ...confirmRows, [],
        ...userRows, [],
        ...settingsRows
    ];
    const csvContent = allRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `らぶらぶ同棲_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    appData.lastBackupAt = now.toISOString();
    saveData();
    renderBackupPanel();
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result.replace(/^﻿/, "");
            const lines = text.split(/\r?\n/).filter(l => l.trim());

            const payments = [];
            const shoppingList = [];
            const shoppingCategories = [];
            const fridgeItems = [];
            const cleaningItems = [];
            const cleaningCategories = [];
            const shiftsData = {};
            const mealLogs = [];
            const partialPayments = {};
            const monthlyConfirmations = {};
            const users = { 1: { name: "", photo: null }, 2: { name: "", photo: null } };
            const settings = {};
            let usersImported = false;

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
                        settledMonth: cols[9] || "",
                        settlementId: cols[10] ? (isNaN(Number(cols[10])) ? cols[10] : Number(cols[10])) : undefined,
                        settledAt: cols[11] ? (Number(cols[11]) || undefined) : undefined
                    });
                } else if (type === "やること" && cols.length >= 5) {
                    shoppingList.push({
                        id: parseInt(cols[1]) || Date.now(),
                        text: cols[2],
                        category: cols[3],
                        checked: cols[4] === "1"
                    });
                } else if (type === "やることカテゴリ" && cols.length >= 3) {
                    shoppingCategories.push({ id: parseInt(cols[1]) || Date.now(), name: cols[2] });
                } else if (type === "冷蔵庫" && cols.length >= 7) {
                    fridgeItems.push({
                        id: parseInt(cols[1]) || Date.now(),
                        name: cols[2],
                        qty: parseFloat(cols[3]) || 1,
                        unit: cols[4],
                        category: cols[5],
                        expiry: cols[6]
                    });
                } else if (type === "掃除記録" && cols.length >= 5) {
                    cleaningItems.push({
                        id: parseInt(cols[1]) || Date.now(),
                        category: cols[2],
                        note: cols[3] || "",
                        timestamp: parseInt(cols[4]) || Date.now()
                    });
                } else if (type === "掃除カテゴリ" && cols.length >= 4) {
                    cleaningCategories.push({ id: parseInt(cols[1]) || Date.now(), name: cols[2], icon: cols[3] });
                } else if (type === "シフト" && cols.length >= 7) {
                    const dateStr = cols[1];
                    if (!shiftsData[dateStr]) shiftsData[dateStr] = [];
                    shiftsData[dateStr].push({
                        id: cols[2] || generateShiftId(),
                        title: cols[3] || "",
                        start: cols[4],
                        end: cols[5],
                        userId: parseInt(cols[6]) || 1
                    });
                } else if (type === "飲食日記" && cols.length >= 6) {
                    mealLogs.push({
                        id: cols[1] || generateMealId(),
                        date: cols[2],
                        time: cols[3],
                        memo: cols[4],
                        type: MEAL_TYPES.some(t => t.key === cols[5]) ? cols[5] : "meal"
                    });
                } else if (type === "一部支払い" && cols.length >= 5) {
                    const monthKey = cols[1];
                    if (!partialPayments[monthKey]) partialPayments[monthKey] = [];
                    partialPayments[monthKey].push({
                        id: parseInt(cols[2]) || Date.now(),
                        amount: parseInt(cols[3]) || 0,
                        date: cols[4]
                    });
                } else if (type === "月次確認" && cols.length >= 4) {
                    monthlyConfirmations[cols[1]] = { 1: cols[2] === "1", 2: cols[3] === "1" };
                } else if (type === "ユーザー" && cols.length >= 4) {
                    const uid = parseInt(cols[1]);
                    if (uid === 1 || uid === 2) {
                        users[uid] = { name: cols[2] || "", photo: cols[3] || null };
                        usersImported = true;
                    }
                } else if (type === "設定" && cols.length >= 3) {
                    settings[cols[1]] = cols[2];
                }
            });

            const totalCount = payments.length + shoppingList.length + fridgeItems.length + cleaningItems.length
                + Object.keys(shiftsData).length + Object.keys(partialPayments).length
                + shoppingCategories.length + cleaningCategories.length + mealLogs.length;

            if (totalCount > 0) {
                if (await showConfirm({
                    title: "CSVをインポートしますか？",
                    lines: [
                        { icon: "upload_file", text: `支払い ${payments.length}件・やること ${shoppingList.length}件・冷蔵庫 ${fridgeItems.length}件・掃除 ${cleaningItems.length}件・飲食日記 ${mealLogs.length}件` },
                        { icon: "sync_problem", text: "現在のデータは上書きされます" }
                    ],
                    confirmText: "インポートする",
                    cancelText: "キャンセル"
                })) {
                    appData.payments = payments;
                    appData.shoppingList = shoppingList;
                    if (shoppingCategories.length > 0) appData.shoppingCategories = shoppingCategories;
                    appData.fridgeItems = fridgeItems;
                    appData.cleaningItems = cleaningItems;
                    if (cleaningCategories.length > 0) appData.cleaningCategories = cleaningCategories;
                    appData.shiftsData = shiftsData;
                    appData.mealLogs = mealLogs;
                    appData.partialPayments = partialPayments;
                    appData.monthlyConfirmations = monthlyConfirmations;
                    if (usersImported) {
                        appData.users[1] = users[1];
                        appData.users[2] = users[2];
                    }
                    if (settings.currentOperator) appData.currentOperator = parseInt(settings.currentOperator) || 1;
                    if (settings.fontChoice) appData.fontChoice = settings.fontChoice;
                    if (settings.fontSizeChoice) appData.fontSizeChoice = settings.fontSizeChoice;
                    if (settings.themeChoice) appData.themeChoice = settings.themeChoice;
                    if (settings.tabConfig) {
                        try { appData.tabConfig = JSON.parse(settings.tabConfig); } catch (err) { /* 既存の設定を維持 */ }
                    }
                    if (settings.collapsedShoppingCategories) {
                        try { appData.collapsedShoppingCategories = JSON.parse(settings.collapsedShoppingCategories); } catch (err) { /* noop */ }
                    }
                    if (settings.lastSettlement) appData.lastSettlement = settings.lastSettlement;

                    collapsedShoppingCategories = new Set(appData.collapsedShoppingCategories || []);

                    saveData();
                    initFont();
                    initFontSize();
                    initTheme();
                    initApp();
                    renderBackupPanel();
                    notify("インポートが完了しました。");
                }
            } else {
                notify("有効なデータが見つかりませんでした。CSVのフォーマットを確認してください。");
            }
        } catch (err) {
            notify("CSVの読み込みに失敗しました。ファイルを確認してください。");
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

function updateRatioPresetActive() {
    const ratioInput = document.getElementById("pay-ratio");
    if (!ratioInput) return;
    ratioInput.style.setProperty("--range-fill", `${parseInt(ratioInput.value) || 0}%`);
    document.querySelectorAll("#ratio-presets .ratio-preset-btn").forEach(b => {
        b.classList.toggle("selected", b.getAttribute("data-ratio") === String(parseInt(ratioInput.value)));
    });
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
    updateRatioPresetActive();
    if (calcAmountInput) calcAmountInput.value = `${Math.round(amount * (ratio / 100)).toLocaleString()} 円`;
}

// ==========================================
// 10. PROTECTED EVENT LIFECYCLES
// ==========================================
function setupEventListeners() {
    initCloseGuards();
    initMealDiary();
    initPaymentExtras();
    initHeaderDate();
    // 金額入力用の電卓モーダル
    initCalculator();

    // Tab Display Settings (テディベアアイコン)
    const btnTabSettings = document.getElementById("btn-tab-settings");
    if (btnTabSettings) {
        btnTabSettings.addEventListener("click", () => {
            renderTabSettingsList();
            const modal = document.getElementById("modal-tab-settings");
            if (modal) modal.classList.add("open");
        });
    }
    const btnCloseTabSettings = document.getElementById("btn-close-tab-settings");
    if (btnCloseTabSettings) {
        btnCloseTabSettings.addEventListener("click", () => {
            const modal = document.getElementById("modal-tab-settings");
            if (modal) modal.classList.remove("open");
        });
    }

    // Operational Context Switcher（操作ユーザーの切り替え：シフトタブ表示中ならそのユーザーのシフトに切り替える）
    const btnUserSwitch = document.getElementById("btn-user-switch");
    if (btnUserSwitch) btnUserSwitch.addEventListener("click", openUserSwitch);
    const btnUserSwitchClose = document.getElementById("btn-user-switch-close");
    if (btnUserSwitchClose) btnUserSwitchClose.addEventListener("click", closeUserSwitch);
    const userSwitchOverlay = document.getElementById("user-switch-overlay");
    if (userSwitchOverlay) userSwitchOverlay.addEventListener("click", (e) => { if (e.target === userSwitchOverlay) closeUserSwitch(); });

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

            duplicateOwnerId = null;
            if (titleEl) titleEl.innerText = "支払いを記録";
            if (editIdEl) editIdEl.value = "";
            if (titleInput) titleInput.value = "";
            if (amountInput) amountInput.value = "";
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            if (ratioInput) ratioInput.value = 50;
            if (memoInput) memoInput.value = "";

            setPayMealLink(false, "meal");
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
    document.querySelectorAll("#ratio-presets .ratio-preset-btn").forEach(b => {
        b.addEventListener("click", () => {
            if (!payRatio) return;
            payRatio.value = b.getAttribute("data-ratio");
            updateCalculatedAmount();
        });
    });
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

            if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};

            // 飲食日記への連携（ONのとき、保存した時点の日付・時間で記録する）
            const syncMeal = (existingPay) => {
                if (!appData.mealLogs) appData.mealLogs = [];
                const linked = existingPay && existingPay.mealId ? appData.mealLogs.find(m => m.id === existingPay.mealId) : null;
                if (!payMealLinkOn) {
                    if (existingPay) delete existingPay.mealId; // 連携を外す（飲食日記の記録は残す）
                    return null;
                }
                const mealMemo = payMealMemo || title; // 候補を選ばなければ「何のお金？」の内容
                if (linked) {
                    linked.memo = mealMemo;
                    linked.type = payMealType;
                    return linked.id;
                }
                const now = new Date();
                const meal = {
                    id: generateMealId(),
                    date: toDateStr(now),
                    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
                    memo: mealMemo,
                    type: payMealType
                };
                appData.mealLogs.push(meal);
                return meal.id;
            };

            if (editId) {
                const existing = appData.payments.find(p => p.id === parseInt(editId));
                if (existing) {
                    const mid = syncMeal(existing);
                    if (mid) existing.mealId = mid;
                    const oldMonth = existing.date ? existing.date.slice(0, 7) : null;
                    existing.title = title; existing.amount = amount; existing.date = dateVal; existing.ratio = ratio; existing.memo = memo;
                    const newMonth = dateVal.slice(0, 7);
                    if (oldMonth) appData.monthlyConfirmations[oldMonth] = { 1: false, 2: false };
                    appData.monthlyConfirmations[newMonth] = { 1: false, 2: false };
                }
            } else {
                const newPay = { id: Date.now(), userId: duplicateOwnerId || appData.currentOperator, title, amount, ratio, memo, date: dateVal, settled: false, settledMonth: "" };
                const mid = syncMeal(null);
                if (mid) newPay.mealId = mid;
                appData.payments.push(newPay);
                const newMonth = dateVal.slice(0, 7);
                appData.monthlyConfirmations[newMonth] = { 1: false, 2: false };
            }

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

    // やることの編集モーダル
    const btnCloseShoppingItem = document.getElementById("btn-close-shopping-item");
    if (btnCloseShoppingItem) {
        btnCloseShoppingItem.addEventListener("click", () => {
            const modal = document.getElementById("modal-shopping-item-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    const shoppingItemEditText = document.getElementById("shopping-item-edit-text");
    if (shoppingItemEditText) {
        shoppingItemEditText.addEventListener("input", validateShoppingItemInput);
        shoppingItemEditText.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveShoppingItemEdit();
        });
    }

    const btnSaveShoppingItem = document.getElementById("btn-save-shopping-item");
    if (btnSaveShoppingItem) btnSaveShoppingItem.addEventListener("click", saveShoppingItemEdit);

    const btnDeleteShoppingItem = document.getElementById("btn-delete-shopping-item");
    if (btnDeleteShoppingItem) btnDeleteShoppingItem.addEventListener("click", deleteShoppingItemFromEditor);

    const btnClearChecked = document.getElementById("btn-clear-checked");
    if (btnClearChecked) btnClearChecked.addEventListener("click", clearCheckedShoppingItems);

    const shoppingCatField = document.getElementById("shopping-item-category-field");
    if (shoppingCatField) {
        shoppingCatField.addEventListener("click", openShoppingCategoryPicker);
        shoppingCatField.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openShoppingCategoryPicker(); } });
    }
    const btnCloseShoppingCatPicker = document.getElementById("btn-close-shopping-cat-picker");
    if (btnCloseShoppingCatPicker) btnCloseShoppingCatPicker.addEventListener("click", () => {
        document.getElementById("modal-shopping-cat-picker").classList.remove("open");
    });

    // 一部支払い（分割払い）モーダル
    const btnClosePartialPayment = document.getElementById("btn-close-partial-payment");
    if (btnClosePartialPayment) {
        btnClosePartialPayment.addEventListener("click", () => {
            const modal = document.getElementById("modal-partial-payment");
            if (modal) modal.classList.remove("open");
        });
    }

    function validatePartialPaymentInput() {
        const amountInput = document.getElementById("partial-pay-amount");
        const dateInput = document.getElementById("partial-pay-date");
        const saveBtn = document.getElementById("btn-save-partial-payment");
        if (!amountInput || !dateInput || !saveBtn) return;
        const amount = parseInt(amountInput.value);
        saveBtn.disabled = isNaN(amount) || amount <= 0 || !dateInput.value;
    }

    const partialPayAmount = document.getElementById("partial-pay-amount");
    const partialPayDate = document.getElementById("partial-pay-date");
    if (partialPayAmount) partialPayAmount.addEventListener("input", validatePartialPaymentInput);
    if (partialPayDate) partialPayDate.addEventListener("change", validatePartialPaymentInput);

    const btnSavePartialPayment = document.getElementById("btn-save-partial-payment");
    if (btnSavePartialPayment) {
        btnSavePartialPayment.addEventListener("click", () => {
            const monthKey = document.getElementById("partial-pay-month").value;
            const editId = document.getElementById("partial-pay-edit-id").value;
            const amount = parseInt(document.getElementById("partial-pay-amount").value);
            const date = document.getElementById("partial-pay-date").value;
            if (!monthKey || isNaN(amount) || amount <= 0 || !date) return;

            if (!appData.partialPayments) appData.partialPayments = {};
            if (!appData.partialPayments[monthKey]) appData.partialPayments[monthKey] = [];

            if (editId) {
                const entry = appData.partialPayments[monthKey].find(p => String(p.id) === String(editId));
                if (entry) { entry.amount = amount; entry.date = date; }
            } else {
                appData.partialPayments[monthKey].push({ id: Date.now(), amount, date });
            }

            saveData();
            renderSettlement();
            const modal = document.getElementById("modal-partial-payment");
            if (modal) modal.classList.remove("open");
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

    // History Menu（精算タブ内に配置）
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
            if (activeTab && activeTab.id === "tab-shift") {
                const modal = document.getElementById("modal-shift-bulk");
                if (modal) modal.classList.add("open");
                return;
            }
            openBasicSettings();
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
                        if (collapsedShoppingCategories.has(oldName)) {
                            collapsedShoppingCategories.delete(oldName);
                            collapsedShoppingCategories.add(name);
                            appData.collapsedShoppingCategories = Array.from(collapsedShoppingCategories);
                        }
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

    // 基本設定モーダル：ユーザー1・2の入力欄、写真アップロード
    [1, 2].forEach(type => {
        const nameInput = document.getElementById(`edit-name-${type}`);
        if (nameInput) nameInput.addEventListener("input", () => updateAvatarPreview(type));

        const photoInput = document.getElementById(`edit-photo-input-${type}`);
        if (photoInput) {
            photoInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) handlePhotoFile(file, type);
                e.target.value = "";
            });
        }

        const btnRemovePhoto = document.getElementById(`btn-remove-photo-${type}`);
        if (btnRemovePhoto) {
            btnRemovePhoto.addEventListener("click", async () => {
                const ok = await confirmDelete("写真を削除しますか？", [
                    { icon: "no_photography", text: "プロフィール写真を削除します。" },
                    { icon: "person", text: "頭文字のアイコンに戻ります。" }
                ]);
                if (!ok) return;
                appData.users[type].photo = null;
                updateAvatarPreview(type);
            });
        }
    });

    // 表示設定：ダークモード切り替え
    const chkDarkMode = document.getElementById("chk-dark-mode");
    if (chkDarkMode) {
        chkDarkMode.addEventListener("change", (e) => {
            toggleDarkMode(e.target.checked);
        });
    }

    const btnSaveProfile = document.getElementById("btn-save-profile");
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener("click", () => {
            if (appData.isNewAccount) {
                // オンボーディング：1人ずつ名前を保存して次のステップへ
                const nameInput = document.getElementById(`edit-name-${activeEditorUser}`);
                if (nameInput && (activeEditorUser === 1 || activeEditorUser === 2)) {
                    const inputName = nameInput.value.trim();
                    appData.users[activeEditorUser].name = inputName || `ユーザー ${activeEditorUser}`;
                }
                if (activeEditorUser === 1) {
                    saveData();
                    switchProfileEditor(2);
                    return;
                }
                appData.isNewAccount = false;
                saveData();
                initApp();
                const modalProfile = document.getElementById("modal-profile");
                if (modalProfile) modalProfile.classList.remove("open");
            } else {
                // 基本設定：ユーザー1・2をまとめて保存
                [1, 2].forEach(type => {
                    const nameInput = document.getElementById(`edit-name-${type}`);
                    if (nameInput) {
                        const inputName = nameInput.value.trim();
                        appData.users[type].name = inputName || `ユーザー ${type}`;
                    }
                });
                saveData();
                initApp();
                const modalProfile = document.getElementById("modal-profile");
                if (modalProfile) modalProfile.classList.remove("open");
            }
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

    // Shift: Month Navigation
    const btnShiftPrevMonth = document.getElementById("btn-shift-prev-month");
    if (btnShiftPrevMonth) {
        btnShiftPrevMonth.addEventListener("click", () => {
            shiftCalendarMonth--;
            if (shiftCalendarMonth < 0) { shiftCalendarMonth = 11; shiftCalendarYear--; }
            renderShiftCalendar();
            updateShiftSummary();
        });
    }
    const btnShiftNextMonth = document.getElementById("btn-shift-next-month");
    if (btnShiftNextMonth) {
        btnShiftNextMonth.addEventListener("click", () => {
            shiftCalendarMonth++;
            if (shiftCalendarMonth > 11) { shiftCalendarMonth = 0; shiftCalendarYear++; }
            renderShiftCalendar();
            updateShiftSummary();
        });
    }
    const btnShiftCurrentMonth = document.getElementById("btn-shift-current-month");
    if (btnShiftCurrentMonth) {
        btnShiftCurrentMonth.addEventListener("click", () => {
            const now = new Date();
            shiftCalendarYear = now.getFullYear();
            shiftCalendarMonth = now.getMonth();
            shiftSelectedDate = formatShiftDateKey(now);
            renderShiftCalendar();
            renderShiftDayList();
            updateShiftSummary();
        });
    }

    // Shift: Add / Edit Entry Modal
    const fabAddShift = document.getElementById("fab-add-shift");
    if (fabAddShift) {
        fabAddShift.addEventListener("click", () => {
            const titleEl = document.getElementById("shift-entry-modal-title");
            const editIdEl = document.getElementById("shift-edit-id");
            const dateEl = document.getElementById("shift-date");
            const titleInput = document.getElementById("shift-title");
            const startInput = document.getElementById("shift-start");
            const endInput = document.getElementById("shift-end");
            const modal = document.getElementById("modal-shift-entry");

            if (titleEl) titleEl.innerText = "シフトを追加";
            if (editIdEl) editIdEl.value = "";
            if (dateEl) dateEl.value = shiftSelectedDate;
            if (titleInput) titleInput.value = "";
            if (startInput) startInput.value = "09:00";
            if (endInput) endInput.value = "18:00";
            if (modal) modal.classList.add("open");
        });
    }

    const btnCloseShiftEntry = document.getElementById("btn-close-shift-entry");
    if (btnCloseShiftEntry) {
        btnCloseShiftEntry.addEventListener("click", () => {
            const modal = document.getElementById("modal-shift-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnSaveShift = document.getElementById("btn-save-shift");
    if (btnSaveShift) {
        btnSaveShift.addEventListener("click", () => {
            const editId = document.getElementById("shift-edit-id").value;
            const dateVal = document.getElementById("shift-date").value;
            const title = document.getElementById("shift-title").value.trim();
            const start = document.getElementById("shift-start").value.trim();
            const end = document.getElementById("shift-end").value.trim();

            if (!dateVal || !start || !end) { notify("日付・開始時間・終了時間を入力してください"); return; }
            const shifts = getSharedShifts();

            if (editId) {
                const existing = findSharedShiftById(editId);
                const ownerId = existing ? existing.shift.userId : appData.currentOperator;
                Object.keys(shifts).forEach(d => {
                    shifts[d] = shifts[d].filter(s => s.id !== editId);
                });
                if (!shifts[dateVal]) shifts[dateVal] = [];
                shifts[dateVal].push({ id: editId, title, start, end, userId: ownerId });
            } else {
                if (!shifts[dateVal]) shifts[dateVal] = [];
                shifts[dateVal].push({ id: generateShiftId(), title, start, end, userId: appData.currentOperator });
            }

            shiftSelectedDate = dateVal;
            saveData();
            renderShiftCalendar();
            renderShiftDayList();
            updateShiftSummary();
            const modal = document.getElementById("modal-shift-entry");
            if (modal) modal.classList.remove("open");
        });
    }

    // Shift: Bulk Text Import（設定＝テディベアの隣の歯車アイコンから開く）
    const btnCloseShiftBulk = document.getElementById("btn-close-shift-bulk");
    if (btnCloseShiftBulk) {
        btnCloseShiftBulk.addEventListener("click", () => {
            const modal = document.getElementById("modal-shift-bulk");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnShiftBulkSample = document.getElementById("btn-shift-bulk-sample");
    if (btnShiftBulkSample) {
        btnShiftBulkSample.addEventListener("click", () => {
            const input = document.getElementById("shift-bulk-input");
            if (!input) return;
            const mm = String(shiftCalendarMonth + 1).padStart(2, "0");
            input.value = `${mm}/04, 17:30, 23:30; ${mm}/05, 22:00, 29:00; ${mm}/12, 21:00, 29:00`;
        });
    }

    const btnShiftBulkParse = document.getElementById("btn-shift-bulk-parse");
    if (btnShiftBulkParse) {
        btnShiftBulkParse.addEventListener("click", () => {
            const input = document.getElementById("shift-bulk-input");
            if (!input) return;
            const text = input.value.trim();
            if (!text) { notify("文字列を入力してください"); return; }

            const shifts = getSharedShifts();
            const blocks = text.split(";");
            let successCount = 0;

            blocks.forEach(block => {
                if (!block.trim()) return;
                const tokens = block.split(",").map(t => t.trim());
                if (tokens.length < 3) return;
                const match = tokens[0].match(/^(\d{1,2})\/(\d{1,2})$/);
                if (!match) return;
                const m = match[1].padStart(2, "0");
                const d = match[2].padStart(2, "0");
                const dateStr = `${shiftCalendarYear}-${m}-${d}`;
                if (!shifts[dateStr]) shifts[dateStr] = [];
                shifts[dateStr].push({
                    id: generateShiftId(),
                    title: "一括登録シフト",
                    start: tokens[1],
                    end: tokens[2],
                    userId: appData.currentOperator
                });
                successCount++;
            });

            if (successCount > 0) {
                saveData();
                input.value = "";
                renderShiftCalendar();
                renderShiftDayList();
                updateShiftSummary();
                const modal = document.getElementById("modal-shift-bulk");
                if (modal) modal.classList.remove("open");
                notify(`${successCount}件のシフトを一括登録しました`);
            } else {
                notify("パースに失敗しました。書式を確認してください（例：6/04, 17:30, 23:30）");
            }
        });
    }

}

// ==========================================
// 11. 基本設定モーダル（プロフィール + 表示設定）UI
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

    const linkedMeal = pay.mealId ? (appData.mealLogs || []).find(m => m.id === pay.mealId) : null;
    setPayMealLink(!!linkedMeal, linkedMeal ? linkedMeal.type : "meal",
        linkedMeal && linkedMeal.memo !== pay.title ? linkedMeal.memo : "");
    updateCalculatedAmount();
    validatePaymentInput();
    if (modalPayment) modalPayment.classList.add("open");
};

// 支払いを複製：内容を引き継いだ「新規」入力画面を開く（保存するまで記録されない）
window.duplicatePayment = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;

    duplicateOwnerId = pay.userId;

    const titleEl = document.getElementById("payment-modal-title");
    const editIdEl = document.getElementById("pay-edit-id");
    const titleInput = document.getElementById("pay-title");
    const amountInput = document.getElementById("pay-amount");
    const dateInput = document.getElementById("pay-date");
    const ratioInput = document.getElementById("pay-ratio");
    const memoInput = document.getElementById("pay-memo");
    const modalPayment = document.getElementById("modal-payment-entry");

    if (titleEl) titleEl.innerText = "支払いを複製";
    if (editIdEl) editIdEl.value = "";
    if (titleInput) titleInput.value = pay.title;
    if (amountInput) amountInput.value = pay.amount;
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
    if (ratioInput) ratioInput.value = pay.ratio;
    if (memoInput) memoInput.value = pay.memo || "";

    setPayMealLink(false, "meal");
    updateCalculatedAmount();
    validatePaymentInput();
    if (modalPayment) modalPayment.classList.add("open");
};

window.deletePayment = async function(id) {
    if (await confirmDelete("この支出を削除しますか？", [{ icon: "delete_outline", text: "この支出を履歴から削除します。" }])) {
        const pay = appData.payments.find(p => p.id === id);
        appData.payments = appData.payments.filter(p => p.id !== id);
        if (pay && pay.date) {
            const m = pay.date.slice(0, 7);
            if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};
            appData.monthlyConfirmations[m] = { 1: false, 2: false };
        }
        saveData(); initApp();
    }
};

// 記録者（誰としての記録か）をもう一人のユーザーに変更する
window.changePaymentOwner = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;
    if (!appData.monthlyConfirmations) appData.monthlyConfirmations = {};

    pay.userId = pay.userId === 1 ? 2 : 1;
    // 精算額が変わるため、その月の確認状態をリセットする
    if (pay.date) appData.monthlyConfirmations[pay.date.slice(0, 7)] = { 1: false, 2: false };

    saveData();
    initApp(); // タイムライン・精算・履歴をまとめて再描画
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

// 基本設定を開く（オンボーディングではない、通常の設定アクセス）
function openBasicSettings() {
    const titleEl = document.getElementById("modal-profile-title");
    const subtitleEl = document.getElementById("modal-profile-subtitle");
    const saveBtn = document.getElementById("btn-save-profile");
    if (titleEl) titleEl.innerText = "基本設定";
    if (subtitleEl) subtitleEl.innerText = "";
    if (saveBtn) saveBtn.innerText = "保存して閉じる";

    [1, 2].forEach(type => {
        const nameInput = document.getElementById(`edit-name-${type}`);
        if (nameInput) nameInput.value = appData.users[type].name || "";
        const labelEl = document.getElementById(`user-edit-block-label-${type}`);
        if (labelEl) labelEl.innerText = appData.users[type].name || `ユーザー${type}`;
        updateAvatarPreview(type);
    });

    switchSettingsTab("basic");

    const modal = document.getElementById("modal-profile");
    if (modal) {
        modal.classList.add("fullpage");
        modal.classList.add("open");
    }
}

// 基本設定モーダル内のタブ切り替え（基本情報 / 表示設定）
// 記録保存タブ：件数と最終書き出し日時
function renderBackupPanel() {
    const statsEl = document.getElementById("backup-stats");
    if (!statsEl) return;
    const shiftCount = Object.keys(appData.shiftsData || {}).reduce((n, d) => n + (appData.shiftsData[d] || []).length, 0);
    const stats = [
        ["支払い", (appData.payments || []).length],
        ["やること", (appData.shoppingList || []).length],
        ["冷蔵庫", (appData.fridgeItems || []).length],
        ["掃除", (appData.cleaningItems || []).length],
        ["シフト", shiftCount],
        ["飲食日記", (appData.mealLogs || []).length]
    ];
    statsEl.innerHTML = stats.map(([label, n]) => `<div class="backup-stat"><strong>${n}</strong><span>${label}</span></div>`).join("");

    const meta = document.getElementById("backup-meta");
    if (meta) {
        if (appData.lastBackupAt) {
            const d = new Date(appData.lastBackupAt);
            meta.textContent = isNaN(d.getTime()) ? "" : `最後に書き出した日時：${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } else {
            meta.textContent = "まだ書き出していません";
        }
    }
}

window.switchSettingsTab = function(tabName) {
    const tabBasic = document.getElementById("modal-tab-basic");
    const tabDisplay = document.getElementById("modal-tab-display");
    const tabData = document.getElementById("modal-tab-data");
    const panelBasic = document.getElementById("panel-basic-info");
    const panelDisplay = document.getElementById("panel-display");
    const panelData = document.getElementById("panel-data");
    const footer = document.getElementById("modal-profile-footer");

    if (tabBasic) tabBasic.classList.toggle("active", tabName === "basic");
    if (tabDisplay) tabDisplay.classList.toggle("active", tabName === "display");
    if (tabData) tabData.classList.toggle("active", tabName === "data");
    if (panelBasic) panelBasic.style.display = tabName === "basic" ? "block" : "none";
    if (panelDisplay) panelDisplay.style.display = tabName === "display" ? "block" : "none";
    if (panelData) panelData.style.display = tabName === "data" ? "block" : "none";
    // 記録保存タブは操作ごとに即実行されるので「保存して閉じる」は出さない
    if (footer) footer.style.display = tabName === "data" ? "none" : "";

    if (tabName === "data") renderBackupPanel();

    if (tabName === "display") {
        syncDarkModeCheckbox();
        renderFontOptions();
        renderFontSizeOptions();
        renderThemeOptions();
    }
};

// オンボーディング時：ユーザー1→2の順に1人ずつ表示するステップ切り替え
function switchProfileEditor(type) {
    activeEditorUser = type;
    document.querySelectorAll(".user-edit-block").forEach(el => {
        el.classList.toggle("active", parseInt(el.getAttribute("data-user")) === type);
    });

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
    }

    const editNameInput = document.getElementById(`edit-name-${type}`);
    if (editNameInput) editNameInput.value = appData.users[type].name;
    updateAvatarPreview(type);
}

function updateAvatarPreview(type) {
    if (type !== 1 && type !== 2) return;
    const preview = document.getElementById(`user-avatar-preview-${type}`);
    const btnRemove = document.getElementById(`btn-remove-photo-${type}`);
    if (!preview) return;

    const user = appData.users[type];
    const nameInput = document.getElementById(`edit-name-${type}`);
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

// ==========================================
// 12. SHIFT MANAGEMENT（らくらくシフト統合／ユーザーA・B共有カレンダー）
// ==========================================
let shiftCalendarYear = new Date().getFullYear();
let shiftCalendarMonth = new Date().getMonth();
let shiftSelectedDate = formatShiftDateKey(new Date());

function formatShiftDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateShiftId() {
    return `s${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

// シフトは操作中のユーザーに関わらず、ユーザーA・B共通の1つのカレンダーに保存される
function getSharedShifts() {
    if (!appData.shiftsData) appData.shiftsData = {};
    return appData.shiftsData;
}

// id からシフトを1件検索（どの日付に属しているかも合わせて返す）
function findSharedShiftById(id) {
    const shifts = getSharedShifts();
    for (const dateStr of Object.keys(shifts)) {
        const found = (shifts[dateStr] || []).find(s => s.id === id);
        if (found) return { shift: found, dateStr };
    }
    return null;
}

function renderShiftCalendar() {
    const grid = document.getElementById("shift-calendar-grid");
    const label = document.getElementById("shift-calendar-label");
    if (!grid) return;
    grid.innerHTML = "";

    if (label) label.textContent = `${shiftCalendarYear}年 ${shiftCalendarMonth + 1}月`;

    const firstDayIndex = new Date(shiftCalendarYear, shiftCalendarMonth, 1).getDay();
    const totalDays = new Date(shiftCalendarYear, shiftCalendarMonth + 1, 0).getDate();
    const prevMonthTotalDays = new Date(shiftCalendarYear, shiftCalendarMonth, 0).getDate();
    const sharedShifts = getSharedShifts();

    for (let i = firstDayIndex; i > 0; i--) {
        const cell = document.createElement("div");
        cell.className = "calendar-cell pad";
        cell.innerHTML = `<div>${prevMonthTotalDays - i + 1}</div>`;
        grid.appendChild(cell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${shiftCalendarYear}-${String(shiftCalendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isSelected = dateStr === shiftSelectedDate;
        const cell = document.createElement("div");
        const dayKind = getDayKindClass(new Date(shiftCalendarYear, shiftCalendarMonth, day));
        cell.className = `calendar-cell${isSelected ? " selected" : ""}${dayKind ? " " + dayKind : ""}`;
        cell.innerHTML = `<div>${day}</div>`;

        const dayShifts = (sharedShifts[dateStr] || []).slice().sort((a, b) => a.start.localeCompare(b.start));
        if (dayShifts.length > 0) {
            const chipList = document.createElement("div");
            chipList.className = "shift-chip-list";
            dayShifts.slice(0, 2).forEach(s => {
                const chip = document.createElement("div");
                chip.className = "shift-chip";
                chip.innerHTML = `${s.start}<br>${s.end}`;
                chipList.appendChild(chip);
            });
            if (dayShifts.length > 2) {
                const more = document.createElement("div");
                more.className = "shift-chip";
                more.textContent = `+${dayShifts.length - 2}`;
                chipList.appendChild(more);
            }
            cell.appendChild(chipList);
        }

        cell.onclick = () => {
            shiftSelectedDate = dateStr;
            renderShiftCalendar();
            renderShiftDayList();
        };
        grid.appendChild(cell);
    }
}

function renderShiftDayList() {
    const container = document.getElementById("shift-day-timeline");
    const labelEl = document.getElementById("shift-selected-date-label");
    if (!container) return;

    if (labelEl) {
        labelEl.textContent = shiftSelectedDate ? `${formatDateLabel(shiftSelectedDate)} のシフト` : "";
        labelEl.classList.remove("is-sun", "is-sat", "is-holiday");
        const selDate = shiftSelectedDate ? parseSafeDate(shiftSelectedDate) : null;
        const kind = selDate && !isNaN(selDate.getTime()) ? getDayKindClass(selDate) : "";
        if (kind) labelEl.classList.add(kind);
    }
    container.innerHTML = "";

    const sharedShifts = getSharedShifts();
    const dayShifts = (sharedShifts[shiftSelectedDate] || []).slice().sort((a, b) => a.start.localeCompare(b.start));

    if (dayShifts.length === 0) {
        container.innerHTML = `<p class="empty-hint">この日の予定はありません</p>`;
        return;
    }

    dayShifts.forEach(shift => {
        const row = document.createElement("div");
        row.className = "entry-row";
        row.innerHTML = `
            <span class="material-icons-round cleaning-entry-icon">schedule</span>
            <div class="entry-main">
                <div class="entry-top">
                    <span class="entry-title">${shift.title ? escapeHtml(shift.title) : "シフト"}</span>
                    <span class="entry-amount cleaning-entry-date">${shift.start} 〜 ${shift.end}</span>
                </div>
                <div class="entry-sub">
                    <span class="entry-sub-left"></span>
                    <div class="entry-actions">
                        <span class="material-icons-round entry-icon-btn" onclick="editShiftEntry('${shift.id}')">edit</span>
                        <span class="material-icons-round entry-icon-btn danger" onclick="deleteShiftEntry('${shift.id}')">delete</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateShiftSummary() {
    const countEl = document.getElementById("shift-summary-count");
    const hoursEl = document.getElementById("shift-summary-hours");
    if (!countEl || !hoursEl) return;

    const sharedShifts = getSharedShifts();
    let totalShifts = 0;
    let totalMinutes = 0;

    Object.keys(sharedShifts).forEach(dateStr => {
        const [y, m] = dateStr.split("-").map(Number);
        if (y === shiftCalendarYear && (m - 1) === shiftCalendarMonth) {
            const dayShifts = sharedShifts[dateStr];
            totalShifts += dayShifts.length;
            dayShifts.forEach(s => {
                const [sh, sm] = s.start.split(":").map(Number);
                const [eh, em] = s.end.split(":").map(Number);
                if ([sh, sm, eh, em].some(n => isNaN(n))) return;
                let startTotal = sh * 60 + sm;
                let endTotal = eh * 60 + em;
                if (endTotal < startTotal) endTotal += 24 * 60;
                totalMinutes += (endTotal - startTotal);
            });
        }
    });

    countEl.textContent = `${totalShifts}回`;
    hoursEl.textContent = (totalMinutes / 60).toFixed(1).replace(".0", "");
}

function renderShiftTab() {
    const ownerLabelEl = document.getElementById("shift-owner-label");
    if (ownerLabelEl) ownerLabelEl.textContent = "";
    renderShiftCalendar();
    renderShiftDayList();
    updateShiftSummary();
}

window.editShiftEntry = function(id) {
    const found = findSharedShiftById(id);
    if (!found) return;
    const target = found.shift;

    const titleEl = document.getElementById("shift-entry-modal-title");
    const editIdEl = document.getElementById("shift-edit-id");
    const dateEl = document.getElementById("shift-date");
    const titleInput = document.getElementById("shift-title");
    const startInput = document.getElementById("shift-start");
    const endInput = document.getElementById("shift-end");
    const modal = document.getElementById("modal-shift-entry");

    if (titleEl) titleEl.innerText = "シフトを編集";
    if (editIdEl) editIdEl.value = id;
    if (dateEl) dateEl.value = found.dateStr;
    if (titleInput) titleInput.value = target.title || "";
    if (startInput) startInput.value = target.start;
    if (endInput) endInput.value = target.end;
    if (modal) modal.classList.add("open");
};

window.deleteShiftEntry = async function(id) {
    if (!(await confirmDelete("このシフトを削除しますか？", [{ icon: "delete_outline", text: "このシフトをカレンダーから削除します。" }]))) return;
    const shifts = getSharedShifts();
    Object.keys(shifts).forEach(dateStr => {
        shifts[dateStr] = shifts[dateStr].filter(s => s.id !== id);
    });
    saveData();
    renderShiftCalendar();
    renderShiftDayList();
    updateShiftSummary();
};

// ==========================================
// 13. 金額入力用 電卓（家計簿アプリ風）
// 支払い金額・一部支払い金額の入力欄をタップすると、この電卓モーダルが開く。
// フォントはグローバルの --app-font 設定にそのまま従う。
// ==========================================
let calcTargetInputId = null;
let calcDisplayValue = "0";
let calcStoredValue = null;
let calcPendingOperator = null;
let calcWaitingForOperand = false;

function calcFormatNumber(numStr) {
    if (numStr === "" || numStr === "-") return numStr;
    const neg = numStr.startsWith("-");
    let s = neg ? numStr.slice(1) : numStr;
    let parts = s.split(".");
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    let result = intPart + (parts.length > 1 ? "." + parts[1] : "");
    return (neg ? "-" : "") + result;
}

function calcUpdateDisplay() {
    const displayEl = document.getElementById("calculator-display");
    if (displayEl) displayEl.textContent = calcFormatNumber(calcDisplayValue);
}

function calcApplyOperator(a, b, op) {
    switch (op) {
        case "+": return a + b;
        case "-": return a - b;
        case "×": return a * b;
        case "÷": return b === 0 ? 0 : a / b;
        default: return b;
    }
}

// 金額入力欄をタップしたときに呼ばれる：現在値を初期値にして電卓を開く
window.openAmountCalculator = function(targetInputId) {
    calcTargetInputId = targetInputId;
    calcStoredValue = null;
    calcPendingOperator = null;
    calcWaitingForOperand = false;

    const targetInput = document.getElementById(targetInputId);
    const currentRaw = targetInput ? String(targetInput.value).replace(/[^\d.\-]/g, "") : "";
    calcDisplayValue = currentRaw && currentRaw !== "0" && currentRaw !== "" ? currentRaw : "0";

    const titleEl = document.getElementById("calculator-modal-title");
    if (titleEl) {
        const labelEl = targetInput ? targetInput.closest(".form-group")?.querySelector("label") : null;
        titleEl.innerText = labelEl ? labelEl.textContent.replace(/\s*\(.*\)\s*/, "") : "金額を入力";
    }

    calcUpdateDisplay();

    const modal = document.getElementById("modal-calculator");
    if (modal) modal.classList.add("open");
};

function calcInputDigit(digit) {
    if (calcWaitingForOperand) {
        calcDisplayValue = digit;
        calcWaitingForOperand = false;
    } else {
        calcDisplayValue = calcDisplayValue === "0" ? digit : calcDisplayValue + digit;
    }
    calcUpdateDisplay();
}

function calcInputDecimal() {
    if (calcWaitingForOperand) {
        calcDisplayValue = "0.";
        calcWaitingForOperand = false;
        calcUpdateDisplay();
        return;
    }
    if (!calcDisplayValue.includes(".")) {
        calcDisplayValue += ".";
        calcUpdateDisplay();
    }
}

function calcClear() {
    calcDisplayValue = "0";
    calcStoredValue = null;
    calcPendingOperator = null;
    calcWaitingForOperand = false;
    calcUpdateDisplay();
}

function calcClearEntry() {
    calcDisplayValue = "0";
    calcUpdateDisplay();
}

function calcBackspace() {
    if (calcWaitingForOperand) return;
    if (calcDisplayValue.length <= 1 || (calcDisplayValue.length === 2 && calcDisplayValue.startsWith("-"))) {
        calcDisplayValue = "0";
    } else {
        calcDisplayValue = calcDisplayValue.slice(0, -1);
    }
    calcUpdateDisplay();
}

function calcPerformOperation(nextOperator) {
    const inputValue = parseFloat(calcDisplayValue) || 0;

    if (calcStoredValue === null) {
        calcStoredValue = inputValue;
    } else if (calcPendingOperator && !calcWaitingForOperand) {
        const result = calcApplyOperator(calcStoredValue, inputValue, calcPendingOperator);
        calcStoredValue = result;
        calcDisplayValue = String(Math.round(result * 100) / 100);
    }

    calcWaitingForOperand = true;
    calcPendingOperator = nextOperator;
    calcUpdateDisplay();
}

function calcEquals() {
    if (calcPendingOperator === null || calcStoredValue === null) return;
    const inputValue = parseFloat(calcDisplayValue) || 0;
    const result = calcApplyOperator(calcStoredValue, inputValue, calcPendingOperator);
    calcDisplayValue = String(Math.round(result * 100) / 100);
    calcStoredValue = null;
    calcPendingOperator = null;
    calcWaitingForOperand = true;
    calcUpdateDisplay();
}

// 「確定する」：現在の電卓の値を対象の入力欄に反映し、元のバリデーション処理も発火させる
function calcConfirm() {
    if (!calcTargetInputId) return;
    const targetInput = document.getElementById(calcTargetInputId);
    if (targetInput) {
        const val = Math.round(parseFloat(calcDisplayValue) || 0);
        targetInput.value = val;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const modal = document.getElementById("modal-calculator");
    if (modal) modal.classList.remove("open");
}

function initCalculator() {
    const grid = document.querySelector(".calculator-grid");
    if (grid && grid.dataset.calcBound !== "1") {
        grid.dataset.calcBound = "1";
        grid.addEventListener("click", (e) => {
            const btn = e.target.closest(".calc-btn");
            if (!btn) return;
            const action = btn.getAttribute("data-calc");
            if (action === "digit") calcInputDigit(btn.getAttribute("data-digit"));
            else if (action === "decimal") calcInputDecimal();
            else if (action === "clear") calcClear();
            else if (action === "clear-entry") calcClearEntry();
            else if (action === "backspace") calcBackspace();
            else if (action === "op") calcPerformOperation(btn.getAttribute("data-op"));
            else if (action === "equals") calcEquals();
        });
    }

    const btnClose = document.getElementById("btn-close-calculator");
    if (btnClose) {
        btnClose.addEventListener("click", () => {
            const modal = document.getElementById("modal-calculator");
            if (modal) modal.classList.remove("open");
        });
    }

    const btnConfirm = document.getElementById("btn-confirm-calculator");
    if (btnConfirm) btnConfirm.addEventListener("click", calcConfirm);
}


// ==========================================
// 飲食日記タブ
// 記録：日付・時間・メモ（食べ物やお店の名前）・種類（食事／飲み物／お菓子）
// 週は日曜日はじまり〜土曜日おわり。検索中は全期間から絞り込む。
// ==========================================
const MEAL_TYPES = [
    { key: "meal", label: "食事", icon: "restaurant" },
    { key: "drink", label: "飲み物", icon: "local_cafe" },
    { key: "sweets", label: "お菓子", icon: "cookie" }
];
const MEAL_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

let mealWeekStart = getWeekStart(new Date());
let mealSearchQuery = "";
let mealSelectedType = "meal";

function generateMealId() {
    return `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// その日を含む週の日曜日（0:00）を返す
function getWeekStart(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function getMealType(key) {
    return MEAL_TYPES.find(t => t.key === key) || MEAL_TYPES[0];
}

function renderMealTab() {
    renderMealWeekHeader();
    renderMealList();
}

function renderMealWeekHeader() {
    const nav = document.getElementById("meal-week-nav");
    const sub = document.getElementById("meal-week-sub");
    const strip = document.getElementById("meal-week-strip");
    if (!nav || !strip) return;

    const searching = mealSearchQuery.trim() !== "";
    nav.style.display = searching ? "none" : "";
    if (sub) sub.style.display = searching ? "none" : "";
    strip.style.display = searching ? "none" : "";
    if (searching) return;

    const end = new Date(mealWeekStart);
    end.setDate(end.getDate() + 6);
    const sameYear = mealWeekStart.getFullYear() === end.getFullYear();
    document.getElementById("meal-week-year").textContent =
        sameYear ? `${mealWeekStart.getFullYear()}年` : `${mealWeekStart.getFullYear()}年 – ${end.getFullYear()}年`;
    document.getElementById("meal-week-range").textContent =
        `${mealWeekStart.getMonth() + 1}/${mealWeekStart.getDate()} (日) – ${end.getMonth() + 1}/${end.getDate()} (土)`;

    const isThisWeek = toDateStr(mealWeekStart) === toDateStr(getWeekStart(new Date()));
    document.getElementById("btn-meal-this-week").style.visibility = isThisWeek ? "hidden" : "visible";

    const todayStr = toDateStr(new Date());
    const counts = {};
    (appData.mealLogs || []).forEach(m => { counts[m.date] = (counts[m.date] || 0) + 1; });

    let h = "";
    for (let i = 0; i < 7; i++) {
        const d = new Date(mealWeekStart);
        d.setDate(d.getDate() + i);
        const ds = toDateStr(d);
        h += `
            <div class="meal-strip-day ${ds === todayStr ? "today" : ""} ${getDayKindClass(d)}">
                <span class="meal-strip-wd">${MEAL_WEEKDAYS[i]}</span>
                <span class="meal-strip-date">${d.getDate()}</span>
                <span class="meal-strip-dot ${counts[ds] ? "on" : ""}"></span>
            </div>`;
    }
    strip.innerHTML = h;
}

function renderMealList() {
    const list = document.getElementById("meal-list");
    const info = document.getElementById("meal-result-info");
    const clearBtn = document.getElementById("btn-meal-search-clear");
    if (!list) return;

    const q = mealSearchQuery.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = q ? "flex" : "none";

    let logs = (appData.mealLogs || []).slice();
    let emptyIcon = "restaurant_menu";
    let emptyText = "この週の記録はありません";

    if (q) {
        logs = logs.filter(m => {
            const t = getMealType(m.type);
            return (m.memo || "").toLowerCase().includes(q) || t.label.includes(q) || (m.date || "").includes(q);
        });
        emptyIcon = "search_off";
        emptyText = "見つかりませんでした";
        if (info) { info.style.display = ""; info.textContent = `検索結果 ${logs.length}件`; }
    } else {
        const startStr = toDateStr(mealWeekStart);
        const endD = new Date(mealWeekStart); endD.setDate(endD.getDate() + 6);
        const endStr = toDateStr(endD);
        logs = logs.filter(m => m.date >= startStr && m.date <= endStr);
        if (info) info.style.display = "none";
    }

    if (logs.length === 0) {
        list.innerHTML = `
            <div class="meal-empty">
                <span class="material-icons-round">${emptyIcon}</span>
                <p>${emptyText}</p>
                ${q ? "" : '<small>右下の＋から記録しましょう</small>'}
            </div>`;
        return;
    }

    // 検索中は新しい順、週表示は日曜→土曜
    const byDate = {};
    logs.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    const dates = Object.keys(byDate).sort();
    if (q) dates.reverse();

    const todayStr = toDateStr(new Date());
    list.innerHTML = dates.map(ds => {
        const d = parseSafeDate(ds);
        const items = byDate[ds].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        if (q) items.reverse();
        const label = `${d.getMonth() + 1}/${d.getDate()} (${MEAL_WEEKDAYS[d.getDay()]})`;
        return `
            <div class="meal-day" id="meal-day-${ds}">
                <div class="meal-day-header ${ds === todayStr ? "today" : ""} ${getDayKindClass(d)}">
                    <span>${label}${ds === todayStr ? '<em>今日</em>' : ""}</span>
                    <small>${items.length}件</small>
                </div>
                ${items.map(m => {
                    const t = getMealType(m.type);
                    return `
                    <div class="meal-entry" onclick="openMealEditor('${escapeHtml(m.id)}')">
                        <span class="meal-entry-time">${escapeHtml(m.time || "--:--")}</span>
                        <span class="meal-entry-icon type-${t.key}"><span class="material-icons-round">${t.icon}</span></span>
                        <div class="meal-entry-main">
                            <span class="meal-entry-memo">${escapeHtml(m.memo)}</span>
                        </div>
                        <span class="material-icons-round meal-entry-chevron">chevron_right</span>
                    </div>`;
                }).join("")}
            </div>`;
    }).join("");
}

window.scrollToMealDay = function(ds) {
    const el = document.getElementById(`meal-day-${ds}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

function shiftMealWeek(delta) {
    mealWeekStart = new Date(mealWeekStart.getFullYear(), mealWeekStart.getMonth(), mealWeekStart.getDate() + delta * 7);
    renderMealTab();
}

function selectMealType(key) {
    mealSelectedType = key;
    document.querySelectorAll("#meal-type-picker .meal-type-btn").forEach(b => {
        b.classList.toggle("selected", b.getAttribute("data-type") === key);
    });
    renderMealMemoSuggest();
}

// メモ入力欄の下：選んだ種類の最近使ったメモ（15個）
function renderMealMemoSuggest() {
    const wrap = document.getElementById("meal-memo-suggest");
    const box = document.getElementById("meal-memo-suggest-chips");
    const memoEl = document.getElementById("meal-memo");
    if (!wrap || !box || !memoEl) return;
    const recent = getRecentMealMemos(15, mealSelectedType);
    wrap.style.display = recent.length ? "" : "none";
    const cur = memoEl.value.trim();
    box.innerHTML = recent.map(t => `<button type="button" class="title-chip${t === cur ? " selected" : ""}" data-memo="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
    box.querySelectorAll(".title-chip").forEach(c => {
        c.addEventListener("click", () => {
            memoEl.value = c.getAttribute("data-memo");
            memoEl.dispatchEvent(new Event("input", { bubbles: true }));
        });
    });
}

function validateMealInput() {
    const btn = document.getElementById("btn-save-meal");
    if (!btn) return;
    const ok = document.getElementById("meal-date").value &&
               document.getElementById("meal-time").value &&
               document.getElementById("meal-memo").value.trim();
    btn.disabled = !ok;
}

function openMealModal(m) {
    const now = new Date();
    document.getElementById("meal-modal-title").textContent = m ? "記録を編集" : "記録を追加";
    document.getElementById("meal-edit-id").value = m ? m.id : "";
    // 追加時は、表示中の週に今日が含まれていれば今日、含まれていなければその週の日曜日を初期値にする
    const todayInWeek = toDateStr(getWeekStart(now)) === toDateStr(mealWeekStart);
    document.getElementById("meal-date").value = m ? m.date : (todayInWeek ? toDateStr(now) : toDateStr(mealWeekStart));
    document.getElementById("meal-time").value = m ? m.time : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    document.getElementById("meal-memo").value = m ? m.memo : "";
    selectMealType(m ? m.type : "meal");
    document.getElementById("btn-delete-meal").style.display = m ? "" : "none";
    document.getElementById("btn-save-meal").textContent = m ? "保存する" : "記録する";
    validateMealInput();
    document.getElementById("modal-meal-entry").classList.add("open");
}

window.openMealEditor = function(id) {
    const m = (appData.mealLogs || []).find(x => String(x.id) === String(id));
    if (m) openMealModal(m);
};

function initMealDiary() {
    const q = document.getElementById("meal-search");
    if (q) {
        q.addEventListener("input", () => {
            mealSearchQuery = q.value;
            renderMealTab();
        });
    }
    const clear = document.getElementById("btn-meal-search-clear");
    if (clear) clear.addEventListener("click", () => {
        q.value = "";
        mealSearchQuery = "";
        renderMealTab();
        q.focus();
    });

    const prev = document.getElementById("btn-meal-prev-week");
    const next = document.getElementById("btn-meal-next-week");
    const cur = document.getElementById("btn-meal-this-week");
    if (prev) prev.addEventListener("click", () => shiftMealWeek(-1));
    if (next) next.addEventListener("click", () => shiftMealWeek(1));
    if (cur) cur.addEventListener("click", () => { mealWeekStart = getWeekStart(new Date()); renderMealTab(); });

    // 左右スワイプで週を移動
    const panel = document.getElementById("tab-meal");
    if (panel) {
        let sx = 0, sy = 0;
        panel.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        panel.addEventListener("touchend", (e) => {
            if (mealSearchQuery.trim()) return;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMealWeek(dx < 0 ? 1 : -1);
        }, { passive: true });
    }

    const btnCloseMeal = document.getElementById("btn-close-meal-entry");
    if (btnCloseMeal) btnCloseMeal.addEventListener("click", () => {
        document.getElementById("modal-meal-entry").classList.remove("open");
    });

    const fab = document.getElementById("fab-add-meal");
    if (fab) fab.addEventListener("click", () => openMealModal(null));

    document.querySelectorAll("#meal-type-picker .meal-type-btn").forEach(b => {
        b.addEventListener("click", () => selectMealType(b.getAttribute("data-type")));
    });
    ["meal-date", "meal-time", "meal-memo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.addEventListener("input", validateMealInput); el.addEventListener("change", validateMealInput); }
    });
    const mealMemoEl = document.getElementById("meal-memo");
    if (mealMemoEl) mealMemoEl.addEventListener("input", renderMealMemoSuggest);

    const save = document.getElementById("btn-save-meal");
    if (save) save.addEventListener("click", () => {
        const editId = document.getElementById("meal-edit-id").value;
        const data = {
            date: document.getElementById("meal-date").value,
            time: document.getElementById("meal-time").value,
            memo: document.getElementById("meal-memo").value.trim(),
            type: mealSelectedType
        };
        if (!data.date || !data.time || !data.memo) return;
        if (editId) {
            const ex = appData.mealLogs.find(x => String(x.id) === editId);
            if (ex) Object.assign(ex, data);
        } else {
            appData.mealLogs.push(Object.assign({ id: generateMealId() }, data));
        }
        saveData();
        // 保存した日の週へ移動して表示
        if (!mealSearchQuery.trim()) mealWeekStart = getWeekStart(parseSafeDate(data.date));
        document.getElementById("modal-meal-entry").classList.remove("open");
        renderMealTab();
    });

    const del = document.getElementById("btn-delete-meal");
    if (del) del.addEventListener("click", async () => {
        const editId = document.getElementById("meal-edit-id").value;
        const m = appData.mealLogs.find(x => String(x.id) === editId);
        if (!m) return;
        const ok = await confirmDelete("この記録を削除しますか？", [
            { icon: "delete_outline", text: `「${m.memo}」を飲食日記から削除します。` }
        ]);
        if (!ok) return;
        appData.mealLogs = appData.mealLogs.filter(x => String(x.id) !== editId);
        saveData();
        document.getElementById("modal-meal-entry").classList.remove("open");
        renderMealTab();
    });
}


// ==========================================
// ヘッダーの日付表示（祝日は赤・土曜は青）
// ==========================================
const _holidayCache = {};

// 日本の祝日（振替休日・国民の休日を含む）。YYYY-MM-DD → 祝日名
function getJapaneseHolidays(y) {
    if (_holidayCache[y]) return _holidayCache[y];
    const map = {};
    const key = (m, d) => toDateStr(new Date(y, m - 1, d));
    const add = (m, d, name) => { map[key(m, d)] = name; };
    const nthMonday = (m, n) => {
        const first = new Date(y, m - 1, 1).getDay();
        return 1 + ((1 - first + 7) % 7) + (n - 1) * 7;
    };

    add(1, 1, "元日");
    if (y >= 2000) add(1, nthMonday(1, 2), "成人の日"); else add(1, 15, "成人の日");
    if (y >= 1967) add(2, 11, "建国記念の日");
    if (y >= 2020) add(2, 23, "天皇誕生日"); else if (y >= 1989 && y <= 2018) add(12, 23, "天皇誕生日");
    add(3, Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)), "春分の日");
    add(4, 29, y >= 2007 ? "昭和の日" : "みどりの日");
    add(5, 3, "憲法記念日");
    if (y >= 2007) add(5, 4, "みどりの日");
    add(5, 5, "こどもの日");
    if (y === 2019) { add(5, 1, "休日（即位の日）"); add(10, 22, "休日（即位礼正殿の儀）"); }
    if (y === 2020) add(7, 23, "海の日");
    else if (y === 2021) add(7, 22, "海の日");
    else if (y >= 2003) add(7, nthMonday(7, 3), "海の日");
    if (y === 2020) add(8, 10, "山の日");
    else if (y === 2021) add(8, 8, "山の日");
    else if (y >= 2016) add(8, 11, "山の日");
    if (y >= 2003) add(9, nthMonday(9, 3), "敬老の日"); else add(9, 15, "敬老の日");
    add(9, Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)), "秋分の日");
    if (y === 2020) add(7, 24, "スポーツの日");
    else if (y === 2021) add(7, 23, "スポーツの日");
    else if (y >= 2022) add(10, nthMonday(10, 2), "スポーツの日");
    else if (y >= 2000) add(10, nthMonday(10, 2), "体育の日");
    add(11, 3, "文化の日");
    add(11, 23, "勤労感謝の日");

    // 国民の休日：前日と翌日が祝日に挟まれた平日
    const base = Object.assign({}, map);
    for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 31; d++) {
            const dt = new Date(y, m - 1, d);
            if (dt.getMonth() !== m - 1) continue;
            const k = toDateStr(dt);
            if (base[k] || dt.getDay() === 0) continue;
            const prev = toDateStr(new Date(y, m - 1, d - 1));
            const next = toDateStr(new Date(y, m - 1, d + 1));
            if (base[prev] && base[next]) map[k] = "国民の休日";
        }
    }
    // 振替休日：日曜が祝日のとき、次の祝日でない日
    Object.keys(Object.assign({}, map)).forEach(k => {
        const dt = parseSafeDate(k);
        if (dt.getDay() !== 0) return;
        const sub = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1);
        while (map[toDateStr(sub)]) sub.setDate(sub.getDate() + 1);
        map[toDateStr(sub)] = "振替休日";
    });

    _holidayCache[y] = map;
    return map;
}

// 日付の種別クラス（祝日 > 日曜 > 土曜）
function getDayKindClass(date) {
    if (getJapaneseHolidayName(date)) return "is-holiday";
    const w = date.getDay();
    if (w === 0) return "is-sun";
    if (w === 6) return "is-sat";
    return "";
}

function getJapaneseHolidayName(date) {
    return getJapaneseHolidays(date.getFullYear())[toDateStr(date)] || null;
}

function updateHeaderDate() {
    const el = document.getElementById("header-date");
    if (!el) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const wd = MEAL_WEEKDAYS[now.getDay()];
    const holiday = getJapaneseHolidayName(now);

    el.classList.toggle("is-holiday", !!holiday);
    el.classList.toggle("is-sunday", !holiday && now.getDay() === 0);
    el.classList.toggle("is-saturday", !holiday && now.getDay() === 6);
    el.innerHTML = `<span>${y}/${m}/${d}(${wd})</span>` + (holiday ? `<span>：${escapeHtml(holiday)}</span>` : "");
}

function initHeaderDate() {
    updateHeaderDate();
    setInterval(updateHeaderDate, 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) updateHeaderDate(); });
}

// ==========================================
// 支払い記録：「何のお金？」選択ページ ＋ 飲食日記への連携
// ==========================================
let payMealLinkOn = false;
let payMealType = "meal";
let payMealMemo = ""; // 候補から選んだメモ（空なら「何のお金？」の内容で記録）
const MEAL_TYPE_LABEL = { meal: "食事", drink: "飲み物", sweets: "お菓子" };

// 種類ごとの最近使ったメモ（新しい順・重複なし）
function getRecentMealMemos(limit, type) {
    const key = m => `${m.date || ""} ${m.time || ""}`;
    const logs = (appData.mealLogs || [])
        .filter(m => !type || m.type === type)
        .sort((a, b) => key(b).localeCompare(key(a)));
    const seen = new Set();
    const out = [];
    for (const m of logs) {
        const t = String(m.memo || "").trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
        if (out.length >= limit) break;
    }
    return out;
}

function renderPayMealMemoChips() {
    const wrap = document.getElementById("pay-meal-memo-wrap");
    const box = document.getElementById("pay-meal-memo-chips");
    if (!wrap || !box) return;
    if (!payMealLinkOn) { wrap.style.display = "none"; return; }
    wrap.style.display = "";
    const label = document.getElementById("pay-meal-memo-label");
    if (label) label.textContent = `最近使った（${MEAL_TYPE_LABEL[payMealType] || ""}）`;

    const recent = getRecentMealMemos(10, payMealType);
    box.innerHTML = recent.length
        ? recent.map(t => `<button type="button" class="title-chip${t === payMealMemo ? " selected" : ""}" data-memo="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")
        : '<p class="meal-memo-empty">まだ履歴がありません</p>';
    box.querySelectorAll(".title-chip").forEach(c => {
        c.addEventListener("click", () => {
            const v = c.getAttribute("data-memo");
            payMealMemo = payMealMemo === v ? "" : v; // もう一度タップで選択解除
            renderPayMealMemoChips();
        });
    });
}

function setPayMealLink(on, type, memo) {
    payMealLinkOn = !!on;
    payMealType = type || "meal";
    payMealMemo = payMealLinkOn ? (memo || "") : "";
    renderPayMealMemoChips();
    const card = document.getElementById("meal-link-card");
    if (card) card.classList.toggle("on", payMealLinkOn);
    const current = payMealLinkOn ? payMealType : "";
    document.querySelectorAll("#pay-meal-type-picker .seg-btn").forEach(b => {
        b.classList.toggle("selected", b.getAttribute("data-type") === current);
    });
}

// 最近使った項目名（新しい順・重複なし）と、よく使う項目名（回数順）
function getRecentPaymentTitles(limit) {
    return getPaymentTitleSuggestions().slice(0, limit);
}

function getFrequentPaymentTitles(limit) {
    const count = {};
    (appData.payments || []).forEach(p => {
        const t = String(p.title || "").trim();
        if (t) count[t] = (count[t] || 0) + 1;
    });
    const recentOrder = getPaymentTitleSuggestions();
    return Object.keys(count)
        .sort((a, b) => count[b] - count[a] || recentOrder.indexOf(a) - recentOrder.indexOf(b))
        .slice(0, limit)
        .map(t => ({ title: t, count: count[t] }));
}

function refreshTitleChipSelection() {
    const val = (document.getElementById("pay-title-free").value || "").trim();
    document.querySelectorAll("#modal-pay-title-picker .title-chip").forEach(c => {
        c.classList.toggle("selected", c.getAttribute("data-title") === val);
    });
    document.getElementById("btn-title-picker-ok").disabled = !val;
}

function openPayTitlePicker() {
    const free = document.getElementById("pay-title-free");
    free.value = document.getElementById("pay-title").value || "";

    const chip = (t, count) => `<button type="button" class="title-chip" data-title="${escapeHtml(t)}">${escapeHtml(t)}${count ? `<em>${count}回</em>` : ""}</button>`;
    const recent = getRecentPaymentTitles(10);
    const frequent = getFrequentPaymentTitles(10);
    const empty = '<p class="title-chip-empty">まだ履歴がありません</p>';
    document.getElementById("title-recent-list").innerHTML = recent.length ? recent.map(t => chip(t)).join("") : empty;
    document.getElementById("title-frequent-list").innerHTML = frequent.length ? frequent.map(f => chip(f.title, f.count)).join("") : empty;

    document.querySelectorAll("#modal-pay-title-picker .title-chip").forEach(c => {
        c.addEventListener("click", () => {
            free.value = c.getAttribute("data-title");
            refreshTitleChipSelection();
        });
    });
    refreshTitleChipSelection();
    document.getElementById("modal-pay-title-picker").classList.add("open");
    const body = document.querySelector("#modal-pay-title-picker .modal-body");
    if (body) body.scrollTop = 0;
}

function initPaymentExtras() {
    const field = document.getElementById("pay-title-field");
    if (field) {
        field.addEventListener("click", openPayTitlePicker);
        field.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPayTitlePicker(); } });
    }
    const free = document.getElementById("pay-title-free");
    if (free) {
        free.addEventListener("input", refreshTitleChipSelection);
        free.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const ok = document.getElementById("btn-title-picker-ok"); if (!ok.disabled) ok.click(); } });
    }
    const close = document.getElementById("btn-close-pay-title-picker");
    if (close) close.addEventListener("click", () => document.getElementById("modal-pay-title-picker").classList.remove("open"));
    const ok = document.getElementById("btn-title-picker-ok");
    if (ok) ok.addEventListener("click", () => {
        const val = free.value.trim();
        if (!val) return;
        const title = document.getElementById("pay-title");
        title.value = val;
        title.dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("modal-pay-title-picker").classList.remove("open");
    });

    document.querySelectorAll("#pay-meal-type-picker .seg-btn").forEach(b => {
        b.addEventListener("click", () => {
            const t = b.getAttribute("data-type");
            if (!t) setPayMealLink(false, payMealType);
            else setPayMealLink(true, t, (payMealLinkOn && t === payMealType) ? payMealMemo : "");
        });
    });
}


// ==========================================
// テーマカラー（背景は白／黒のまま、アクセントと面の色合いを変える）
// light/dark：ボタンや選択中の色（パステル）。on：その上の文字色。text：白地の上の文字・アイコン用の濃い同系色。hue：面・罫線の色味をそろえる色相
// ==========================================
const THEME_OPTIONS = [
    { key: "strawberry", label: "いちごミルク",      hue: 348, light: "#ffc2ce", dark: "#f994a8", on: "#4b1b24", text: "#944252" },
    { key: "lavender",   label: "ラベンダーマカロン",   hue: 266, light: "#e8dcf8", dark: "#c2a5e9", on: "#301b4b", text: "#654294" },
    { key: "peach",      label: "ピーチゼリー",      hue: 23 , light: "#ffdfcb", dark: "#f9bb94", on: "#4b2d1b", text: "#946242" },
    { key: "ocean",      label: "ソーダフロート",     hue: 209, light: "#cbe2f8", dark: "#a0c8ed", on: "#1b344b", text: "#426c94" },
    { key: "pistachio",  label: "ピスタチオ",       hue: 134, light: "#d0ead6", dark: "#b4dabd", on: "#1b4b26", text: "#3a824b" },
    { key: "lemon",      label: "レモンタルト",      hue: 47 , light: "#fff0b8", dark: "#f9e494", on: "#4f4317", text: "#887016" },
    { key: "sakura",     label: "さくらもち",       hue: 345, light: "#fdd1dc", dark: "#f599b0", on: "#4b1b27", text: "#944257" },
    { key: "cloudy",     label: "わたあめ",        hue: 222, light: "#d8e0f2", dark: "#aebde0", on: "#1b2a4b", text: "#425b94" },
    { key: "berry",      label: "ベリーヨーグルト",    hue: 312, light: "#e8bcdf", dark: "#e0aed5", on: "#4b1b41", text: "#944283" },
    { key: "mocha",      label: "モカラテ",        hue: 21 , light: "#e8d0c3", dark: "#ddc0b0", on: "#4b2c1b", text: "#945f42" },
    { key: "mint",       label: "ミントアイス",      hue: 166, light: "#ccebe4", dark: "#b1ddd3", on: "#1b4b40", text: "#397f6f" },
    { key: "candy",      label: "キャンディ",       hue: 341, light: "#fbcfdd", dark: "#f29cb7", on: "#4b1b2a", text: "#94425c" }
];

// 日曜・祝日（sun）と土曜（sat）の色相。各テーマのアクセントとぶつからず、でも馴染むように調整
const THEME_DAY_HUES = {
    strawberry: { sun: 12,  sat: 215 },
    lavender:   { sun: 350, sat: 205 },
    peach:      { sun: 355, sat: 200 },
    ocean:      { sun: 5,   sat: 255 },
    pistachio:  { sun: 8,   sat: 205 },
    lemon:      { sun: 8,   sat: 215 },
    sakura:     { sun: 15,  sat: 220 },
    cloudy:     { sun: 350, sat: 185 },
    berry:      { sun: 8,   sat: 225 },
    mocha:      { sun: 355, sat: 210 },
    mint:       { sun: 6,   sat: 228 },
    candy:      { sun: 20,  sat: 210 }
};

function getThemeOption(key) {
    return THEME_OPTIONS.find(t => t.key === key) || THEME_OPTIONS[0];
}

function buildThemeCss(t) {
    const h = t.hue;
    const on = t.on || "#ffffff";
    const onDark = t.onDark || "#0d0d0d";
    const text = t.text || t.light;
    const textDark = t.textDark || t.dark;
    const hsl = (s, l) => `hsl(${h} ${s}% ${l}%)`;
    const dh = THEME_DAY_HUES[t.key] || { sun: 8, sat: 215 };
    const sunL = `hsl(${dh.sun} 55% 53%)`;
    const satL = `hsl(${dh.sat} 50% 50%)`;
    const sunD = `hsl(${dh.sun} 72% 75%)`;
    const satD = `hsl(${dh.sat} 68% 76%)`;
    return `
:root {
    --primary-action: ${t.light};
    --on-primary: ${on};
    --primary-text: ${text};
    --danger-color: ${text};
    --text-main: ${hsl(18, 14)};
    --text-sub: ${hsl(8, 60)};
    --text-faint: ${hsl(10, 78)};
    --border-color: ${hsl(20, 90)};
    --line-color: ${hsl(20, 92)};
    --input-bg: ${hsl(28, 98)};
    --select-bg: ${hsl(28, 96)};
    --shopping-input-bg: ${hsl(28, 98)};
    --settlement-bg: ${hsl(25, 96)};
    --disabled-bg: ${hsl(14, 91)};
    --disabled-text: ${hsl(8, 72)};
    --sun-color: ${sunL};
    --holiday-color: ${sunL};
    --sat-color: ${satL};
}
[data-theme="dark"] {
    --primary-action: ${t.dark};
    --on-primary: ${onDark};
    --primary-text: ${textDark};
    --danger-color: ${textDark};
    --text-main: ${hsl(15, 94)};
    --text-sub: ${hsl(6, 52)};
    --text-faint: ${hsl(6, 30)};
    --border-color: ${hsl(10, 17)};
    --line-color: ${hsl(10, 15)};
    --input-bg: ${hsl(10, 9)};
    --select-bg: ${hsl(12, 11)};
    --shopping-input-bg: ${hsl(10, 9)};
    --settlement-bg: ${hsl(10, 10)};
    --disabled-bg: ${hsl(8, 16)};
    --disabled-text: ${hsl(5, 36)};
    --sun-color: ${sunD};
    --holiday-color: ${sunD};
    --sat-color: ${satD};
}`;
}

function applyTheme(key) {
    const t = getThemeOption(key);
    let el = document.getElementById("theme-style");
    if (!el) {
        el = document.createElement("style");
        el.id = "theme-style";
        document.head.appendChild(el);
    }
    el.textContent = buildThemeCss(t);
}

function initTheme() {
    if (!appData.themeChoice) appData.themeChoice = "strawberry";
    applyTheme(appData.themeChoice);
}

window.selectTheme = function(key) {
    appData.themeChoice = key;
    saveData();
    applyTheme(key);
    renderThemeOptions();
};

function renderThemeOptions() {
    const container = document.getElementById("theme-option-list");
    if (!container) return;
    const current = getThemeOption(appData.themeChoice).key;
    container.innerHTML = THEME_OPTIONS.map(t => `
        <button type="button" class="theme-option-item ${t.key === current ? "selected" : ""}" onclick="selectTheme('${t.key}')">
            <span class="theme-swatch">
                <i style="background:${t.text};"></i>
                <i style="background:${t.light};"></i>
                <i style="background:hsl(${t.hue} 40% 94%);"></i>
            </span>
            <span class="theme-option-name">${t.label}</span>
        </button>
    `).join("");
}
