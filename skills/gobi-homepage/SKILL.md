---
name: gobi-homepage
description: >-
  Developer reference for building Gobi Homepages — custom HTML pages hosted on
  webdrive and served as a vault's public homepage at gobispace.com/@{vaultSlug}.
  Use when a developer wants to build or modify a vault homepage.
---

# Gobi Homepage Developer Guide

A **Gobi Homepage** is a custom HTML page hosted on a vault's webdrive and served as its public homepage at `https://gobispace.com/@{vaultSlug}`. Gobi injects a `window.gobi` bridge before any scripts run, giving the homepage access to vault data, files, and chat.

> **Sandbox:** The homepage runs in a sandboxed iframe with `origin: null`. Direct `fetch()` / `XMLHttpRequest` calls are blocked by CORS. All data access must go through `window.gobi.*`.

---

## Setup

1. Create an HTML file in the vault (e.g. `app/home.html`) and upload:
   ```bash
   gobi sync
   ```
2. Set `homepage` in PUBLISH.md (homepage property):
   - `homepage: "[[app/home.html]]"` — Gobi sidebars visible alongside the homepage
   - `homepage: "[[app/home.html?nav=false]]"` — full-screen, no Gobi chrome

---

## window.gobi Reference

`gobi.vault` is **synchronous** — available at the top of any `<script>`, no `DOMContentLoaded` needed. All other methods return `Promise`.

### gobi.vault

```js
const { vaultId, title, description, thumbnailPath, tags,
        ownerName, ownerProfilePictureUrl, webdriveUrl } = gobi.vault;

// Profile picture: https://d16t3dioqz0xo9.cloudfront.net/{thumbnailPath}@{W}x{H}.webp
```

### Error Handling

All async `gobi.*` methods throw on failure. Wrap calls in `try/catch` to handle errors gracefully.

```js
try {
  const text = await gobi.readFile('data/config.json');
} catch (err) {
  console.error('gobi API error:', err.message);
  // err.message contains a human-readable description of what went wrong
}
```

### Files

```js
const text  = await gobi.readFile('data/config.json');   // → string (throws if not found)
const items = await gobi.listFiles('images');             // → [{ name, type: 'file'|'folder' }]
const exists = await gobi.fileExists('README.md');        // → boolean

// Direct URL for any vault file (public, no auth required).
// Encode each segment separately — encodeURIComponent(path) would encode slashes and break the URL.
function getFileUrl(path) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  return `${gobi.vault.webdriveUrl}/api/v1/file/raw/${gobi.vault.vaultId}/${enc}`;
}
```

### Chat (login required)

`getSessions`, `loadMessages`, and `sendMessage` require the visitor to be logged in. `getSessions` returns an empty array when not logged in — **but also when logged in with no prior sessions**. Don't use it as a definitive auth check.

```js
// Redirect to login, returning here after. Use window.top — the applet is inside an iframe.
function redirectToLogin() {
  window.top.location.href =
    `https://gobispace.com/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
}

// Session list — newest first
const { data: sessions, pagination } = await gobi.getSessions({ limit: 20, cursor: null });
// sessions[i] → { sessionId: 'sess_abc', messageCount: 12, lastMessageAt: '2025-03-30T...' }

// Message history
const { messages, hasMore, nextCursor } = await gobi.loadMessages('sess_abc', { limit: 20, cursor: null });
// messages[i] → { id, role: 'human'|'assistant', content, createdAt }

// Send a message and stream the response.
// New session: pass crypto.randomUUID() — the backend creates it lazily on first message sent.
//
// Signatures:
//   sendMessage(sessionId, text, onDelta)           → Promise<{ content }>
//   sendMessage(sessionId, text, options, onDelta)  → Promise<{ content }>
//
// options.context tells the AI what the user is looking at:
//   { filePath?: string }

let reply = '';
await gobi.sendMessage(sessionId, 'Hello', (delta) => {
  reply += delta;
  renderReply(reply);
});

// With context
await gobi.sendMessage(sessionId, 'Explain this', {
  context: { filePath: 'notes/research.md' }
}, (delta) => { reply += delta; renderReply(reply); });

// Start a fresh session
sessionId = crypto.randomUUID();
```

---

## Rendering Markdown

Markdown read via `readFile` may contain Obsidian-style wiki embeds (`![[path|width]]`). Resolve them before passing to a renderer.

The examples below use [marked](https://cdn.jsdelivr.net/npm/marked/marked.min.js) — include it in your `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

```js
// Define once, reuses getFileUrl from the Files section.
function resolveWikiImages(md) {
  return md.replace(/!\[\[([^\]|]+)(?:\|(\d+))?\]\]/g, (_, p, w) => {
    const url = getFileUrl(p.trim());
    return w ? `<img src="${url}" width="${w}" style="max-width:100%">`
             : `<img src="${url}" style="max-width:100%">`;
  });
}

const html = marked.parse(resolveWikiImages(text));
```

**Open links in a new tab.** The homepage runs in a sandboxed iframe — clicking a rendered link replaces the iframe with the external page. Override the renderer so every `<a>` opens in a new tab:

```js
const renderer = new marked.Renderer();
const origLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) =>
  origLink(href, title, text).replace('<a ', '<a target="_blank" rel="noopener" ');
marked.setOptions({ renderer });
```

**Plain-text previews.** For preview cards, render a truncated preview with `escapeHtml(content.substring(0, 200))` — don't run markdown on a random substring, it produces broken HTML. Use `marked.parse(resolveWikiImages(content))` only for the full expanded view. Same for chat: `marked.parse(content)` for assistant messages, `escapeHtml(content)` for human messages.

---

## Polished Homepage Patterns

Optional patterns that go beyond the minimal example. Pick the ones you need.

### Design tokens

Centralize colors and spacing in CSS custom properties so restyling is a one-line change:

```css
:root {
  --bg: #000;
  --fg: #fff;
  --accent: #ccff00;
  --grey-900: #111;   /* card bg */
  --grey-700: #2a2a2a; /* borders */
  --grey-500: #606060; /* secondary text */
  --border: 2px;
  --transition: 0.15s ease;
}
```

Pair with Google Fonts (e.g. Space Grotesk for headings, IBM Plex Mono for meta, Inter for body) via CDN `<link>`.

### Full-screen overlay

Useful for expanding any small component into a focused view:

```js
function openOverlay(renderInto) {
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:1000';
  o.innerHTML = '<button id="x" style="position:absolute;top:16px;right:16px">CLOSE</button><div id="body" style="width:100%;height:100%"></div>';
  document.body.appendChild(o);
  document.body.style.overflow = 'hidden';
  const close = () => { o.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  o.querySelector('#x').onclick = close;
  document.addEventListener('keydown', onKey);
  renderInto(o.querySelector('#body'));
}
```

Always restore `body.overflow` on close, and always remove the `keydown` listener.

### Chat suggestion chips

Empty chat looks dead. Show clickable prompt chips until the first message is sent:

```js
const prompts = ['What is this vault about?', 'Summarize the latest notes', 'What topics come up most?'];
chips.innerHTML = prompts.map(p => `<button class="chip">${escapeHtml(p)}</button>`).join('');
chips.querySelectorAll('.chip').forEach((btn, i) => {
  btn.onclick = () => { input.value = prompts[i]; chips.remove(); input.focus(); };
});
```

### Footer — POWERED BY GOBI

Link back to the vault's public page with `?og=1` so the link preview uses the vault's Open Graph metadata:

```html
<footer>
  <a href="https://www.gobispace.com/@${gobi.vault.slug}?og=1" target="_blank" rel="noopener">
    POWERED BY GOBI
  </a>
</footer>
```

### Mobile responsive

Single breakpoint at `768px` is enough for most homepages:

```css
@media (max-width: 768px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-content { flex-direction: column; }
  .btn { width: 100%; }
}
```

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; }
    .hero { margin-bottom: 32px; }
    .hero h1 { margin-bottom: 8px; }
    .hero p { color: #555; }
    #chat { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 24px; }
    .message { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; }
    .message[data-role="human"] { background: #e8f0fe; }
    .message[data-role="assistant"] { background: #f1f3f4; }
    #chat-input { display: flex; gap: 8px; margin-top: 16px; }
    #chat-input input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
    #chat-input button { padding: 8px 16px; border: none; border-radius: 6px; background: #1a73e8; color: #fff; cursor: pointer; }
    .login-prompt { text-align: center; color: #666; }
    .login-prompt a { color: #1a73e8; cursor: pointer; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="hero">
    <h1 id="title"></h1>
    <p id="description"></p>
  </div>
  <div id="chat">
    <div id="messages"></div>
    <div id="chat-input">
      <input id="input" type="text" placeholder="Ask a question…" />
      <button onclick="onSend()">Send</button>
    </div>
  </div>

  <script>
    document.title = gobi.vault.title || 'Vault';
    document.getElementById('title').textContent = gobi.vault.title || '';
    document.getElementById('description').textContent = gobi.vault.description || '';

    // ── Helpers ──────────────────────────────────────

    function getFileUrl(path) {
      const enc = path.split('/').map(encodeURIComponent).join('/');
      return `${gobi.vault.webdriveUrl}/api/v1/file/raw/${gobi.vault.vaultId}/${enc}`;
    }

    function resolveWikiImages(md) {
      return md.replace(/!\[\[([^\]|]+)(?:\|(\d+))?\]\]/g, (_, p, w) => {
        const url = getFileUrl(p.trim());
        return w ? `<img src="${url}" width="${w}" style="max-width:100%">`
                 : `<img src="${url}" style="max-width:100%">`;
      });
    }

    function escapeHtml(s) {
      const el = document.createElement('div');
      el.textContent = s;
      return el.innerHTML;
    }

    function redirectToLogin() {
      window.top.location.href =
        `https://gobispace.com/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }

    // ── Chat ─────────────────────────────────────────

    let sessionId = null;
    const messagesEl = document.getElementById('messages');

    function renderMessage(role, html) {
      const div = document.createElement('div');
      div.className = 'message';
      div.dataset.role = role;
      div.innerHTML = html;
      messagesEl.appendChild(div);
      return div;
    }

    async function initChat() {
      try {
        const { data: sessions } = await gobi.getSessions({ limit: 1 });
        if (!sessions.length) {
          messagesEl.innerHTML =
            '<p class="login-prompt">No chat sessions yet. <a onclick="redirectToLogin()">Log in</a> to start chatting.</p>';
          return;
        }
        sessionId = sessions[0].sessionId;
        const { messages } = await gobi.loadMessages(sessionId, { limit: 20 });
        for (const m of messages) {
          renderMessage(m.role, m.role === 'assistant' ? marked.parse(m.content) : escapeHtml(m.content));
        }
      } catch (err) {
        console.error('Failed to init chat:', err);
      }
    }

    async function onSend() {
      const input = document.getElementById('input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      if (!sessionId) sessionId = crypto.randomUUID();
      renderMessage('human', escapeHtml(text));

      const replyEl = renderMessage('assistant', '…');
      let reply = '';
      try {
        await gobi.sendMessage(sessionId, text, (delta) => {
          reply += delta;
          replyEl.innerHTML = marked.parse(reply);
        });
      } catch (err) {
        replyEl.textContent = 'Error: ' + err.message;
      }
    }

    // Submit on Enter
    document.getElementById('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onSend();
    });

    // ─────────────────────────────────────────────────

    initChat();
  </script>
</body>
</html>
```
