document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     1️⃣ GLOBAL HELPERS
  ===================================================== */

  const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

  const membershipSection = document.getElementById("membershipSection");
  const taskSection = document.getElementById("taskSection");
  const payMembershipBtn = document.getElementById("payMembershipBtn");

  const taskModal = document.getElementById("taskModal");
  const cancelTaskBtn = document.getElementById("cancelTaskBtn");
  const submitProofBtn = document.getElementById("submitProofBtn");

  let selectedTaskId = null;


  /* =====================================================
     2️⃣ CLOSE TASK MODAL BUTTON
  ===================================================== */

  cancelTaskBtn?.addEventListener("click", () => {
    taskModal.style.display = "none";
  });


  /* =====================================================
     3️⃣ LOAD USER + MEMBERSHIP CHECK
  ===================================================== */

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

      if (data.is_member) {
        membershipSection.style.display = "none";
        taskSection.style.display = "block";
        loadTasks();
      } else {
        membershipSection.style.display = "block";
        taskSection.style.display = "none";
      }

    } catch (err) {
      console.error("User load error:", err);
    }
  }


  /* =====================================================
     4️⃣ LOAD TASKS FROM DATABASE
  ===================================================== */

  async function loadTasks() {
    try {
      const res = await fetch("/api/tasks/", { credentials: "include" });

      if (!res.ok) {
        console.log("Not allowed to see tasks.");
        return;
      }

      const data = await res.json();
      const taskList = document.getElementById("taskList");

      taskList.innerHTML = "";

      if (data.tasks.length === 0) {
        taskList.innerHTML = "<p>No tasks available.</p>";
        return;
      }

      data.tasks.forEach(task => {
  taskList.innerHTML += `
  <div class="earn-task-card">

    <div class="earn-task-left">
      <h3>${task.title}</h3>
      <p>${task.instructions}</p>
      <p><strong>£${task.payout}</strong> per ${task.task_type}</p>
      <p>${task.available} tasks remaining</p>
    </div>

    <div class="earn-task-right">
      <button class="select-task-btn" data-id="${task.id}">
        Select Task
      </button>
    </div>

  </div>
`;
});

    } catch (err) {
      console.error("Task load error:", err);
    }
  }


  /* =====================================================
     5️⃣ SELECT TASK → OPEN MODAL
     (Event delegation for dynamic buttons)
  ===================================================== */

document.addEventListener("click", async function (e) {

  const button = e.target.closest(".select-task-btn");

  if (!button) return;

  selectedTaskId = button.dataset.id;

  try {
    const res = await fetch(`/api/task/${selectedTaskId}/`, {
      credentials: "include"
    });

    if (!res.ok) {
      console.error("Task fetch failed:", res.status);
      return;
    }

    const task = await res.json();

    document.getElementById("modalTaskTitle").textContent = task.title;
    document.getElementById("modalPlatform").textContent = task.platforms || "";
    document.getElementById("modalType").textContent = task.task_type || "";

    // ===== Instructions (safe version)
const instructionsBox = document.getElementById("modalTaskInstructions");
instructionsBox.innerHTML = "";

if (typeof task.instructions === "string" && task.instructions.trim() !== "") {

  const lines = task.instructions
    .split("\n")
    .filter(line => line.trim() !== "");

  instructionsBox.innerHTML = `
    <ul style="padding-left:18px;">
      ${lines.map(line => `<li>${line}</li>`).join("")}
    </ul>
  `;

} else {
  instructionsBox.innerHTML = `
    <ul style="padding-left:18px;">
      <li>No instructions provided.</li>
    </ul>
  `;
}

    // Link
    const linkEl = document.getElementById("modalTaskLink");
    if (task.link) {
      linkEl.href = task.link;
      linkEl.style.display = "inline";
    } else {
      linkEl.style.display = "none";
    }

    document.getElementById("modalTaskReward").textContent =
      `Earn £${task.payout}`;

    taskModal.style.display = "flex";

  } catch (err) {
    console.error("Modal load error:", err);
  }
});

  /* =====================================================
     6️⃣ SUBMIT PROOF (COMPLETE TASK)
  ===================================================== */

  submitProofBtn?.addEventListener("click", async () => {

    const fileInput = document.getElementById("proofInput");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please upload screenshot proof.");
      return;
    }

    const formData = new FormData();
    formData.append("proof", file);

    const res = await fetch(`/api/complete-task/${selectedTaskId}/`, {
      method: "POST",
      credentials: "include",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Task completed! Balance updated.");
    taskModal.style.display = "none";
    loadTasks();
  });


  /* =====================================================
     7️⃣ MEMBERSHIP PAYMENT
  ===================================================== */

  payMembershipBtn?.addEventListener("click", async () => {

    payMembershipBtn.disabled = true;

    try {
      const res = await fetch("/pay-membership/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        payMembershipBtn.disabled = false;
        return;
      }

      alert("Membership Activated!");

      membershipSection.style.display = "none";
      taskSection.style.display = "block";

      loadTasks();

    } catch (err) {
      alert("Network error.");
    }

    payMembershipBtn.disabled = false;
  });


  /* =====================================================
     8️⃣ INITIALIZE PAGE
  ===================================================== */

  loadUser();

});



/* =====================================================
   9️⃣ LOGOUT
===================================================== */

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



/* =====================================================
   🔟 EARN MODAL
===================================================== */

const earnModal = document.getElementById("earnModal");
const earnClose = document.getElementById("earnClose");

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



/* =====================================================
   1️⃣1️⃣ ADVERTISE MODAL
===================================================== */

const adModal = document.getElementById("adModal");
const adClose = document.getElementById("adClose");

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