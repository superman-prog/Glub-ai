// ── State ──────────────────────────────────────────────
let keys = { gemini: '', claude: '', tavily: '' };
let chatHistory = [];
let isLoading = false;

const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// ── Bubbles ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('oceanBg');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = Math.random() * 30 + 8;
    b.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 12 + 8}s;
      animation-delay:${Math.random() * 10}s;
    `;
    bg.appendChild(b);
  }

  if (!keys.gemini) setTimeout(openSettings, 800);
});

// ── Input helpers ──────────────────────────────────────
inputEl.addEventListener('input', () => {
  sendBtn.disabled = !inputEl.value.trim() || isLoading;
});

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function scrollBottom() {
  document.getElementById('bottom').scrollIntoView({ behavior: 'smooth' });
}

function setStatus(msg) {
  const bar = document.getElementById('statusBar');
  if (msg) { bar.style.display = 'block'; bar.textContent = msg; }
  else { bar.style.display = 'none'; }
}

// ── Settings ───────────────────────────────────────────
function openSettings() {
  document.getElementById('geminiKey').value = keys.gemini;
  document.getElementById('claudeKey').value = keys.claude;
  document.getElementById('tavilyKey').value = keys.tavily;
  document.getElementById('connectedBadge').style.display = keys.gemini ? 'inline-flex' : 'none';
  document.getElementById('modalError').textContent = '';
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveKeys() {
  const g = document.getElementById('geminiKey').value.trim();
  const c = document.getElementById('claudeKey').value
