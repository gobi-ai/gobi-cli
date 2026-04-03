---
name: gobi-homepage
description: >-
  Developer reference for building Gobi Applets — custom HTML pages hosted on
  webdrive and served as a vault's public homepage at gobispace.com/@{vaultSlug}.
  Use when a developer wants to build or modify a vault homepage applet.
---

# Gobi Applet Developer Guide

A **Gobi Applet** is a custom HTML page hosted on a vault's webdrive and served as its public homepage at `https://gobispace.com/@{vaultSlug}`. Gobi injects a `window.gobi` bridge before any scripts run, giving the applet access to vault data, files, brain updates, and chat.

> **Sandbox:** The applet runs in a sandboxed iframe with `origin: null`. Direct `fetch()` / `XMLHttpRequest` calls are blocked by CORS. All data access must go through `window.gobi.*`.

---

## Setup

1. Create an HTML file in the vault (e.g. `app/home.html`) and upload:
   ```bash
   gobi sync
   ```
2. Set `homepagePath` in vault settings:
   - `app/home.html` — Gobi sidebars visible alongside the applet
   - `app/home.html?nav=false` — full-screen, no Gobi chrome

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

### Brain Updates

```js
const { data: updates, pagination } = await gobi.listBrainUpdates({ limit: 10, cursor: null });
// updates[i] → {
//   id: 42,
//   title: 'New insights',
//   content: '## ...',   // markdown — MAY contain ![[file|width]] wiki image embeds
//   topics: [{ id: 3, name: 'AI', slug: 'ai' }],
//   createdAt: '2025-03-01T12:00:00Z'
// }
// pagination → { hasMore: true, nextCursor: 'abc...' }

// ⚠️ Always call resolveWikiImages() on content before rendering — see Rendering Markdown below.
for (const u of updates) {
  el.innerHTML += marked.parse(resolveWikiImages(u.content));
}

// Pagination — load the next page using the cursor
if (pagination.hasMore) {
  const { data: moreUpdates, pagination: nextPage } =
    await gobi.listBrainUpdates({ limit: 10, cursor: pagination.nextCursor });
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
//   { brainUpdateId?: number, brainUpdateTitle?: string, filePath?: string }

let reply = '';
await gobi.sendMessage(sessionId, 'Hello', (delta) => {
  reply += delta;
  renderReply(reply);
});

// With context
await gobi.sendMessage(sessionId, 'Tell me more', {
  context: { brainUpdateId: 42, brainUpdateTitle: 'New insights' }
}, (delta) => { reply += delta; renderReply(reply); });

await gobi.sendMessage(sessionId, 'Explain this', {
  context: { filePath: 'notes/research.md' }
}, (delta) => { reply += delta; renderReply(reply); });

// Start a fresh session
sessionId = crypto.randomUUID();
```

---

## Rendering Markdown

Brain update `content` and any markdown read via `readFile` may contain Obsidian-style wiki embeds (`![[path|width]]`). Resolve them before passing to a renderer.

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

const html = marked.parse(resolveWikiImages(update.content));
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
    .update { margin-bottom: 32px; }
    .update h2 { margin-bottom: 8px; }
    .update img { border-radius: 8px; }
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
  <div id="updates"></div>
  <div id="chat">
    <div id="messages"></div>
    <div id="chat-input">
      <input id="input" type="text" placeholder="Ask a question…" />
      <button onclick="onSend()">Send</button>
    </div>
  </div>

  <script>
    document.title = gobi.vault.title || 'Brain';

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

    // ── Brain updates ────────────────────────────────

    async function loadUpdates() {
      try {
        const { data: updates } = await gobi.listBrainUpdates({ limit: 5 });
        const el = document.getElementById('updates');
        for (const u of updates) {
          const div = document.createElement('div');
          div.className = 'update';
          div.innerHTML = `<h2>${escapeHtml(u.title)}</h2>${marked.parse(resolveWikiImages(u.content))}`;
          el.appendChild(div);
        }
      } catch (err) {
        console.error('Failed to load brain updates:', err);
      }
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

    loadUpdates();
    initChat();
  </script>
</body>
</html>
```
