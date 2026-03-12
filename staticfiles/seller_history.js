// ===============================
// RELIST CONFIRMATION
// ===============================
document.querySelectorAll(".relist-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const ok = confirm("Relist this product for sale?");
    if(ok){
      alert("Feature coming soon 😎");
      // later → call backend
    }
  });
});
