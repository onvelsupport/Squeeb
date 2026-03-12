document.addEventListener("DOMContentLoaded", () => {

  // ============================
  // LOAD USER INFO
  // ============================
  async function loadUser() {
    try {
      const res = await fetch("/api/user-info/", {
        credentials: "include"
      });

      if (!res.ok) {
        window.location.href = "/login/";
        return;
      }

      const data = await res.json();

      document.getElementById("usernameDisplay").textContent = data.username;
      document.getElementById("usernameTag").textContent = "@" + data.username;
      document.getElementById("followers").textContent = data.followers || 0;
      document.getElementById("following").textContent = data.following || 0;

      document.getElementById("miniName").textContent = data.username;
      document.getElementById("miniUsername").textContent = "@" + data.username;

    } catch {
      window.location.href = "/login/";
    }
  }


  // ============================
  // ― UNIVERSAL LOGOUT ―
  // ============================
  async function logoutUser(e) {
    e.preventDefault(); // ⭐ stop <a href="#"> from reloading page

    try {
      await fetch("/api/logout/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
    } catch {}

    window.location.href = "/login/";
  }

  // ⭐ Bind ALL logout buttons (dropdown + page list)
  function bindLogout() {
    document.querySelectorAll(".logout, .logout-item, #logoutBtn, #logoutLink")
      .forEach(btn => {
        btn.addEventListener("click", logoutUser);
      });
  }


  // ============================
  // ITEM CLICK ANIMATION
  // ============================
  document.querySelectorAll(".set-item").forEach(item => {
    item.addEventListener("click", () => {
      item.style.background = "#EEE";
      setTimeout(() => item.style.background = "white", 150);
    });
  });


  // =====================================================
  // EARN MODAL
  // =====================================================
  const earnModal = document.getElementById("earnModal");
  const earnClose = document.getElementById("earnClose");

  document.querySelectorAll(".fa-coins").forEach(btn => {
    btn.parentElement.addEventListener("click", e => {
      e.preventDefault();
      earnModal.style.display = "flex";
    });
  });

  earnClose?.addEventListener("click", () => {
    earnModal.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === earnModal) {
      earnModal.style.display = "none";
    }
  });


  // =====================================================
  // ADVERTISE MODAL
  // =====================================================
  const adModal = document.getElementById("adModal");
  const adClose = document.getElementById("adClose");

  document.querySelectorAll(".fa-bullhorn").forEach(btn => {
    btn.parentElement.addEventListener("click", e => {
      e.preventDefault();
      adModal.style.display = "flex";
    });
  });

  adClose?.addEventListener("click", () => {
    adModal.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === adModal) {
      adModal.style.display = "none";
    }
  });


  // ============================
  // INIT
  // ============================
  loadUser();
  bindLogout(); // ⭐ IMPORTANT

});
