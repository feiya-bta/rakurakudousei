// --- 初期状態データ (Fresh clean start) ---
const DEFAULT_DATA = {
    users: {
        1: { name: "菲雅", age: 32, gender: "女性", color: "#f2cbd6" }, 
        2: { name: "世英", age: 20, gender: "男性", color: "#d6efff" } 
    },
    settledColor: "#b2ebd4", 
    payments: [], // Clean fresh start
    shoppingList: [], // Clean fresh start
    confirmations: {
        1: false,
        2: false
    },
    currentOperator: 1 
};

let appData = JSON.parse(localStorage.getItem("rakuraku_domo_data")) || JSON.parse(JSON.stringify(DEFAULT_DATA));
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
    renderArchive();
    updateThemeColor();
}

function saveData() {
    localStorage.setItem("rakuraku_domo_data", JSON.stringify(appData));
}

function renderUserSelectors() {
    const selector = document.getElementById("user-selector");
    selector.innerHTML = `
        <option value="1">${appData.users[1].name} として操作</option>
        <option value="2">${appData.users[2].name} として操作</option>
    `;
    selector.value = appData.currentOperator;
}

function renderTimeline() {
    const container = document.getElementById("payment-timeline");
    container.innerHTML = "";

    const activePayments = appData.payments.filter(p => !p.settled);
    if (activePayments.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.95rem; padding:40px 0;">未精算の支払いはありません</p>`;
        return;
    }

    activePayments.sort((a,b) => b.date.localeCompare(a.date));

    activePayments.forEach(pay => {
        const user = appData.users[pay.userId];
        const opponentRatio = pay.ratio;
        const opponentCost = Math.round(pay.amount * (opponentRatio / 100));
        
        const card = document.createElement("div");
        card.className = "card";
        card.style.backgroundColor = user.color || "#ffffff";

        card.innerHTML = `
            <div class="card-header">
                <div class="card-user-info">
                    ${user.name} のお支払い
                </div>
                <div class="card-actions">
                    <span class="action-link edit" onclick="editPayment(${pay.id})">編集</span>
                    <span class="action-link delete" onclick="deletePayment(${pay.id})">削除</span>
                </div>
            </div>
            <div class="card-body">
                <h4>${pay.title}</h4>
                ${pay.memo ? `<span class="badge-date">${pay.memo}</span>` : ""}
                <div class="card-amount-row">
                    <span class="badge-date">${pay.date}</span>
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

function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
    listContainer.innerHTML = "";

    appData.shoppingList.forEach(item => {
        const li = document.createElement("li");
        li.className = `shopping-item ${item.checked ? 'checked' : ''}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="toggleShoppingItem(${item.id})">
                <span class="material-icons-round" style="color:var(--text-sub); font-size:20px;">
                    ${item.checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span>${item.text}</span>
            </div>
            <span class="material-icons-round" style="color:var(--danger-color); cursor:pointer; font-size:20px;" onclick="deleteShoppingItem(${item.id})">delete</span>
        `;
        listContainer.appendChild(li);
    });
}

function renderSettlement() {
    const u1 = appData.users[1];
    const u2 = appData.users[2];

    let u1Demands = 0; 
    let u2Demands = 0; 

    appData.payments.forEach(p => {
        if (!p.settled) {
            const opponentAmount = Math.round(p.amount * (p.ratio / 100));
            if (p.userId === 1) {
                u1Demands += opponentAmount;
            } else {
                u2Demands += opponentAmount;
            }
        }
    });

    const resultTextDiv = document.getElementById("settlement-result-text");
    
    if (u1Demands === u2Demands) {
        resultTextDiv.innerHTML = `現在、お互いの精算額は相殺されて <span class="settlement-result-amount">0 円</span> です。`;
    } else if (u1Demands > u2Demands) {
        const diff = u1Demands - u2Demands;
        resultTextDiv.innerHTML = `${u2.name} は ${u1.name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
    } else {
        const diff = u2Demands - u1Demands;
        resultTextDiv.innerHTML = `${u1.name} は ${u2.name} に<br><span class="settlement-result-amount">${diff.toLocaleString()} 円</span><br>お支払いください。`;
    }

    document.getElementById("label-confirm-user1").innerText = `${u1.name} の確認`;
    document.getElementById("label-confirm-user2").innerText = `${u2.name} の確認`;

    const btn1 = document.getElementById("btn-confirm-user1");
    const btn2 = document.getElementById("btn-confirm-user2");

    if (appData.currentOperator === 1) {
        btn1.disabled = false;
        btn1.classList.add("operable");
        btn2.disabled = true;
        btn2.classList.remove("operable");
    } else {
        btn1.disabled = true;
        btn1.classList.remove("operable");
        btn2.disabled = false;
        btn2.classList.add("operable");
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
        if (!p.settled) {
            p.settled = true;
            p.settledMonth = monthStr;
            updated = true;
        }
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

function renderArchive() {
    const filterSelect = document.getElementById("archive-month-filter");
    const timeline = document.getElementById("archive-timeline");

    const months = [...new Set(appData.payments.filter(p => p.settled).map(p => p.settledMonth))];
    months.sort((a,b) => b.localeCompare(a));

    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = "";
    
    if(months.length === 0) {
        filterSelect.innerHTML = `<option value="">履歴なし</option>`;
        timeline.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.95rem; padding:40px 0;">アーカイブされたデータはありません</p>`;
        return;
    }

    months.forEach(m => {
        filterSelect.innerHTML += `<option value="${m}">${m}</option>`;
    });

    if (months.includes(currentFilter)) {
        filterSelect.value = currentFilter;
    } else {
        filterSelect.value = months[0];
    }

    const selectedMonth = filterSelect.value;
    timeline.innerHTML = "";

    const archivedPayments = appData.payments.filter(p => p.settled && p.settledMonth === selectedMonth);
    
    archivedPayments.forEach(pay => {
        const user = appData.users[pay.userId];
        const item = document.createElement("div");
        item.className = "card";
        item.style.backgroundColor = "#ffffff";
        item.style.border = `1px solid var(--border-color)`;
        item.innerHTML = `
            <div class="card-header" style="font-size:0.85rem; color:var(--text-sub)">
                <span>記録者: ${user.name}</span>
                <span>${pay.date}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:1rem;">
                <span>${pay.title}</span>
                <span style="margin-left:auto;">${pay.amount.toLocaleString()} 円</span>
            </div>
        `;
        timeline.appendChild(item);
    });
}

function validatePaymentInput() {
    const title = document.getElementById("pay-title").value.trim();
    const amount = parseInt(document.getElementById("pay-amount").value);
    const saveButton = document.getElementById("btn-save-payment");

    if (!title || isNaN(amount) || amount <= 0) {
        saveButton.disabled = true;
    } else {
        saveButton.disabled = false;
    }
}

function setupEventListeners() {
    document.querySelectorAll(".app-nav .nav-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            
            document.querySelectorAll(".app-nav .nav-item").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            
            e.currentTarget.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
        });
    });

    document.getElementById("user-selector").addEventListener("change", (e) => {
        appData.currentOperator = parseInt(e.target.value);
        saveData();
        renderSettlement(); 
    });

    document.getElementById("fab-add-payment").addEventListener("click", () => {
        document.getElementById("payment-modal-title").innerText = "支払いを記録";
        document.getElementById("pay-edit-id").value = "";
        document.getElementById("pay-title").value = "";
        document.getElementById("pay-amount").value = "";
        document.getElementById("pay-ratio").value = 50;
        document.getElementById("pay-memo").value = "";
        updateCalculatedAmount();
        validatePaymentInput(); 
        document.getElementById("modal-payment-entry").classList.add("open");
    });
    
    document.getElementById("btn-close-payment").addEventListener("click", () => {
        document.getElementById("modal-payment-entry").classList.remove("open");
    });

    const ratioSlider = document.getElementById("pay-ratio");
    ratioSlider.addEventListener("input", updateCalculatedAmount);
    
    document.getElementById("pay-title").addEventListener("input", validatePaymentInput);
    document.getElementById("pay-amount").addEventListener("input", () => {
        updateCalculatedAmount();
        validatePaymentInput();
    });

    document.getElementById("btn-save-payment").addEventListener("click", () => {
        const editId = document.getElementById("pay-edit-id").value;
        const title = document.getElementById("pay-title").value.trim();
        const amount = parseInt(document.getElementById("pay-amount").value);
        const ratio = parseInt(document.getElementById("pay-ratio").value);
        const memo = document.getElementById("pay-memo").value.trim();

        if (editId) {
            // Processing updates for edited payment item 
            const existingPay = appData.payments.find(p => p.id === parseInt(editId));
            if (existingPay) {
                existingPay.title = title;
                existingPay.amount = amount;
                existingPay.ratio = ratio;
                existingPay.memo = memo;
            }
        } else {
            // Processing execution for registering completely new entry
            const today = new Date().toISOString().split('T')[0];
            const newPay = {
                id: Date.now(),
                userId: appData.currentOperator,
                title: title,
                amount: amount,
                ratio: ratio,
                memo: memo,
                date: today,
                settled: false,
                settledMonth: ""
            };
            appData.payments.push(newPay);
        }

        appData.confirmations[1] = false;
        appData.confirmations[2] = false;
        
        saveData();
        initApp();
        document.getElementById("modal-payment-entry").classList.remove("open");
    });

    document.getElementById("btn-add-shopping").addEventListener("click", () => {
        const input = document.getElementById("shopping-item-name");
        const text = input.value.trim();
        if(!text) return;

        appData.shoppingList.push({
            id: Date.now(),
            text: text,
            checked: false
        });
        input.value = "";
        saveData();
        renderShoppingList();
    });

    document.getElementById("btn-confirm-user1").addEventListener("click", () => {
        if (appData.currentOperator === 1) {
            appData.confirmations[1] = !appData.confirmations[1];
            saveData();
            renderSettlement();
            updateThemeColor();
        }
    });
    
    document.getElementById("btn-confirm-user2").addEventListener("click", () => {
        if (appData.currentOperator === 2) {
            appData.confirmations[2] = !appData.confirmations[2];
            saveData();
            renderSettlement();
            updateThemeColor();
        }
    });

    document.getElementById("archive-month-filter").addEventListener("change", renderArchive);

    document.getElementById("btn-settings").addEventListener("click", () => {
        switchProfileEditor(1);
        document.getElementById("modal-profile").classList.add("open");
    });
    document.getElementById("btn-close-profile").addEventListener("click", () => {
        document.getElementById("modal-profile").classList.remove("open");
    });

    document.getElementById("btn-save-profile").addEventListener("click", () => {
        if (activeEditorUser === 1 || activeEditorUser === 2) {
            appData.users[activeEditorUser].name = document.getElementById("edit-name").value;
            appData.users[activeEditorUser].age = parseInt(document.getElementById("edit-age").value) || 0;
            appData.users[activeEditorUser].gender = document.getElementById("edit-gender").value;
        }
        saveData();
        initApp();
        document.getElementById("modal-profile").classList.remove("open");
    });

    document.getElementById("btn-reset-data").addEventListener("click", () => {
        if(confirm("すべてのデータを初期状態に戻しますか？")) {
            localStorage.removeItem("rakuraku_domo_data");
            appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
            initApp();
        }
    });
}

function updateCalculatedAmount() {
    const amount = parseInt(document.getElementById("pay-amount").value) || 0;
    const ratio = parseInt(document.getElementById("pay-ratio").value);
    document.getElementById("ratio-display").innerText = ratio;
    
    const calculated = Math.round(amount * (ratio / 100));
    document.getElementById("pay-calc-amount").value = `${calculated.toLocaleString()} 円`;
}

// Payment editing functionality implementation
window.editPayment = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;

    document.getElementById("payment-modal-title").innerText = "支出を編集";
    document.getElementById("pay-edit-id").value = pay.id;
    document.getElementById("pay-title").value = pay.title;
    document.getElementById("pay-amount").value = pay.amount;
    document.getElementById("pay-ratio").value = pay.ratio;
    document.getElementById("pay-memo").value = pay.memo || "";

    updateCalculatedAmount();
    validatePaymentInput();
    document.getElementById("modal-payment-entry").classList.add("open");
};

window.deletePayment = function(id) {
    if(confirm("この支出を削除しますか？")) {
        appData.payments = appData.payments.filter(p => p.id !== id);
        saveData();
        initApp();
    }
};

window.toggleShoppingItem = function(id) {
    const item = appData.shoppingList.find(i => i.id === id);
    if(item) item.checked = !item.checked;
    saveData();
    renderShoppingList();
};

window.deleteShoppingItem = function(id) {
    appData.shoppingList = appData.shoppingList.filter(i => i.id !== id);
    saveData();
    renderShoppingList();
};

window.switchProfileEditor = function(type) {
    activeEditorUser = type;
    document.querySelectorAll(".modal-tab-btn").forEach((b, idx) => {
        if(idx + 1 === type) b.classList.add("active"); else b.classList.remove("active");
    });

    document.getElementById("modal-tab-u1").innerText = appData.users[1].name;
    document.getElementById("modal-tab-u2").innerText = appData.users[2].name;

    const formUser = document.getElementById("form-user-edit");
    const formColor = document.getElementById("form-settled-color-edit");

    if (type === 1 || type === 2) {
        formUser.style.display = "block";
        formColor.style.display = "none";

        const u = appData.users[type];
        document.getElementById("edit-name").value = u.name;
        document.getElementById("edit-age").value = u.age;
        document.getElementById("edit-gender").value = u.gender;

        const picker = document.getElementById("user-color-picker");
        picker.innerHTML = "";
        PALETTE.forEach(c => {
            const dot = document.createElement("div");
            dot.className = `color-dot ${u.color === c ? 'selected' : ''}`;
            dot.style.backgroundColor = c;
            dot.onclick = () => {
                u.color = c;
                switchProfileEditor(type);
            };
            picker.appendChild(dot);
        });

    } else if (type === 3) {
        formUser.style.display = "none";
        formColor.style.display = "block";

        const picker = document.getElementById("settled-color-picker");
        picker.innerHTML = "";
        PALETTE.forEach(c => {
            const dot = document.createElement("div");
            dot.className = `color-dot ${appData.settledColor === c ? 'selected' : ''}`;
            dot.style.backgroundColor = c;
            dot.onclick = () => {
                appData.settledColor = c;
                switchProfileEditor(3);
            };
            picker.appendChild(dot);
        });
    }
};
