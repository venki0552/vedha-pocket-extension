# Memory Palace Chrome Extension

A Chrome extension for Memory Palace that lets you chat with your memories and save web pages directly from your browser.

## 🌟 Features

- 🔐 **Secure Login** — Uses your existing Memory Palace account
- 💬 **Chat with Memories** — Ask questions about your saved knowledge
- 📄 **One-Click Save** — Save any web page as a memory
- 🗣️ **Natural Commands** — Say "save this page" in chat to save
- 🌙 **Dark Mode** — Beautiful dark theme that matches Memory Palace
- ⚡ **Streaming Responses** — Real-time AI responses

## 📦 Installation

### Load Extension (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `vedha-pocket-extension` folder
5. The Memory Palace icon (purple "M") will appear in your toolbar!

### From Chrome Web Store

_Coming soon!_

## 🚀 Usage

### Login

1. Click the Memory Palace icon in your toolbar
2. Enter your email and password
3. You're logged in!

### Chat with Memories

Just type your question in the chat input:

- "What did I save about machine learning?"
- "Find my notes on productivity"
- "What are my thoughts on React?"

### Save a Page

**Option 1: Click the button**

- Click "Save This Page" button at the top

**Option 2: Say it in chat**

- Type "save this page" or "remember this article"

**Option 3: Right-click context menu**

- Right-click anywhere on the page
- Select "Save to Memory Palace"

### What Gets Saved

When you save a page, the extension extracts:

- Page title
- URL
- Meta description
- Main content (article text, cleaned up)

The content is saved as a Memory in your Memory Palace account with the tag `saved-from-extension`.

## 🔧 Configuration

Edit `config.js` to change the API endpoints:

```javascript
export const CONFIG = {
	SUPABASE_URL: "https://your-project.supabase.co",
	SUPABASE_ANON_KEY: "your-anon-key",
	API_URL: "https://your-api.railway.app",
	APP_URL: "https://your-app.vercel.app",
};
```

## 🏗️ Project Structure

```
vedha-pocket-extension/
├── manifest.json      # Chrome extension manifest (v3)
├── popup.html         # Main popup UI
├── popup.css          # Styles
├── popup.js           # Popup logic
├── background.js      # Service worker
├── content.js         # Page content extraction
├── config.js          # Configuration
├── supabase.js        # Supabase auth client
├── api.js             # API client
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 🔒 Permissions

The extension requests these permissions:

| Permission         | Why                                          |
| ------------------ | -------------------------------------------- |
| `activeTab`        | To read the current page content when saving |
| `storage`          | To store your login session locally          |
| `scripting`        | To extract page content for saving           |
| `host_permissions` | To communicate with Supabase and the API     |

## 🐛 Troubleshooting

### "Not authenticated" error

- Try logging out and back in
- Check if your session has expired

### Page content not saving correctly

- Some sites block content extraction
- Try selecting specific text and use context menu

### Extension not appearing

- Make sure Developer mode is enabled
- Try reloading the extension

## 🔗 Related

- **Web App**: [Memory Palace Web](https://github.com/venki0552/vedha-pocket-web)
- **API**: [Memory Palace API](https://github.com/venki0552/vedha-pocket-api)
- **Worker**: [Memory Palace Worker](https://github.com/venki0552/vedha-pocket-worker)

## 📄 License

MIT
