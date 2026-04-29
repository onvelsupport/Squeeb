document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // FORMAT MONEY
  // ================================
  const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;


  // ================================
  // MOBILE MENU
  // ================================
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileDropdown = document.getElementById("mobileDropdown");
  const mobileEarnLink = document.getElementById("mobileEarnLink");
  const mobileAdvertiseLink = document.getElementById("mobileAdvertiseLink");

  if (mobileMenuBtn && mobileDropdown) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      mobileDropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!mobileDropdown.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileDropdown.classList.remove("show");
      }
    });
  }


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


  // ================================
  // LOGOUT
  // ================================
  async function logout(e) {
    if (e) e.preventDefault();

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
  // FUND MODAL - REAL STRIPE FUNDING
  // ================================
  const fundModal = document.getElementById("fundModal");
  const fundBtn = document.querySelector(".fund");
  const fundClose = document.getElementById("fundClose");
  const fundAmountInput = document.getElementById("fundAmountInput");
  const fundSubmitBtn = document.getElementById("fundSubmitBtn");
  const fundMsg = document.getElementById("fundMsg");

  function openFundModal() {
    if (!fundModal) return;
    fundMsg.textContent = "";
    fundAmountInput.value = "";
    fundModal.style.display = "flex";
    fundAmountInput.focus();
  }

  function closeFundModal() {
    if (!fundModal) return;
    fundModal.style.display = "none";
  }

  fundBtn?.addEventListener("click", openFundModal);
  fundClose?.addEventListener("click", closeFundModal);

  fundModal?.addEventListener("click", (e) => {
    if (e.target === fundModal) closeFundModal();
  });

  fundSubmitBtn?.addEventListener("click", async () => {
    const amount = fundAmountInput.value;

    if (!amount || Number(amount) <= 0) {
      fundMsg.textContent = "Enter a valid amount.";
      return;
    }

    fundSubmitBtn.disabled = true;
    fundMsg.textContent = "Redirecting to Stripe...";

    try {
      const res = await fetch("/api/create-funding-checkout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount })
      });

      const data = await res.json();

      if (!res.ok) {
        fundMsg.textContent = data.error || "Failed to start Stripe payment.";
        fundSubmitBtn.disabled = false;
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      fundMsg.textContent = "Stripe checkout URL was not returned.";

    } catch (err) {
      console.error("FUND ERROR:", err);
      fundMsg.textContent = "Network error.";
    } finally {
      fundSubmitBtn.disabled = false;
    }
  });


  // ================================
  // WITHDRAW MODAL
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

  sortCodeInput?.addEventListener("input", () => {
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
      const res = await fetch("/api/demo-withdraw/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, sort_code, account_number })
      });

      const data = await res.json();

      if (!res.ok) {
        withdrawMsg.textContent = data.error || "Withdrawal failed.";
        withdrawSubmitBtn.disabled = false;
        return;
      }

      document.getElementById("balanceAmount").textContent = money(data.balance);
      loadUser();

      withdrawMsg.textContent = "Withdrawal successful.";
      setTimeout(closeWithdrawModal, 700);

    } catch (err) {
      console.error("WITHDRAW ERROR:", err);
      withdrawMsg.textContent = "Network error. Try again.";
    } finally {
      withdrawSubmitBtn.disabled = false;
    }
  });


  // ================================
  // EARN MODAL
  // ================================
  const earnModal = document.getElementById("earnModal");
  const earnClose = document.getElementById("earnClose");

  document.querySelectorAll(".fa-coins").forEach(icon => {
    icon.parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      earnModal.style.display = "flex";
      mobileDropdown?.classList.remove("show");
    });
  });

  mobileEarnLink?.addEventListener("click", (e) => {
    e.preventDefault();
    earnModal.style.display = "flex";
    mobileDropdown?.classList.remove("show");
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

  document.querySelectorAll(".fa-bullhorn").forEach(icon => {
    icon.parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      adModal.style.display = "flex";
      mobileDropdown?.classList.remove("show");
    });
  });

  mobileAdvertiseLink?.addEventListener("click", (e) => {
    e.preventDefault();
    adModal.style.display = "flex";
    mobileDropdown?.classList.remove("show");
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
  let taskType = null;

  document.querySelectorAll(".select-btn").forEach(button => {
    button.addEventListener("click", function () {
      modalTitle.innerText = this.dataset.title;
      modalPrice.innerText = this.dataset.price;
      modalDescription.innerText = this.dataset.description;
      modalIcon.src = this.dataset.icon;

      currentPrice = parseFloat(this.dataset.amount) || 0;

      quantityInput.value = "";
      totalDisplay.innerText = "£0.00";

      taskType = this.dataset.type;
      platformGroup.style.display = "block";

      if (taskType === "subscribe") {
        quantityLabel.innerText = "Number of Subscribers You Want";
        platformGroup.style.display = "none";
        document.getElementById("taskPlatform").value = "YouTube";
        document.getElementById("taskLink").placeholder = "Enter your YouTube channel link";
      } else if (taskType === "like") {
        quantityLabel.innerText = "Number of Likes You Want";
        document.getElementById("taskLink").placeholder = "Enter your post link";
      } else if (taskType === "comment") {
        quantityLabel.innerText = "Number of Comments You Want";
        document.getElementById("taskLink").placeholder = "Enter your post link";
      } else {
        quantityLabel.innerText = "Number of Followers You Want";
        document.getElementById("taskLink").placeholder = "Enter your page/profile link";
      }

      taskModal.style.display = "flex";
    });
  });

  quantityInput?.addEventListener("input", function () {
    const quantity = parseFloat(this.value);

    if (!isNaN(quantity) && quantity > 0) {
      const total = quantity * currentPrice;
      totalDisplay.innerText = "£" + total.toFixed(2);
    } else {
      totalDisplay.innerText = "£0.00";
    }
  });

  closeTaskModal?.addEventListener("click", function () {
    taskModal.style.display = "none";
  });

  window.addEventListener("click", function (e) {
    if (e.target === taskModal) {
      taskModal.style.display = "none";
    }
  });


  // ================================
  // SUBMIT TASK
  // ================================
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
        submitTaskBtn.disabled = false;
        return;
      }

      alert("Task created successfully!");

      document.getElementById("balanceAmount").textContent =
        "£" + parseFloat(data.new_balance).toFixed(2);

      taskModal.style.display = "none";

      loadUser();
      loadTasks();

    } catch (err) {
      console.error("REAL ERROR:", err);
      alert("Check console.");
    } finally {
      submitTaskBtn.disabled = false;
    }
  });


  // ================================
  // INIT
  // ================================
  loadUser();
  loadTasks();

});