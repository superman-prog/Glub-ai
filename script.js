// ── State ──────────────────────────────────────────────
let keys = { gemini: '', claude: '', tavily: '' };
let chatHistory = [];
let isLoading = false;

const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// ── Bubbles + Init ─────────────────────────────────────
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
  const c = document.getElementById('claudeKey').value.trim();
  const t = document.getElementById('tavilyKey').value.trim();
  if (!g) { document.getElementById('modalError').textContent = 'Gemini key is required!'; return; }
  keys = { gemini: g, claude: c, tavily: t };
  closeSettings();
  sendBtn.disabled = !inputEl.value.trim();
}

// ── DuckDuckGo Search ──────────────────────────────────
async function searchWeb(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    let results = '';
    if (data.AbstractText) results += data.AbstractText + '\n';
    if (data.Answer) results += data.Answer + '\n';
    if (data.RelatedTopics?.length) {
      results += data.RelatedTopics.slice(0, 3).map(t => t.Text || '').filter(Boolean).join('\n');
    }
    return results || null;
  } catch { return null; }
}

// ── Wikipedia Search ───────────────────────────────────
async function searchWikipedia(query) {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.extract || null;
  } catch { return null; }
}

// ── Tavily Search (backup) ─────────────────────────────
async function searchTavily(query) {
  if (!keys.tavily) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: keys.tavily, query, max_results: 3 })
    });
    const data = await res.json();
    return data.results?.map(r => r.content).join('\n') || null;
  } catch { return null; }
}

// ── Ask Claude (complex questions) ────────────────────
async function askClaude(question, context) {
  if (!keys.claude) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': keys.claude,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: `You are Glub's deep thinking engine. You're given web search results and must answer the user's question accurately and concisely. Be helpful, clear, and friendly.`,
        messages: [{ role: 'user', content: `Web context:\n${context}\n\nQuestion: ${question}` }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch { return null; }
}

// ── Ask Gemini (main brain) ────────────────────────────
async function askGemini(question, context) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are Glub, a friendly AI assistant. Use the web context below to answer the question. Be concise and helpful.\n\nWeb context:\n${context || 'No web results found.'}\n\nConversation history:\n${chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nQuestion: ${question}`
            }]
          }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
        })
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

// ── Complexity check ───────────────────────────────────
function isComplex(question) {
  const complexWords = ['explain', 'why', 'how does', 'compare', 'difference', 'analyze', 'what causes', 'philosophy', 'theory', 'prove', 'science', 'research'];
  return complexWords.some(w => question.toLowerCase().includes(w));
}

// ── Add message to UI ──────────────────────────────────
function addMessage(role, content, source) {
  document.getElementById('welcome')?.remove();

  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  if (role === 'ai') {
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = '🐟';
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble-content';
  bubble.innerHTML = content.replace(/\n/g, '<br>');

  if (source && role === 'ai') {
    const src = document.createElement('div');
    src.className = 'msg-source';
    src.textContent = `⚡ via ${source}`;
    bubble.appendChild(src);
  }

  row.appendChild(bubble);
  document.getElementById('bottom').insertAdjacentElement('beforebegin', row);
  scrollBottom();
}

function addTyping() {
  document.getElementById('welcome')?.remove();
  const row = document.createElement('div');
  row.className = 'typing-row';
  row.id = 'typingIndicator';
  row.innerHTML = `
    <div class="ai-avatar">🐟</div>
    <div class="typing-bubble">
      <div class="typing-dot" style="animation-delay:0s"></div>
      <div class="typing-dot" style="animation-delay:0.2s"></div>
      <div class="typing-dot" style="animation-delay:0.4s"></div>
    </div>`;
  document.getElementById('bottom').insertAdjacentElement('beforebegin', row);
  scrollBottom();
}

function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

// ── Suggestion shortcut ────────────────────────────────
function ask(text) {
  inputEl.value = text;
  autoResize(inputEl);
  sendBtn.disabled = false;
  sendMessage();
}

// ── Main send function ─────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;
  if (!keys.gemini) { openSettings(); return; }

  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;
  isLoading = true;

  addMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  addTyping();

  let context = '';
  let source = 'Gemini';

  try {
    setStatus('🔍 Searching DuckDuckGo...');
    const ddg = await searchWeb(text);
    if (ddg) context += ddg + '\n';

    if (!context || context.length < 100) {
      setStatus('📖 Checking Wikipedia...');
      const wiki = await searchWikipedia(text);
      if (wiki) context += wiki;
    }

    if ((!context || context.length < 100) && keys.tavily) {
      setStatus('🌐 Deep searching with Tavily...');
      const tav = await searchTavily(text);
      if (tav) context += tav;
    }

    let answer = null;

    if (isComplex(text) && keys.claude) {
      setStatus('🧠 Asking Claude for deep thinking...');
      answer = await askClaude(text, context);
      if (answer) source = 'Claude';
    }

    if (!answer) {
      setStatus('⚡ Gemini is thinking...');
      answer = await askGemini(text, context);
      source = 'Gemini';
    }

    if (!answer) answer = "Sorry, I couldn't find a good answer right now. Try again! 🐠";

    removeTyping();
    setStatus('');
    addMessage('ai', answer, source);
    chatHistory.push({ role: 'assistant', content: answer });

  } catch (e) {
    removeTyping();
    setStatus('');
    addMessage('ai', '⚠️ Something went wrong. Check your API keys in settings!', 'error');
  }

  isLoading = false;
  sendBtn.disabled = !inputEl.value.trim();
    }
