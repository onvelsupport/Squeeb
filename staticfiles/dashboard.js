document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // FORMAT MONEY
  // ================================
  const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;


  // ================================
  // LOAD USER INFO
  // ================================
  async function loadUser() {
    try {
      const res = await fetch("/api/user-info/", { credentials: "include" });

      if (!res.ok) {
        window.location.href = "/login/";
        return;
      }

      const data = await res.json();

      document.getElementById("usernameDisplay").textContent = data.username;
      document.getElementById("usernameTag").textContent = "@" + data.username;
      document.getElementById("usernameDynamic").textContent = data.username;

      document.getElementById("followers").textContent = data.followers || 0;
      document.getElementById("following").textContent = data.following || 0;

      document.getElementById("balanceAmount").textContent = money(data.balance);
      document.getElementById("earningsTotal").textContent = money(data.earnings);

    } catch (err) {
      console.error("USER LOAD ERROR:", err);
      window.location.href = "/login/";
    }
  }


  // ================================
  // LOAD TASKS
  // ================================
  async function loadTasks() {
    const container = document.getElementById("taskList");
    if (!container) return;

    try {
      const res = await fetch("/api/tasks/", { credentials: "include" });
      const data = await res.json();

      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      container.innerHTML = "";

      if (tasks.length === 0) {
        container.innerHTML = `<p>No tasks available.</p>`;
        return;
      }

      tasks.forEach(task => {

        const badgeText =
          task.available >= 1000
            ? `${(task.available / 1000).toFixed(1)}k Tasks Available`
            : `${task.available} Tasks Available`;

        container.innerHTML += `
          <div class="task-row">
            <div class="task-left">
              <img src="/static/img/${task.icon}" class="task-big-icon">

              <button class="task-select-btn" data-id="${task.id}">
                SELECT
              </button>
            </div>

            <div class="task-mid">
              <h3 class="task-title">${task.title}</h3>

              <p class="task-earn">
                Earnings: <strong>${money(task.payout)} per action</strong>
              </p>

              <p class="task-desc">
                ${task.instructions}
              </p>
            </div>

            <div class="task-right">
              <div class="task-badge">${badgeText}</div>
            </div>
          </div>
        `;
      });

    } catch (err) {
      console.error("TASK LOAD ERROR:", err);
    }
  }


// ===== SUBMIT TASK =====
const submitTaskBtn = document.getElementById("submitTaskBtn");

submitTaskBtn?.addEventListener("click", async () => {

    const quantity = parseInt(quantityInput.value);
    const link = document.getElementById("taskLink").value;
    const platform = document.getElementById("taskPlatform").value;

    if (taskType !== "subscribe" && !platform) {
    alert("Please select a platform.");
    return;
}

    if (!quantity || quantity <= 0) {
        alert("Enter a valid quantity.");
        return;
    }

    if (!link) {
        alert("Enter your link.");
        return;
    }

    submitTaskBtn.disabled = true;

    try {
        const res = await fetch("/create-task/", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                platform: platform,
               followers: quantity,
               link: link,
               task_type: taskType
})
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Something went wrong.");
            return;
        }

        alert("Task created successfully!");

        console.log("SENDING:", {
    platform: platform,
    followers: quantity,
    link: link,
    task_type: taskType
});

        // update balance UI instantly
        document.getElementById("balanceAmount").textContent =
            "£" + parseFloat(data.new_balance).toFixed(2);

        taskModal.style.display = "none";

        loadUser();
        loadTasks();

    } catch (err) {
    console.error("REAL ERROR:", err);
    alert("Check console.");
}

    submitTaskBtn.disabled = false;
});



  // ================================
  // LOGOUT
  // ================================
  async function logout() {
    try {
      await fetch("/api/logout/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    window.location.href = "/login/";
  }

  document.querySelectorAll(".logout").forEach(btn => {
    btn.addEventListener("click", logout);
  });


  // ================================
  // FUND MODAL
  // ================================
  const fundModal = document.getElementById("fundModal");
  const fundBtn = document.querySelector(".fund");
  const fundClose = document.getElementById("fundClose");
  const fundAmountInput = document.getElementById("fundAmountInput");
  const fundSubmitBtn = document.getElementById("fundSubmitBtn");
  const fundMsg = document.getElementById("fundMsg");

  function openFundModal() {
    fundMsg.textContent = "";
    fundAmountInput.value = "";
    fundModal.style.display = "flex";
  }

  function closeFundModal() {
    fundModal.style.display = "none";
  }

  fundBtn?.addEventListener("click", openFundModal);
  fundClose?.addEventListener("click", closeFundModal);

  fundSubmitBtn?.addEventListener("click", async () => {
    const amount = fundAmountInput.value;

    if (!amount || Number(amount) <= 0) {
      fundMsg.textContent = "Enter valid amount.";
      return;
    }

    fundSubmitBtn.disabled = true;
    fundMsg.textContent = "Funding...";

    try {
      const res = await fetch("/api/demo-fund/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });

      const data = await res.json();

      if (!res.ok) {
        fundMsg.textContent = data.error || "Failed.";
        return;
      }

      document.getElementById("balanceAmount").textContent = money(data.balance);
      loadUser();

      fundMsg.textContent = "Wallet funded!";
      setTimeout(closeFundModal, 700);

    } catch (err) {
      fundMsg.textContent = "Network error.";
    }

    fundSubmitBtn.disabled = false;
  });

  
  // ================================
// WITHDRAW MODAL (OPEN -> INPUT -> WITHDRAW)
// ================================
const withdrawModal = document.getElementById("withdrawModal");
const withdrawBtn = document.querySelector(".withdraw");
const withdrawClose = document.getElementById("withdrawClose");
const withdrawAmountInput = document.getElementById("withdrawAmountInput");
const sortCodeInput = document.getElementById("sortCodeInput");
const accountNumberInput = document.getElementById("accountNumberInput");
const withdrawSubmitBtn = document.getElementById("withdrawSubmitBtn");
const withdrawMsg = document.getElementById("withdrawMsg");

function openWithdrawModal() {
  if (!withdrawModal) return;
  withdrawMsg.textContent = "";
  withdrawAmountInput.value = "";
  sortCodeInput.value = "";
  accountNumberInput.value = "";
  withdrawModal.style.display = "flex";
  withdrawAmountInput.focus();
}

function closeWithdrawModal() {
  if (!withdrawModal) return;
  withdrawModal.style.display = "none";
}

withdrawBtn?.addEventListener("click", openWithdrawModal);
withdrawClose?.addEventListener("click", closeWithdrawModal);

withdrawModal?.addEventListener("click", (e) => {
  if (e.target === withdrawModal) closeWithdrawModal();
});

// basic formatting helpers (optional)
sortCodeInput?.addEventListener("input", () => {
  // allow digits and hyphen only
  sortCodeInput.value = sortCodeInput.value.replace(/[^\d-]/g, "");
});

accountNumberInput?.addEventListener("input", () => {
  accountNumberInput.value = accountNumberInput.value.replace(/[^\d]/g, "");
});

withdrawSubmitBtn?.addEventListener("click", async () => {
  const amount = withdrawAmountInput.value;
  const sort_code = sortCodeInput.value;
  const account_number = accountNumberInput.value;

  withdrawSubmitBtn.disabled = true;
  withdrawMsg.textContent = "Processing...";

  try {
    const res = await fetch("/api/request-withdrawal/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, sort_code, account_number })
    });

    const data = await res.json();

    if (!res.ok) {
      withdrawMsg.textContent = data.error || "Withdrawal failed.";
      return;
    }

    // update UI instantly
    document.getElementById("balanceAmount").textContent = money(data.balance);

    // resync from backend
    loadUser();

    withdrawMsg.textContent = "Withdrawal successful (demo)!";
    setTimeout(closeWithdrawModal, 700);

  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    withdrawMsg.textContent = "Network error. Try again.";
  } finally {
    withdrawSubmitBtn.disabled = false;
  }
});


  // ================================
  // INIT
  // ================================
  loadUser();
  loadTasks();

});


// ================================
// EARN MODAL
// ================================
const earnModal = document.getElementById("earnModal");
const earnClose = document.getElementById("earnClose");

// open when clicking Earn in nav
document.querySelectorAll(".fa-coins").forEach(icon => {
  icon.parentElement.addEventListener("click", (e) => {
    e.preventDefault();
    earnModal.style.display = "flex";
  });
});

earnClose?.addEventListener("click", () => {
  earnModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === earnModal) {
    earnModal.style.display = "none";
  }
});


// ================================
// ADVERTISE MODAL
// ================================
const adModal = document.getElementById("adModal");
const adClose = document.getElementById("adClose");

// open when clicking Advertise in nav
document.querySelectorAll(".fa-bullhorn").forEach(icon => {
  icon.parentElement.addEventListener("click", (e) => {
    e.preventDefault();
    adModal.style.display = "flex";
  });
});

adClose?.addEventListener("click", () => {
  adModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === adModal) {
    adModal.style.display = "none";
  }
});

// ================= TASK ACTION MODAL =================

const taskModal = document.getElementById("taskActionModal");
const closeTaskModal = document.getElementById("taskActionClose");

const modalTitle = document.getElementById("taskActionTitle");
const modalPrice = document.getElementById("taskActionPrice");
const modalDescription = document.getElementById("taskActionDescription");
const modalIcon = document.getElementById("taskActionIcon");

const quantityLabel = document.getElementById("quantityLabel");
const platformGroup = document.getElementById("platformGroup");

const quantityInput = document.getElementById("taskQuantity");
const totalDisplay = document.getElementById("taskTotal");

let currentPrice = 0;


// ===== OPEN MODAL =====
let taskType = null;

document.querySelectorAll(".select-btn").forEach(button => {
    button.addEventListener("click", function () {

        // Set modal content
        modalTitle.innerText = this.dataset.title;
        modalPrice.innerText = this.dataset.price;
        modalDescription.innerText = this.dataset.description;
        modalIcon.src = this.dataset.icon;

        // Store numeric price
        currentPrice = parseFloat(this.dataset.amount) || 0;

        // Reset fields
        quantityInput.value = "";
        totalDisplay.innerText = "£0.00";

        taskType = this.dataset.type;

        // Default settings
        platformGroup.style.display = "block";

        if (taskType === "subscribe") {
            quantityLabel.innerText = "Number of Subscribers You Want";
            platformGroup.style.display = "none";
            document.getElementById("taskPlatform").value = "YouTube";
            document.getElementById("taskLink").placeholder =
                "Enter your YouTube channel link";
        }

        else if (taskType === "like") {
            quantityLabel.innerText = "Number of Likes You Want";
            document.getElementById("taskLink").placeholder =
                "Enter your post link";
        }

        else if (taskType === "comment") {
            quantityLabel.innerText = "Number of Comments You Want";
            document.getElementById("taskLink").placeholder =
                "Enter your post link";
        }

        else {
            quantityLabel.innerText = "Number of Followers You Want";
            document.getElementById("taskLink").placeholder =
                "Enter your page/profile link";
        }

        taskModal.style.display = "flex";
    });
});


// ===== LIVE TOTAL CALCULATION =====
quantityInput.addEventListener("input", function () {

    const quantity = parseFloat(this.value);

    if (!isNaN(quantity) && quantity > 0) {
        const total = quantity * currentPrice;
        totalDisplay.innerText = "£" + total.toFixed(2);
    } else {
        totalDisplay.innerText = "£0.00";
    }
});


// ===== CLOSE MODAL =====
closeTaskModal.addEventListener("click", function () {
    taskModal.style.display = "none";
});

window.addEventListener("click", function (e) {
    if (e.target === taskModal) {
        taskModal.style.display = "none";
    }
});


