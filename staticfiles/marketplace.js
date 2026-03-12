// ================================
// EDIT PRODUCT MODAL
// ================================
const editModal = document.getElementById("editModal");
const closeEditModal = document.getElementById("closeEditModal");
const editForm = document.getElementById("editForm");

document.querySelectorAll(".edit-btn").forEach(btn => {
  btn.addEventListener("click", () => {

    editModal.style.display = "flex";

    document.getElementById("editId").value = btn.dataset.id;
    document.getElementById("editTitle").value = btn.dataset.title;
    document.getElementById("editPrice").value = btn.dataset.price;
    document.getElementById("editCategory").value = btn.dataset.category;
    document.getElementById("editDescription").value = btn.dataset.description;

    document.getElementById("editSold").checked = btn.dataset.sold === "1";

    editForm.action = "/edit-product/" + btn.dataset.id + "/";

  });
});

closeEditModal?.addEventListener("click", () => {
  editModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === editModal) {
    editModal.style.display = "none";
  }
});


// ================================
// PRODUCTS
// ================================
const products = [
{
  title:"Smart Watch",
  price:6000,
  old:10526,
  discount:42,
  cat:"electronics",
  img:"/static/img/product1.jpg"
},
{
  title:"Fashion Sneakers",
  price:10500,
  old:16450,
  discount:36,
  cat:"fashion",
  img:"/static/img/product2.jpg"
},
{
  title:"Exam Guide 2026",
  price:2500,
  old:5875,
  discount:57,
  cat:"books",
  img:"/static/img/product3.jpg"
}
];

const grid = document.getElementById("productGrid");

function money(n){
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(n);
}

function render(list){
  if(!grid) return;
  grid.innerHTML = "";

  list.forEach(p=>{
    grid.innerHTML += `
    <div class="card">
      <img src="${p.img}">
      <h3>${p.title}</h3>

      <div class="price">${money(p.price)}</div>
      <div class="old">${money(p.old)}</div>
      <span class="badge">-${p.discount}%</span>

      <button class="btn">VIEW PRODUCT</button>
    </div>`;
  });
}

render(products);


// ================================
// SEARCH
// ================================
const searchInput = document.getElementById("searchInput");
searchInput?.addEventListener("input", e=>{
  const q = e.target.value.toLowerCase();
  render(products.filter(p=>p.title.toLowerCase().includes(q)));
});


// ================================
// CATEGORY FILTER
// ================================
document.querySelectorAll("#categoryList li")
.forEach(li=>{
  li.onclick = ()=>{
    const cat = li.dataset.cat;
    if(cat==="all") render(products);
    else render(products.filter(p=>p.cat===cat));
  };
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

// ================================
// ADD PRODUCT MODAL
// ================================
const sellModal = document.getElementById("sellModal");
const openSellBtn = document.getElementById("openSellModal");
const closeSellBtn = document.getElementById("closeSellModal");

openSellBtn?.addEventListener("click", () => {
  sellModal.style.display = "flex";
});

closeSellBtn?.addEventListener("click", () => {
  sellModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === sellModal) {
    sellModal.style.display = "none";
  }
});

// ================================
// LOGOUT (AJAX)
// ================================
document.querySelectorAll(".logout").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      await fetch("/logout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });

      // after logout → go to login page
      window.location.href = "/login/";

    } catch (err) {
      console.error("Logout failed:", err);
    }
  });
});

// ================================
// DELETE CONFIRMATION
// ================================
document.querySelectorAll(".delete-product").forEach(btn => {
  btn.addEventListener("click", function(e) {
    e.preventDefault();

    const ok = confirm("Are you sure you want to delete this product?");
    if (ok) {
      window.location.href = this.href;
    }
  });
});


