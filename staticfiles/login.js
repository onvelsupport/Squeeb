document.addEventListener('DOMContentLoaded', function () {

  const pwToggle = document.getElementById('pwToggle');
  const pwInput = document.getElementById('password');

  if (pwToggle && pwInput) {
    pwToggle.addEventListener('click', () => {
      const isPw = pwInput.type === 'password';
      pwInput.type = isPw ? 'text' : 'password';
      pwToggle.innerHTML = isPw
        ? '<i class="fa fa-eye"></i>'
        : '<i class="fa fa-eye-slash"></i>';
    });
  }

  const form = document.getElementById('loginForm');

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if (!username || !password) {
        alert('Please enter username and password.');
        return;
      }

      try {

        const response = await fetch("/api/login/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "Login failed");
          return;
        }

        // SUCCESS
        window.location.href = "/dashboard/";  // ✔ FIXED

      } catch (err) {
        alert("Server connection failed");
        console.error(err);
      }
    });
  }
});
