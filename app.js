// --- 新規登録状態のデフォルトデータ構造 (Clean Fresh Account Onboarding Setup) ---
const DEFAULT_DATA = {
    users: {
        1: { name: "", color: "#f2cbd6" }, 
        2: { name: "", color: "#d6efff" } 
    },
    settledColor: "#b2ebd4", 
    payments: [],       
    shoppingList: [],   
    confirmations: {
        1: false,
        2: false
    },
    currentOperator: 1,
    isNewAccount: true  
};

// LocalStorage or absolute fresh structure fallback
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

    const container = document.querySelector(".app-container");

    // Fail-safe check: If any user name is missing entirely, treat it as a fresh device install
    const isBrandNewSession = appData.isNewAccount || !appData.users[1].name || !appData.users[2].name;

    if (isBrandNewSession) {
        appData.isNewAccount = true; // Sync flag state
        if (container) container.classList.add("onboarding-mode");
        
        // Setup initial step based on active onboarding step
        if (activeEditorUser !== 1 && activeEditorUser !== 2) {
            activeEditorUser = 1; // Default back to user 1 if out of bounds
        }
        
        switchProfileEditor(activeEditorUser); 
        const profileModal = document.getElementById("modal-profile");
        if (profileModal) profileModal.classList.add("open");
    } else {
        if (container) container.classList.remove("onboarding-mode");
    }
}

function saveData() {
    localStorage.setItem("rakuraku_domo_data", JSON.stringify(appData));
}

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

function renderTimeline() {
    const container = document.getElementById("payment-timeline");
    if (!container) return;
    container.innerHTML = "";

    const activePayments = appData.payments.filter(p => !p.settled);
    if (activePayments.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.75rem; padding:40px 0;">未精算の支払いはありません</p>`;
        return;
    }

    // Newest date first; within the same date, the most recently entered item comes first
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
                <div class="card-user-info">
                    ${user.name || "ユーザー"} のお支払い
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

function renderShoppingList() {
    const listContainer = document.getElementById("shopping-list-items");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    appData.shoppingList.forEach(item => {
        const li = document.createElement("li");
        li.className = `shopping-item ${item.checked ? 'checked' : ''}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="toggleShoppingItem(${item.id})">
                <span class="material-icons-round" style="color:var(--text-sub); font-size:16px;">
                    ${item.checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span>${item.text}</span>
            </div>
            <span class="material-icons-round" style="color:var(--danger-color); cursor:pointer; font-size:16px;" onclick="deleteShoppingItem(${item.id})">delete</span>
        `;
        listContainer.appendChild(li);
    });
}

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
            if (p.userId === 1) {
                u1Demands += opponentAmount;
            } else {
                u2Demands += opponentAmount;
            }
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

    const label1 = document.getElementById("label-confirm-user1");
    const label2 = document.getElementById("label-confirm-user2");
    if (label1) label1.innerText = `${u1Name} の確認`;
    if (label2) label2.innerText = `${u2Name} の確認`;

    const btn1 = document.getElementById("btn-confirm-user1");
    const btn2 = document.getElementById("btn-confirm-user2");

    if (btn1 && btn2) {
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
    if (!filterSelect || !timeline) return;

    const months = [...new Set(appData.payments.filter(p => p.settled).map(p => p.settledMonth))];
    months.sort((a,b) => b.localeCompare(a));

    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = "";
    
    if(months.length === 0) {
        filterSelect.innerHTML = `<option value="">履歴なし</option>`;
        timeline.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:0.75rem; padding:40px 0;">アーカイブされたデータはありません</p>`;
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
        const user = appData.users[pay.userId] || { name: "ユーザー" };
        const item = document.createElement("div");
        item.className = "card";
        item.style.backgroundColor = "#ffffff";
        item.style.border = `1px solid var(--border-color)`;
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

function validatePaymentInput() {
    const titleInput = document.getElementById("pay-title");
    const amountInput = document.getElementById("pay-amount");
    const dateInput = document.getElementById("pay-date");
    const saveButton = document.getElementById("btn-save-payment");

    if (!titleInput || !amountInput || !dateInput || !saveButton) return;

    const title = titleInput.value.trim();
    const amount = parseInt(amountInput.value);
    const dateVal = dateInput.value;

    if (!title || isNaN(amount) || amount <= 0 || !dateVal) {
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
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add("active");
        });
    });

    const userSelector = document.getElementById("user-selector");
    if (userSelector) {
        userSelector.addEventListener("change", (e) => {
            appData.currentOperator = parseInt(e.target.value);
            saveData();
            renderSettlement(); 
        });
    }

    const fabAddPayment = document.getElementById("fab-add-payment");
    if (fabAddPayment) {
        fabAddPayment.addEventListener("click", () => {
            const titleEl = document.getElementById("payment-modal-title");
            if (titleEl) titleEl.innerText = "支払いを記録";
            
            document.getElementById("pay-edit-id").value = "";
            document.getElementById("pay-title").value = "";
            document.getElementById("pay-amount").value = "";
            document.getElementById("pay-date").value = new Date().toISOString().split('T')[0];
            document.getElementById("pay-ratio").value = 50;
            document.getElementById("pay-memo").value = "";
            updateCalculatedAmount();
            validatePaymentInput(); 
            const payModal = document.getElementById("modal-payment-entry");
            if (payModal) payModal.classList.add("open");
        });
    }
    
    const btnClosePayment = document.getElementById("btn-close-payment");
    if (btnClosePayment) {
        btnClosePayment.addEventListener("click", () => {
            const payModal = document.getElementById("modal-payment-entry");
            if (payModal) payModal.classList.remove("open");
        });
    }

    const ratioSlider = document.getElementById("pay-ratio");
    if (ratioSlider) ratioSlider.addEventListener("input", updateCalculatedAmount);
    
    const payTitle = document.getElementById("pay-title");
    if (payTitle) payTitle.addEventListener("input", validatePaymentInput);

    const payDate = document.getElementById("pay-date");
    if (payDate) payDate.addEventListener("change", validatePaymentInput);

    const payAmount = document.getElementById("pay-amount");
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
                const existingPay = appData.payments.find(p => p.id === parseInt(editId));
                if (existingPay) {
                    existingPay.title = title;
                    existingPay.amount = amount;
                    existingPay.date = dateVal;
                    existingPay.ratio = ratio;
                    existingPay.memo = memo;
                }
            } else {
                const newPay = {
                    id: Date.now(),
                    userId: appData.currentOperator,
                    title: title,
                    amount: amount,
                    ratio: ratio,
                    memo: memo,
                    date: dateVal,
                    settled: false,
                    settledMonth: ""
                };
                appData.payments.push(newPay);
            }

            appData.confirmations[1] = false;
            appData.confirmations[2] = false;
            
            saveData();
            initApp();
            const payModal = document.getElementById("modal-payment-entry");
            if (payModal) payModal.classList.remove("open");
        });
    }

    const btnAddShopping = document.getElementById("btn-add-shopping");
    if (btnAddShopping) {
        btnAddShopping.addEventListener("click", () => {
            const input = document.getElementById("shopping-item-name");
            if (!input) return;
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
    }

    const btnConfirmU1 = document.getElementById("btn-confirm-user1");
    if (btnConfirmU1) {
        btnConfirmU1.addEventListener("click", () => {
            if (appData.currentOperator === 1) {
                appData.confirmations[1] = !appData.confirmations[1];
                saveData();
                renderSettlement();
                updateThemeColor();
            }
        });
    }
    
    const btnConfirmU2 = document.getElementById("btn-confirm-user2");
    if (btnConfirmU2) {
        btnConfirmU2.addEventListener("click", () => {
            if (appData.currentOperator === 2) {
                appData.confirmations[2] = !appData.confirmations[2];
                saveData();
                renderSettlement();
                updateThemeColor();
            }
        });
    }

    const archiveFilter = document.getElementById("archive-month-filter");
    if (archiveFilter) archiveFilter.addEventListener("change", renderArchive);

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            switchProfileEditor(1);
            const profileModal = document.getElementById("modal-profile");
            if (profileModal) profileModal.classList.add("open");
        });
    }

    const btnCloseProfile = document.getElementById("btn-close-profile");
    if (btnCloseProfile) {
        btnCloseProfile.addEventListener("click", () => {
            const profileModal = document.getElementById("modal-profile");
            if (profileModal) profileModal.classList.remove("open");
        });
    }

    const editName = document.getElementById("edit-name");
    if (editName) {
        editName.addEventListener("input", () => {
            updateAvatarPreview(activeEditorUser);
        });
    }

    const btnSaveProfile = document.getElementById("btn-save-profile");
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener("click", () => {
            if (activeEditorUser === 1 || activeEditorUser === 2) {
                const nameInput = document.getElementById("edit-name");
                const inputName = nameInput ? nameInput.value.trim() : "";
                appData.users[activeEditorUser].name = inputName || `ユーザー ${activeEditorUser}`;
            }
            
            if (appData.isNewAccount) {
                if (activeEditorUser === 1) {
                    // Instantly advance onto creation form of user 2 step 
                    activeEditorUser = 2;
                    switchProfileEditor(2);
                    return;
                } else if (activeEditorUser === 2) {
                    appData.isNewAccount = false;
                }
            }

            saveData();
            initApp();
            const profileModal = document.getElementById("modal-profile");
            if (profileModal) profileModal.classList.remove("open");
        });
    }

    // --- MODERNIZED & SIMPLE APP RESET LOGIC ---
    const btnResetData = document.getElementById("btn-reset-data");
    if (btnResetData) {
        btnResetData.addEventListener("click", () => {
            localStorage.removeItem("rakuraku_domo_data");
            
            appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
            activeEditorUser = 1; // Reset back to step 1
            saveData();

            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            const tabPayment = document.getElementById("tab-payment");
            if (tabPayment) tabPayment.classList.add("active");
            
            document.querySelectorAll(".app-nav .nav-item").forEach(b => b.classList.remove("active"));
            const targetNavItem = document.querySelector('[data-tab="tab-payment"]');
            if (targetNavItem) targetNavItem.classList.add("active");

            initApp();
        });
    }
}

function updateCalculatedAmount() {
    const amountInput = document.getElementById("pay-amount");
    const ratioSlider = document.getElementById("pay-ratio");
    const ratioDisplay = document.getElementById("ratio-display");
    const payCalcInput = document.getElementById("pay-calc-amount");

    const amount = amountInput ? (parseInt(amountInput.value) || 0) : 0;
    const ratio = ratioSlider ? parseInt(ratioSlider.value) : 50;
    
    if (ratioDisplay) ratioDisplay.innerText = ratio;
    
    const calculated = Math.round(amount * (ratio / 100));
    if (payCalcInput) payCalcInput.value = `${calculated.toLocaleString()} 円`;
}

window.editPayment = function(id) {
    const pay = appData.payments.find(p => p.id === id);
    if (!pay) return;

    const titleEl = document.getElementById("payment-modal-title");
    if (titleEl) titleEl.innerText = "支出を編集";
    
    document.getElementById("pay-edit-id").value = pay.id;
    document.getElementById("pay-title").value = pay.title;
    document.getElementById("pay-amount").value = pay.amount;
    document.getElementById("pay-date").value = pay.date;
    document.getElementById("pay-ratio").value = pay.ratio;
    document.getElementById("pay-memo").value = pay.memo || "";

    updateCalculatedAmount();
    validatePaymentInput();
    const payModal = document.getElementById("modal-payment-entry");
    if (payModal) payModal.classList.add("open");
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

    const u1Label = appData.users[1].name || "ユーザー1";
    const u2Label = appData.users[2].name || "ユーザー2";
    
    const tabU1 = document.getElementById("modal-tab-u1");
    const tabU2 = document.getElementById("modal-tab-u2");
    if (tabU1) tabU1.innerText = u1Label;
    if (tabU2) tabU2.innerText = u2Label;

    // Title / subtitle / progress / button label: onboarding gets a 2-step wizard treatment,
    // regular settings access (post-onboarding) gets the plain editor labels.
    const titleEl = document.getElementById("modal-profile-title");
    const subtitleEl = document.getElementById("modal-profile-subtitle");
    const progressFill = document.getElementById("onboarding-progress-fill");
    const saveBtn = document.getElementById("btn-save-profile");

    if (appData.isNewAccount && (type === 1 || type === 2)) {
        if (titleEl) titleEl.innerText = type === 1 ? "ようこそ！" : "もう一人のプロフィール";
        if (subtitleEl) {
            subtitleEl.innerText = type === 1
                ? "あなたの名前とテーマカラーを設定してください"
                : "次に、もう一人の名前とテーマカラーを設定してください";
        }
        if (progressFill) progressFill.style.width = type === 1 ? "50%" : "100%";
        if (saveBtn) saveBtn.innerText = type === 1 ? "次へ" : "はじめる";
    } else {
        if (titleEl) titleEl.innerText = "プロフィールの編集";
        if (subtitleEl) subtitleEl.innerText = "";
        if (saveBtn) saveBtn.innerText = "保存して閉じる";
    }

    const formUser = document.getElementById("form-user-edit");
    const formColor = document.getElementById("form-settled-color-edit");

    if (type === 1 || type === 2) {
        if (formUser) formUser.style.display = "block";
        if (formColor) formColor.style.display = "none";

        const u = appData.users[type];
        const editNameInput = document.getElementById("edit-name");
        if (editNameInput) editNameInput.value = u.name;
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
            if (isUserType) {
                appData.users[type].color = c;
                updateAvatarPreview(type);
            } else {
                appData.settledColor = c;
            }
            renderColorPicker(type); // only refresh the swatches, never touch the name input
        };
        picker.appendChild(dot);
    });
}

function updateAvatarPreview(type) {
    if (type !== 1 && type !== 2) return;
    const preview = document.getElementById("user-avatar-preview");
    const nameInput = document.getElementById("edit-name");
    if (!preview || !nameInput) return;
    const nameVal = (nameInput.value || "").trim();
    preview.style.backgroundColor = appData.users[type].color;
    preview.innerText = nameVal ? nameVal.charAt(0).toUpperCase() : "?";
}
