// ═══════════════════════════════════════════════════
//  STATE MANAGEMENT
// ═══════════════════════════════════════════════════
let S = {
  groups:    [],
  activity:  [],
  notifs:    [],
  currency:  'Rs',
  userName:  'You',
  receipts:  {}
};

let curGroupId   = null;
let selEmoji     = '🍕';
let selExpCat    = '🍽️';
let splitMode    = 'equal';
let selPayer     = null;
let selSplitMems = [];
let receiptData  = null;
let deferredPrompt = null;

const COLORS = ['#c8f135','#4f8aff','#ff5f5f','#3dd68c','#ffb444','#a78bfa','#f472b6','#38bdf8','#fb923c','#a3e635'];
const G_EMOJIS = ['🍕','🏖️','🏠','✈️','🎉','🍺','🛒','🎮','🏕️','🚗','💼','🎵','🍜','🏋️','🎲','🍰','🐾','🌴','🎓','💊','🛵','🧹','🎭','🏄'];
const EXP_CATS = ['🍽️','🚗','🏨','🎬','🛒','💊','⚡','📦','🎮','✈️','☕','🍺','🎁','🏥','📚','🔧'];

// ═══════════════════════════════════════════════════
//  DATA STORAGE PERSISTENCE
// ═══════════════════════════════════════════════════
function save() {
  try { localStorage.setItem('bsp_v2', JSON.stringify(S)); } catch(e){}
}
function load() {
  try {
    const d = localStorage.getItem('bsp_v2');
    if (d) S = { ...S, ...JSON.parse(d) };
  } catch(e){}
}
load();

// ═══════════════════════════════════════════════════
//  NATIVE PWA LIFE-CYCLE HANDLERS
// ═══════════════════════════════════════════════════
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('bsp_install_dismissed')) {
    document.getElementById('installBanner').classList.add('show');
  }
});

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') toast('✓ App installed!');
      document.getElementById('installBanner').classList.remove('show');
      deferredPrompt = null;
    });
  }
}
function dismissInstall() {
  document.getElementById('installBanner').classList.remove('show');
  localStorage.setItem('bsp_install_dismissed', '1');
}

// NATIVE PWA SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// ═══════════════════════════════════════════════════
//  NAVIGATION ENGINE
// ═══════════════════════════════════════════════════
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const ni = document.getElementById('nav-' + page);
  if (ni) ni.classList.add('active');
  document.getElementById('fab').style.display = page === 'home' ? 'flex' : 'none';
  if (page === 'home')     renderHome();
  if (page === 'activity') renderActivity();
  if (page === 'friends')  renderFriends();
  if (page === 'settings') renderSettings();
}

// ═══════════════════════════════════════════════════
//  UI MODAL LAYER ROUTERS
// ═══════════════════════════════════════
function showModal(id) {
  document.getElementById('modal-' + id).classList.add('open');
  if (id === 'newGroup')   buildEmojiGrid('emojiGrid', false);
  if (id === 'notif')      renderNotifs();
}
function closeModal(id) {
  document.getElementById('modal-' + id).classList.remove('open');
}
function closeOutside(e, id) {
  if (e.target === document.getElementById('modal-' + id)) closeModal(id);
}

// ═══════════════════════════════════════════════════
//  EMOJI COMPONENT GENERATOR
// ═══════════════════════════════════════════════════
function buildEmojiGrid(id, isExp) {
  const arr = isExp ? EXP_CATS : G_EMOJIS;
  const cur = isExp ? selExpCat : selEmoji;
  const el  = document.getElementById(id);
  el.innerHTML = '';
  arr.forEach(em => {
    const b = document.createElement('button');
    b.className = 'ep-btn' + (em === cur ? ' sel' : '');
    b.textContent = em;
    b.onclick = () => {
      el.querySelectorAll('.ep-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      if (isExp) selExpCat = em; else selEmoji = em;
    };
    el.appendChild(b);
  });
}

// ═══════════════════════════════════════════════════
//  GROUP DATA CONTROLLER
// ═══════════════════════════════════════════════════
function createGroup() {
  const name = document.getElementById('ng-name').value.trim();
  if (!name) { toast('Enter a group name', true); return; }

  const raw = document.getElementById('ng-members').value.trim();
  let mems  = raw ? raw.split(',').map(m => m.trim()).filter(Boolean) : [];
  if (!mems.includes(S.userName)) mems.unshift(S.userName);

  const g = {
    id:       Date.now(),
    name,
    emoji:    selEmoji,
    members:  mems.map((n,i) => ({ id: i+1, name: n, color: COLORS[i % COLORS.length] })),
    expenses: [],
    settled:  [],
    created:  new Date().toISOString()
  };

  S.groups.unshift(g);
  addNotif(`Group <b>${name}</b> created with ${g.members.length} members`);
  save();
  closeModal('newGroup');
  document.getElementById('ng-name').value = '';
  document.getElementById('ng-members').value = '';
  toast('✓ ' + name + ' created!');
  openGroup(g.id);
}

function openGroup(id) {
  curGroupId = id;
  const g = getGroup();
  if (!g) return;
  document.getElementById('gd-emoji').textContent = g.emoji;
  document.getElementById('gd-name').textContent  = g.name;
  document.getElementById('gd-meta').textContent  = `${g.members.length} members · ${g.expenses.length} expenses`;
  renderBalances(g);
  renderExpenses(g);
  renderSettlements(g);
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-group').classList.add('active');
  document.getElementById('fab').style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

function getGroup() { return S.groups.find(g => g.id === curGroupId); }

// ═══════════════════════════════════════════════════
//  BALANCE ARITHMETIC CORE ENGINE
// ═══════════════════════════════════════════════════
function calcBalances(g) {
  const bal = {};
  g.members.forEach(m => bal[m.name] = 0);
  g.expenses.forEach(exp => {
    Object.entries(exp.splits).forEach(([mem, share]) => {
      if (mem !== exp.payer) {
        bal[exp.payer] = (bal[exp.payer] || 0) + share;
        bal[mem]       = (bal[mem]       || 0) - share;
      }
    });
  });
  (g.settled || []).forEach(s => {
    bal[s.from] = (bal[s.from] || 0) + s.amount;
    bal[s.to]   = (bal[s.to]   || 0) - s.amount;
  });
  return bal;
}

function renderBalances(g) {
  const bal = calcBalances(g);
  const row = document.getElementById('balanceRow');
  row.innerHTML = '';
  g.members.forEach(m => {
    const b = bal[m.name] || 0;
    const chip = document.createElement('div');
    chip.className = 'balance-chip';
    chip.innerHTML = `
      <div class="bc-avatar" style="background:${m.color}22;color:${m.color}">${m.name.toUpperCase()}</div>
      <div class="bc-name">${m.name}</div>
      <div class="bc-amt ${b > 0.5 ? 'pos' : b < -0.5 ? 'neg' : 'zero'}">
        ${b > 0.5 ? '+' : ''}${S.currency} ${Math.abs(b).toFixed(0)}
      </div>
    `;
    row.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════════
//  MIN CASH FLOW CORE SETTLEMENT ALGORITHM
// ═══════════════════════════════════════════════════
function minCashFlow(bal) {
  const pos = [], neg = [];
  Object.entries(bal).forEach(([n, a]) => {
    if (a >  0.5) pos.push({n, a});
    if (a < -0.5) neg.push({n, a: -a});
  });
  pos.sort((a,b) => b.a - a.a);
  neg.sort((a,b) => b.a - a.a);
  const txns = [];
  let pi = 0, ni = 0;
  while (pi < pos.length && ni < neg.length) {
    const amt = Math.min(pos[pi].a, neg[ni].a);
    txns.push({ from: neg[ni].n, to: pos[pi].n, amount: amt });
    pos[pi].a -= amt; neg[ni].a -= amt;
    if (pos[pi].a < 0.5) pi++;
    if (neg[ni].a < 0.5) ni++;
  }
  return txns;
}

function renderSettlements(g) {
  const bal    = calcBalances(g);
  const txns   = minCashFlow(bal);
  const card   = document.getElementById('settleCard');
  if (!txns.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="settle-card">
      <div class="settle-title">
        <span>✓ How to settle up</span>
        <span style="color:var(--sub);font-size:10px">${txns.length} transaction${txns.length>1?'s':''}</span>
      </div>
      ${txns.map(t => `
        <div class="settle-row">
          <span class="settle-from">${t.from}</span>
          <span class="settle-arrow">→</span>
          <span class="settle-amt">${S.currency} ${t.amount.toFixed(0)}</span>
          <span class="settle-to">${t.to}</span>
          <button class="settle-paid-btn" onclick="markSettled('${t.from}','${t.to}',${t.amount.toFixed(2)})">✓ Done</button>
        </div>`).join('')}
    </div>
  `;
}

function markSettled(from, to, amount) {
  const g = getGroup();
  if (!g) return;
  if (!g.settled) g.settled = [];
  g.settled.push({ from, to, amount: +amount, date: new Date().toISOString() });
  S.activity.unshift({
    icon: '✅', text: `<b>${from}</b> paid <b>${S.currency} ${amount.toFixed(0)}</b> to <b>${to}</b>`,
    amount: `${S.currency} ${amount.toFixed(0)}`, time: timeNow(), groupId: curGroupId
  });
  addNotif(`<b>${from}</b> settled ${S.currency} ${amount.toFixed(0)} with <b>${to}</b>`);
  save();
  renderBalances(g);
  renderSettlements(g);
  toast(`✓ Settled ${S.currency} ${amount.toFixed(0)}`);
}

// ═══════════════════════════════════════════════════
//  EXPENSE CREATION LAYER HANDLERS
// ═══════════════════════════════════════════════════
function showAddExpense() {
  const g = getGroup();
  if (!g) return;
  splitMode    = 'equal';
  selPayer     = g.members?.name || S.userName;
  selSplitMems = g.members.map(m => m.name);
  receiptData  = null;

  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-desc').value   = '';
  document.getElementById('exp-date').value   = new Date().toISOString().split('T');
  document.getElementById('receiptPreview').style.display = 'none';
  buildEmojiGrid('expCatGrid', true);

  const pl = document.getElementById('payerList');
  pl.innerHTML = '';
  g.members.forEach(m => {
    const b = document.createElement('button');
    b.className = 'payer-btn' + (m.name === selPayer ? ' active' : '');
    b.textContent = m.name;
    b.onclick = () => {
      pl.querySelectorAll('.payer-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selPayer = m.name;
    };
    pl.appendChild(b);
  });

  buildSplitChips(g);
  document.getElementById('customInputs').innerHTML = '';
  document.querySelectorAll('.st-tab').forEach((t,i) => t.classList.toggle('active', i===0));
  showModal('addExpense');
}

function buildSplitChips(g) {
  const con = document.getElementById('splitBetween');
  con.innerHTML = '';
  g.members.forEach(m => {
    const c = document.createElement('div');
    c.className = 'mc' + (selSplitMems.includes(m.name) ? ' sel' : '');
    c.innerHTML = `<div class="mc-av" style="background:${m.color}22;color:${m.color}">${m.name}</div>${m.name}`;
    c.onclick = () => {
      if (selSplitMems.includes(m.name)) {
        if (selSplitMems.length === 1) return;
        selSplitMems = selSplitMems.filter(x => x !== m.name);
      } else {
        selSplitMems.push(m.name);
      }
      c.classList.toggle('sel', selSplitMems.includes(m.name));
      rebuildCustom(g);
    };
    con.appendChild(c);
  });
}

function setSplit(mode, btn) {
  splitMode = mode;
  document.querySelectorAll('.st-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  rebuildCustom(getGroup());
}

function rebuildCustom(g) {
  const con = document.getElementById('customInputs');
  if (splitMode === 'equal') { con.innerHTML = ''; return; }
  const amt = parseFloat(document.getElementById('exp-amount').value) || 0;
  const sym = splitMode === 'percent' ? '%' : S.currency;
  const def = splitMode === 'percent'
    ? (100 / selSplitMems.length).toFixed(1)
    : (amt  / selSplitMems.length).toFixed(0);
  con.innerHTML = `<div class="form-group"><label class="f-label">Custom Amounts (${sym})</label>` +
    selSplitMems.map(n => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="flex:1;font-size:14px;font-weight:600">${n}</span>
        <input class="f-input" id="ci-${n.replace(/\s/g,'_')}" type="number" value="${def}" style="width:110px;text-align:right" inputmode="decimal">
        <span style="color:var(--sub);font-size:12px;width:24px">${sym}</span>
      </div>`).join('') + '</div>';
}

function handleReceipt(input) {
  const file = input.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    receiptData = e.target.result;
    const prev  = document.getElementById('receiptPreview');
    prev.src     = receiptData;
    prev.style.display = 'block';
    toast('📸 Receipt added');
  };
  reader.readAsDataURL(file);
}

function addExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const desc   = document.getElementById('exp-desc').value.trim() || 'Expense';
  const date   = document.getElementById('exp-date').value || new Date().toISOString().split('T');
  const g      = getGroup();
  if (!amount || amount <= 0) { toast('Enter a valid amount', true); return; }
  if (!selPayer)              { toast('Select who paid', true); return; }

  const splits = {};
  if (splitMode === 'equal') {
    const sh = +(amount / selSplitMems.length).toFixed(2);
    let total = 0;
    selSplitMems.forEach((m, i) => {
      splits[m] = (i === selSplitMems.length - 1) ? +(amount - total).toFixed(2) : sh;
      total += sh;
    });
  } else if (splitMode === 'percent') {
    let totalPct = 0;
    selSplitMems.forEach(m => {
      const pct = parseFloat(document.getElementById('ci-' + m.replace(/\s/g,'_'))?.value) || 0;
      splits[m]  = +(amount * pct / 100).toFixed(2);
      totalPct  += pct;
    });
    if (Math.abs(totalPct - 100) > 1) { toast('Percentages must total 100%', true); return; }
  } else {
    let total = 0;
    selSplitMems.forEach(m => {
      const v  = parseFloat(document.getElementById('ci-' + m.replace(/\s/g,'_'))?.value) || 0;
      splits[m] = +v.toFixed(2); total += v;
    });
    if (Math.abs(total - amount) > 1) { toast(`Splits must total ${S.currency} ${amount}`, true); return; }
  }

  const exp = {
    id:      Date.now(),
    desc, amount, payer: selPayer, splits,
    cat:     selExpCat, date,
    receipt: receiptData,
    groupId: curGroupId
  };

  g.expenses.unshift(exp);
  if (receiptData) S.receipts[exp.id] = receiptData;

  S.activity.unshift({
    icon: selExpCat,
    text: `<b>${selPayer}</b> paid <b>${S.currency} ${amount.toFixed(0)}</b> for "${desc}"`,
    amount: `${S.currency} ${amount.toFixed(0)}`,
    time: timeNow(), groupId: curGroupId
  });

  addNotif(`New expense: <b>${desc}</b> — ${S.currency} ${amount.toFixed(0)}`);
  save();
  closeModal('addExpense');
  renderExpenses(g);
  renderBalances(g);
  renderSettlements(g);
  document.getElementById('gd-meta').textContent = `${g.members.length} members · ${g.expenses.length} expenses`;
  toast(`✓ ${S.currency} ${amount.toFixed(0)} added`);
}

// ═══════════════════════════════════════════════════
//  VIEW PORT DATA RENDER ENGINES
// ═══════════════════════════════════════════════════
function renderExpenses(g) {
  const list = document.getElementById('expensesList');
  if (!g.expenses.length) {
    list.innerHTML = `<div class="empty-state"><span class="es-icon">💸</span><div class="es-title">No expenses yet</div><div class="es-sub">Tap + Add to record your first expense</div></div>`;
    return;
  }
  list.innerHTML = g.expenses.map(exp => {
    const myShare = exp.splits[S.userName] || 0;
    const isMyPay = exp.payer === S.userName;
    return `<div class="expense-item" onclick="showExpDetail(${exp.id})">
      <div class="ei-icon">${exp.cat || '💸'}</div>
      <div class="ei-info">
        <div class="ei-name">${exp.desc}</div>
        <div class="ei-by">Paid by ${exp.payer} · ${fmtDate(exp.date)}</div>
      </div>
      <div class="ei-right">
        <div class="ei-amount">${S.currency} ${exp.amount.toFixed(0)}</div>
        <div class="ei-share" style="color:${isMyPay?'var(--green)':'var(--sub)'}">
          ${isMyPay ? 'you paid' : 'your share: ' + S.currency + ' ' + myShare.toFixed(0)}
        </div>
      </div>
    </div>`;
  }).join('');
}

function showExpDetail(id) {
  const g   = getGroup();
  const exp = g?.expenses.find(e => e.id === id);
  if (!exp) return;

  const content = document.getElementById('expDetailContent');
  content.innerHTML = `
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:2.5rem;margin-bottom:8px">${exp.cat}</div>
      <div style="font-family:var(--font);font-size:22px;font-weight:900">${exp.desc}</div>
      <div style="font-family:var(--font);font-size:32px;font-weight:900;color:var(--lime);margin:8px 0">${S.currency} ${exp.amount.toFixed(0)}</div>
      <div style="font-size:12px;color:var(--sub)">Paid by ${exp.payer} · ${fmtDate(exp.date)}</div>
    </div>
    ${exp.receipt ? `<img src="${exp.receipt}" style="width:100%;border-radius:12px;margin-bottom:14px;max-height:180px;object-fit:cover">` : ''}
    <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Split Details</div>
    ${Object.entries(exp.splits).map(([mem, share]) => {
      const isPayer = mem === exp.payer;
      return `<div class="split-detail-row">
        <div class="sdr-av" style="background:${getMemberColor(g,mem)}22;color:${getMemberColor(g,mem)}">${mem}</div>
        <div class="sdr-name">${mem}${isPayer?' (paid)':''}</div>
        <div class="sdr-amount">${S.currency} ${share.toFixed(0)}</div>
        <span class="sdr-status ${isPayer?'paid':'owes'}">${isPayer?'Paid':'Owes'}</span>
      </div>`;
    }).join('')}
    <button class="btn-danger" style="margin-top:16px" onclick="deleteExpense(${id})">Delete Expense</button>
  `;
  showModal('expDetail');
}

function deleteExpense(id) {
  const g = getGroup();
  g.expenses = g.expenses.filter(e => e.id !== id);
  save();
  closeModal('expDetail');
  renderExpenses(g);
  renderBalances(g);
  renderSettlements(g);
  document.getElementById('gd-meta').textContent = `${g.members.length} members · ${g.expenses.length} expenses`;
  toast('Expense deleted');
}

function getMemberColor(g, name) {
  return g.members.find(m => m.name === name)?.color || '#888';
}

function renderHome() {
  const list = document.getElementById('groupsList');
  if (!S.groups.length) {
    list.innerHTML = `<div class="empty-state"><span class="es-icon">🤝</span><div class="es-title">No groups yet</div><div class="es-sub">Create a group to start splitting bills with friends</div></div>`;
    updateSummary(); updateQuickStats(); return;
  }
  list.innerHTML = S.groups.map(g => {
    const bal  = calcBalances(g);
    const my   = bal[S.userName] || 0;
    const tot  = g.expenses.reduce((s,e) => s+e.amount, 0);
    const cls  = my > 0.5 ? 'owed' : my < -0.5 ? 'owe' : 'zero';
    const lbl  = my > 0.5 ? 'owed to you' : my < -0.5 ? 'you owe' : 'settled';
    return `<div class="group-card" onclick="openGroup(${g.id})">
      <div class="gc-emoji">${g.emoji}</div>
      <div class="gc-info">
        <div class="gc-name">${g.name}</div>
        <div class="gc-meta">${g.members.length} members · ${S.currency} ${tot.toFixed(0)} total</div>
      </div>
      <div class="gc-right">
        <div class="gc-amount ${cls}">${S.currency} ${Math.abs(my).toFixed(0)}</div>
        <div class="gc-label">${lbl}</div>
      </div>
    </div>`;
  }).join('');
  updateSummary();
  updateQuickStats();
}

function filterGroups(q) {
  document.querySelectorAll('.group-card').forEach(c => {
    const name = c.querySelector('.gc-name')?.textContent.toLowerCase() || '';
    c.style.display = name.includes(q.toLowerCase()) ? 'flex' : 'none';
  });
}

function updateSummary() {
  let owe = 0, owed = 0;
  S.groups.forEach(g => {
    const b = (calcBalances(g)[S.userName] || 0);
    if (b < -0.5) owe  += Math.abs(b);
    if (b >  0.5) owed += b;
  });
  document.getElementById('s-owe').textContent  = `${S.currency} ${owe.toFixed(0)}`;
  document.getElementById('s-owed').textContent = `${S.currency} ${owed.toFixed(0)}`;
}

function updateQuickStats() {
  const totalExp = S.groups.reduce((s,g) => s + g.expenses.length, 0);
  const settled  = S.groups.filter(g => {
    const b = calcBalances(g);
    return Object.values(b).every(v => Math.abs(v) < 0.5);
  }).length;
  document.getElementById('qs-groups').textContent  = S.groups.length;
  document.getElementById('qs-exp').textContent     = totalExp;
  document.getElementById('qs-settled').textContent = settled;
}

function renderActivity() {
  const list = document.getElementById('activityList');
  if (!S.activity.length) {
    list.innerHTML = `<div class="empty-state"><span class="es-icon">📋</span><div class="es-title">No activity yet</div><div class="es-sub">Add expenses to see history here</div></div>`;
    return;
  }
  list.innerHTML = S.activity.slice(0,60).map(a =>
    `<div class="activity-item">
      <div class="ai-icon">${a.icon || '💸'}</div>
      <div class="ai-body">
        <div class="ai-text">${a.text}</div>
        <div class="ai-meta">${a.time}</div>
      </div>
      <div class="ai-amount">${a.amount || ''}</div>
    </div>`
  ).join('');
}

function renderFriends() {
  const all = {};
  S.groups.forEach(g => {
    const bal = calcBalances(g);
    g.members.forEach(m => {
      if (m.name === S.userName) return;
      if (!all[m.name]) all[m.name] = { name: m.name, color: m.color, total: 0, groups: 0 };
      all[m.name].total  += (bal[m.name] || 0);
      all[m.name].groups += 1;
    });
  });

  const list = document.getElementById('friendsList');
  const arr  = Object.values(all);
  if (!arr.length) {
    list.innerHTML = `<div class="empty-state"><span class="es-icon">👥</span><div class="es-title">No friends yet</div><div class="es-sub">Add members to your groups to see them here</div></div>`;
    return;
  }
  list.innerHTML = arr.map(f => {
    const b   = f.total;
    const cls = b > 0.5 ? 'owed' : b < -0.5 ? 'owe' : 'zero';
    const lbl = b > 0.5 ? 'owes you' : b < -0.5 ? 'you owe' : 'settled';
    return `<div class="group-card">
      <div class="gc-emoji" style="background:${f.color}22;font-size:1.4rem;color:${f.color}">
        ${f.name.toUpperCase()}
      </div>
      <div class="gc-info">
        <div class="gc-name">${f.name}</div>
        <div class="gc-meta">${f.groups} shared group${f.groups>1?'s':''}</div>
      </div>
      <div class="gc-right">
        <div class="gc-amount ${cls}">${S.currency} ${Math.abs(b).toFixed(0)}</div>
        <div class="gc-label">${lbl}</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
//  SYSTEM NOTIFICATIONS CHANNELS
// ═══════════════════════════════════════════════════
function addNotif(text) {
  S.notifs.unshift({ text, time: timeNow(), read: false });
  if (S.notifs.length > 20) S.notifs.pop();
  const unread = S.notifs.filter(n => !n.read).length;
  document.getElementById('notifBtn').classList.toggle('has-notif', unread > 0);
  document.getElementById('nb-activity').textContent = S.activity.length;
  save();
}
function renderNotifs() {
  const list = document.getElementById('notifList');
  if (!S.notifs.length) {
    list.innerHTML = `<div class="empty-state"><span class="es-icon">🔔</span><div class="es-title">No notifications</div></div>`;
    return;
  }
  list.innerHTML = S.notifs.map(n =>
    `<div class="activity-item">
      <div class="ai-icon">🔔</div>
      <div class="ai-body"><div class="ai-text">${n.text}</div><div class="ai-meta">${n.time}</div></div>
    </div>`
  ).join('');
  S.notifs.forEach(n => n.read = true);
  document.getElementById('notifBtn').classList.remove('has-notif');
}
function clearNotifs() {
  S.notifs = []; save();
  document.getElementById('notifBtn').classList.remove('has-notif');
}

// ═══════════════════════════════════════════════════
//  GROUP SETTINGS UTILITIES
// ═══════════════════════════════════════════════════
function showGroupSettings() {
  const g = getGroup();
  if (!g) return;
  document.getElementById('gs-name').value   = g.name;
  document.getElementById('gs-member').value = '';
  showModal('groupSettings');
}

function saveGroupSettings() {
  const g = getGroup();
  if (!g) return;
  const newName = document.getElementById('gs-name').value.trim();
  const newMem  = document.getElementById('gs-member').value.trim();
  if (newName) g.name = newName;
  if (newMem && !g.members.find(m => m.name === newMem)) {
    g.members.push({ id: Date.now(), name: newMem, color: COLORS[g.members.length % COLORS.length] });
    toast('✓ ' + newMem + ' added');
  }
  save();
  closeModal('groupSettings');
  document.getElementById('gd-name').textContent = g.name;
  document.getElementById('gd-meta').textContent = `${g.members.length} members · ${g.expenses.length} expenses`;
  renderBalances(g);
}

function deleteGroup() {
  if (!confirm('Delete this group and all its expenses?')) return;
  S.groups = S.groups.filter(g => g.id !== curGroupId);
  save();
  closeModal('groupSettings');
  navTo('home');
  toast('Group deleted');
}

// ═══════════════════════════════════════════════════
//  EXTERNAL SHARE LAYER (WHATSAPP)
// ═══════════════════════════════════════════════════
function shareGroup() {
  const g    = getGroup();
  if (!g) return;
  const bal  = calcBalances(g);
  const txns = minCashFlow(bal);
  const tot  = g.expenses.reduce((s,e) => s+e.amount, 0);

  let msg = `💰 *BillSplit Pro — ${g.name}*\n\n`;
  msg += `Total: ${S.currency} ${tot.toFixed(0)}\n`;
  msg += `Members: ${g.members.map(m=>m.name).join(', ')}\n\n`;
  if (txns.length) {
    msg += `*Settlements:*\n`;
    txns.forEach(t => msg += `• ${t.from} → ${t.to}: ${S.currency} ${t.amount.toFixed(0)}\n`);
  } else {
    msg += `✅ Everyone is settled up!\n`;
  }
  msg += `\n_Tracked with BillSplit Pro — Free App_`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ═══════════════════════════════════════════════════
//  USER ENVIRONMENT PREFERENCES
// ═══════════════════════════════════════════════════
function renderSettings() {
  document.getElementById('userName').value  = S.userName;
  document.getElementById('profileAvatar').textContent = S.userName?.toUpperCase() || 'Y';
  document.querySelectorAll('.curr-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.c === S.currency);
  });
}

function saveName(val) {
  S.userName = val || 'You';
  document.getElementById('profileAvatar').textContent = S.userName?.toUpperCase() || 'Y';
  save();
}

function setCurrency(btn) {
  document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.currency = btn.dataset.c;
  save();
  toast('Currency: ' + S.currency);
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `billsplit_backup_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Backup exported');
}

function importData() { document.getElementById('importInput').click(); }

function handleImport(input) {
  const file = input.files;
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.groups) { S = { ...S, ...d }; save(); navTo('home'); toast('✓ Data imported'); }
      else toast('Invalid backup file', true);
    } catch(err) { toast('Import failed', true); }
  };
  r.readAsText(file);
  input.value = '';
}

function clearData() {
  if (!confirm('Delete ALL data? Cannot be undone!')) return;
  S.groups = []; S.activity = []; S.notifs = [];
  save(); navTo('home'); toast('All data cleared');
}

// ═══════════════════════════════════════════════════
//  HELPER PIPELINES
// ═══════════════════════════════════════════════════
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en', { month:'short', day:'numeric' });
}
function timeNow() {
  return new Date().toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

let toastT;
function toast(msg, err=false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err?' err':'');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2600);
}

// ═══════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════
renderHome();

const actBadge = document.getElementById('nb-activity');
if (S.activity.length) { actBadge.textContent = S.activity.length; actBadge.classList.add('show'); }
