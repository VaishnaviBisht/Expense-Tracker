// ---------- 1. Setup ----------
const $ = (id) => document.getElementById(id);
const cats = {
  Food: { icon: "🍔", color: "#f97316" }, Travel: { icon: "🚌", color: "#06b6d4" },
  Shopping: { icon: "🛍️", color: "#ec4899" }, Bills: { icon: "💡", color: "#eab308" },
  Other: { icon: "📦", color: "#8b5cf6" }, Income: { icon: "💵", color: "#22c55e" }
};
const spendCats = ["Food", "Travel", "Shopping", "Bills", "Other"];

let transactions = JSON.parse(localStorage.getItem("expenses")) || [];
transactions.forEach((t) => { t.type = t.type || "expense"; });          // old data = expenses
let budget = Number(localStorage.getItem("budget")) || 0;
let catBudgets = JSON.parse(localStorage.getItem("catBudgets")) || {};
let editId = null;

const money = (n) => "₹" + n.toLocaleString("en-IN");
const toISO = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
const spentIn = (list, cat) => list.filter((t) => t.type === "expense" && t.category === cat).reduce((s, t) => s + t.amount, 0);
const barClass = (p) => (p < 70 ? "fill" : p < 100 ? "fill warn" : "fill over");

$("month").value = toISO(new Date()).slice(0, 7);
$("today").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

// fill the category drop-downs
spendCats.forEach((c) => {
  $("category").innerHTML += '<option value="' + c + '">' + cats[c].icon + " " + c + "</option>";
  $("fCat").innerHTML += '<option value="' + c + '">' + c + "</option>";
});
$("fCat").innerHTML += '<option value="Income">Income</option>';

if (localStorage.getItem("dark") === "yes") { document.body.classList.add("dark"); $("themeBtn").textContent = "☀️ Light mode"; }

// ---------- 2. Save, toast, page switching ----------
function save() {
  localStorage.setItem("expenses", JSON.stringify(transactions));
  localStorage.setItem("budget", budget);
  localStorage.setItem("catBudgets", JSON.stringify(catBudgets));
}
let timer;
function toast(msg) {
  $("toast").textContent = msg; $("toast").classList.add("show");
  clearTimeout(timer); timer = setTimeout(() => $("toast").classList.remove("show"), 2200);
}
const titles = { dashboard: "Dashboard", transactions: "Transactions", budgets: "Budgets" };
function go(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("v-" + view).classList.remove("hidden");
  document.querySelectorAll("nav .nav").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("pageTitle").textContent = titles[view];
}

// transactions that belong to the selected month (empty month = all time)
const inView = (t) => !$("month").value || t.date.startsWith($("month").value);

// ---------- 3. Add / edit popup ----------
function openForm(t) {
  editId = t ? t.id : null;
  $("dlgTitle").textContent = t ? "Edit transaction" : "New transaction";
  $("type").value = t ? t.type : "expense";
  $("title").value = t ? t.title : "";
  $("amount").value = t ? t.amount : "";
  $("category").value = t && t.type === "expense" ? t.category : "Food";
  $("date").value = t ? t.date : toISO(new Date());
  $("error").textContent = "";
  checkType();
  $("dlg").showModal();
}
function checkType() { $("category").disabled = $("type").value === "income"; }

function saveForm() {
  const title = $("title").value.trim(), amount = Number($("amount").value);
  if (title === "" || amount <= 0 || $("date").value === "") {
    $("error").textContent = "Please enter a title, a valid amount and a date."; return;
  }
  const type = $("type").value;
  const data = { title, amount, type, category: type === "income" ? "Income" : $("category").value, date: $("date").value };
  if (editId) {
    Object.assign(transactions.find((t) => t.id === editId), data);
  } else {
    transactions.push({ id: Date.now(), ...data });
  }
  save(); render(); $("dlg").close();
  toast(editId ? "Changes saved ✅" : "Transaction added ✅");
}

function remove(id) {
  transactions = transactions.filter((t) => t.id !== id);
  save(); render(); toast("Deleted 🗑️");
}

// ---------- 4. Dashboard ----------
function renderDashboard(v) {
  const income = sum(v, "income"), spent = sum(v, "expense");
  $("balance").textContent = money(income - spent);
  $("hint").textContent = "Income " + money(income) + "  •  Spent " + money(spent);
  $("income").textContent = money(income);
  $("spent").textContent = money(spent);
  $("count").textContent = v.length;

  // hero budget bar
  if (budget > 0) {
    const p = Math.min((spent / budget) * 100, 100);
    $("barFill").style.width = p + "%"; $("barFill").className = barClass(p);
    $("budgetMsg").textContent = spent > budget ? "⚠️ Over budget by " + money(spent - budget) : Math.round(p) + "% of " + money(budget) + " used";
  } else {
    $("barFill").style.width = "0"; $("budgetMsg").textContent = "No budget set. Go to the Budgets page.";
  }

  // top category
  let top = "—", topSum = 0;
  spendCats.forEach((c) => { const s = spentIn(v, c); if (s > topSum) { topSum = s; top = cats[c].icon + " " + c; } });
  $("topCat").textContent = top;

  // last 7 days bar chart (uses all expenses, not only the month)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const day = toISO(d);
    const total = transactions.filter((t) => t.type === "expense" && t.date === day).reduce((s, t) => s + t.amount, 0);
    days.push({ label: d.toLocaleDateString("en-IN", { weekday: "short" }), total });
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  $("week").innerHTML = days.map((d) =>
    '<div class="col"><span class="v">' + (d.total ? "₹" + d.total : "") + '</span><div class="b" style="height:' +
    Math.round((d.total / max) * 130) + 'px"></div><small>' + d.label + "</small></div>").join("");

  // donut chart
  $("donutTotal").textContent = money(spent);
  $("legend").innerHTML = "";
  if (spent === 0) {
    $("donut").style.background = ""; $("legend").innerHTML = '<p class="empty">No spending yet.</p>';
  } else {
    let start = 0; const parts = [];
    spendCats.forEach((c) => {
      const s = spentIn(v, c); if (!s) return;
      const p = (s / spent) * 100;
      parts.push(cats[c].color + " " + start + "% " + (start + p) + "%"); start += p;
      $("legend").innerHTML += '<div class="leg"><i class="dot" style="background:' + cats[c].color + '"></i><span>' +
        cats[c].icon + " " + c + "</span><b>" + money(s) + "</b><em>" + Math.round(p) + "%</em></div>";
    });
    $("donut").style.background = "conic-gradient(" + parts.join(",") + ")";
  }

  // 5 most recent
  const recent = [...v].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5);
  $("recent").innerHTML = recent.length ? "" : '<li class="empty">No transactions. Click "+ New transaction" or load demo data.</li>';
  recent.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = '<span class="icon" style="background:' + cats[t.category].color + '33">' + cats[t.category].icon + "</span>" +
      '<div class="info"><strong></strong><small>' + t.category + " • " + niceDate(t.date) + "</small></div>" + amountHTML(t);
    li.querySelector("strong").textContent = t.title;
    $("recent").appendChild(li);
  });
}
const niceDate = (d) => new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const amountHTML = (t) => t.type === "income" ? '<b class="plus">+' + money(t.amount) + "</b>" : '<b class="minus">−' + money(t.amount) + "</b>";

// ---------- 5. Transactions table ----------
function renderTable(v) {
  const q = $("search").value.toLowerCase();
  const list = v.filter((t) =>
    ($("fType").value === "All" || t.type === $("fType").value) &&
    ($("fCat").value === "All" || t.category === $("fCat").value) &&
    t.title.toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  $("rows").innerHTML = list.length ? "" : '<tr><td colspan="5" class="empty">No transactions found.</td></tr>';
  list.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + niceDate(t.date) + "</td><td></td><td>" + cats[t.category].icon + " " + t.category +
      '</td><td class="r">' + amountHTML(t) + '</td><td class="r"><button class="act" title="Edit">✏️</button><button class="act" title="Delete">🗑️</button></td>';
    tr.children[1].textContent = t.title;
    const btns = tr.querySelectorAll(".act");
    btns[0].onclick = () => openForm(t);
    btns[1].onclick = () => remove(t.id);
    $("rows").appendChild(tr);
  });
}

// ---------- 6. Budgets page ----------
function renderBudgets(v) {
  const spent = sum(v, "expense");
  if (budget > 0) {
    const p = Math.min((spent / budget) * 100, 100);
    $("bFill").style.width = p + "%"; $("bFill").className = barClass(p);
    $("bMsg").textContent = money(spent) + " spent of " + money(budget) + (spent > budget ? " (over budget!)" : " (" + money(budget - spent) + " left)");
  } else {
    $("bFill").style.width = "0"; $("bMsg").textContent = "Enter an amount above to set your monthly budget.";
  }

  $("catBudgets").innerHTML = "";
  spendCats.forEach((c) => {
    const s = spentIn(v, c), limit = catBudgets[c] || 0;
    const p = limit ? Math.min((s / limit) * 100, 100) : 0;
    const row = document.createElement("div");
    row.className = "cb";
    row.innerHTML = "<b>" + cats[c].icon + " " + c + '</b><div><div class="bar"><div class="' + barClass(p) + '" style="width:' + p +
      '%"></div></div><small>' + money(s) + (limit ? " of " + money(limit) + (s > limit ? " ⚠️ over" : "") : " spent • no limit") +
      '</small></div><input type="number" min="0" placeholder="Limit ₹" value="' + (limit || "") + '">';
    row.querySelector("input").onchange = (e) => { catBudgets[c] = Number(e.target.value); save(); render(); toast("Limit saved ✅"); };
    $("catBudgets").appendChild(row);
  });
}

// ---------- 7. Draw everything ----------
function render() {
  const v = transactions.filter(inView);
  renderDashboard(v); renderTable(v); renderBudgets(v);
}

// ---------- 8. Demo data ----------
function loadDemo() {
  const items = [
    ["Pocket money", 8000, "income", "Income", 0], ["Freelance project", 3500, "income", "Income", 3],
    ["Lunch at canteen", 120, "expense", "Food", 0], ["Bus pass", 450, "expense", "Travel", 1],
    ["Notebooks and pens", 260, "expense", "Shopping", 2], ["Wi-Fi recharge", 399, "expense", "Bills", 3],
    ["Dinner with friends", 650, "expense", "Food", 3], ["Movie ticket", 220, "expense", "Other", 4],
    ["Metro card", 300, "expense", "Travel", 5], ["T-shirt", 799, "expense", "Shopping", 6],
    ["Coffee", 140, "expense", "Food", 6], ["Electricity bill", 900, "expense", "Bills", 2]
  ];
  items.forEach((it, i) => {
    const d = new Date(); d.setDate(d.getDate() - it[4]);
    transactions.push({ id: Date.now() + i, title: it[0], amount: it[1], type: it[2], category: it[3], date: toISO(d) });
  });
  if (!budget) budget = 10000;
  if (!Object.keys(catBudgets).length) catBudgets = { Food: 3000, Travel: 1500, Shopping: 2500, Bills: 2000, Other: 1000 };
  save(); render(); toast("Demo data loaded ✨");
}

// ---------- 9. Export to CSV ----------
function exportCSV() {
  const rows = [["Date", "Title", "Type", "Category", "Amount"], ...transactions.map((t) => [t.date, t.title, t.type, t.category, t.amount])];
  const csv = rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "expenses.csv"; a.click();
  toast("CSV downloaded ⬇");
}

// ---------- 10. Events ----------
document.querySelectorAll("nav .nav").forEach((b) => (b.onclick = () => go(b.dataset.view)));
$("newBtn").onclick = () => openForm();
$("saveBtn").onclick = saveForm;
$("cancelBtn").onclick = () => $("dlg").close();
$("type").onchange = checkType;
$("month").onchange = render;
$("search").oninput = render; $("fType").onchange = render; $("fCat").onchange = render;
$("demoBtn").onclick = loadDemo;
$("exportBtn").onclick = exportCSV;
$("amount").onkeydown = (e) => { if (e.key === "Enter") saveForm(); };
$("budgetBtn").onclick = () => { budget = Math.max(Number($("budget").value), 0); save(); render(); $("budget").value = ""; toast("Budget updated ✅"); };
$("clearBtn").onclick = () => {
  if (transactions.length && confirm("Delete ALL transactions?")) { transactions = []; save(); render(); toast("All cleared"); }
};
$("themeBtn").onclick = () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("dark", dark ? "yes" : "no");
  $("themeBtn").textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
};

render();
