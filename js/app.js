// BillSplit Pro - v2.1
let S = {
  groups: [],
  activity: [],
  notifs: [],
  currency: 'Rs',
  userName: 'You',
  receipts: {}
};

let curGroupId = null;
let selEmoji = '🍕';
let selExpCat = '🍽️';
let splitMode = 'equal';
let selPayer = null;
let selSplitMems = [];
let receiptData = null;
let deferredPrompt = null;

const COLORS = ['#c8f135','#4f8aff','#ff5f5f','#3dd68c','#ffb444','#a78bfa','#f472b6','#38bdf8','#fb923c','#a3e635'];
const G_EMOJIS = ['🍕','🏖️','🏠','✈️','🎉','🍺','🛒','🎮','🏕️','🚗','💼','🎵','🍜','🏋️','🎲','🍰','🐾','🌴','🎓','💊','🛵','🧹','🎭','🏄'];
const EXP_CATS = ['🍽️','🚗','🏨','🎬','🛒','💊','⚡','📦','🎮','✈️','☕','🍺','🎁','🏥','📚','🔧'];

// Persistence
function save() { localStorage.setItem('bsp_v2', JSON.stringify(S)); }
function load() {
  const d = localStorage.getItem('bsp_v2');
  if (d) S = { ...S, ...JSON.parse(d) };
}
load();

// All your functions (createGroup, openGroup, calcBalances, renderHome, etc.)
// Paste ALL the JavaScript code from your original <script> tag here

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  updateNavBadge();
});

// PWA Install
window.addEventListener('beforeinstallprompt', e => {
  deferredPrompt = e;
  if (!localStorage.getItem('bsp_install_dismissed')) {
    document.getElementById('installBanner').classList.add('show');
  }
});

function installApp() { /* same as before */ }
function dismissInstall() { /* same */ }