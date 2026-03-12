// login_modal.js
document.addEventListener('DOMContentLoaded', function () {
  // password toggle
  const mPwToggle = document.getElementById('mPwToggle');
  const mPassword = document.getElementById('m-password');
  if (mPwToggle && mPassword) {
    mPwToggle.addEventListener('click', () => {
      const isPw = mPassword.type === 'password';
      mPassword.type = isPw ? 'text' : 'password';
      mPwToggle.innerHTML = isPw ? '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
    });
  }

  // form submit placeholder
  const mForm = document.getElementById('modalLoginForm');
  if (mForm) {
    mForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const user = document.getElementById('m-username').value.trim();
      const pw = document.getElementById('m-password').value;
      if (!user || !pw) {
        alert('Please enter username and password.');
        return;
      }
      alert('Modal login submitted — replace with real auth flow.');
    });
  }

  // close button hides page (simulate closing modal)
  const closeBtn = document.getElementById('modalClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      // simple UX: fade out then navigate back
      document.querySelector('.modal-page').style.transition = 'opacity .25s';
      document.querySelector('.modal-page').style.opacity = 0;
      setTimeout(()=> window.location.href = 'index.html', 250);
    });
  }
});
