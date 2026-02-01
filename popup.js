// Popup script for Memory Palace Chrome Extension
import { supabase } from "./supabase.js";
import { api } from "./api.js";

/**
 * Sanitize HTML to prevent XSS attacks.
 * This escapes HTML entities to prevent script injection.
 */
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Format markdown to safe HTML (XSS protected).
 * Only allows safe formatting without executing scripts.
 */
function formatMarkdownSafe(text) {
	// First escape all HTML entities to prevent XSS
	let safeText = escapeHtml(text);

	return (
		safeText
			// Bold (already escaped, so we need to handle **text**)
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			// Italic
			.replace(/\*(.+?)\*/g, "<em>$1</em>")
			// Code (backticks are safe after escaping)
			.replace(/`(.+?)`/g, "<code>$1</code>")
			// Links - only allow http/https protocols
			.replace(
				/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
			)
			// Line breaks
			.replace(/\n/g, "<br>")
	);
}

// DOM Elements
const loginView = document.getElementById("login-view");
const chatView = document.getElementById("chat-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const savePageBtn = document.getElementById("save-page-btn");
const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");

// State
let currentConversationId = null;
let isStreaming = false;

// Initialize
async function init() {
	try {
		const session = await supabase.init();
		if (session) {
			showChatView(session.user);
		} else {
			showLoginView();
		}
	} catch (error) {
		console.error("Init error:", error);
		showLoginView();
	}
}

// Show/hide views
function showLoginView() {
	loginView.classList.remove("hidden");
	chatView.classList.add("hidden");
	emailInput.focus();
}

function showChatView(user) {
	loginView.classList.add("hidden");
	chatView.classList.remove("hidden");
	userEmail.textContent = user.email;
	chatInput.focus();
}

// Login handler
loginForm.addEventListener("submit", async (e) => {
	e.preventDefault();

	const email = emailInput.value.trim();
	const password = passwordInput.value;

	if (!email || !password) return;

	// Show loading
	loginBtn.querySelector(".btn-text").classList.add("hidden");
	loginBtn.querySelector(".btn-loading").classList.remove("hidden");
	loginBtn.disabled = true;
	loginError.classList.add("hidden");

	try {
		const session = await supabase.signInWithPassword(email, password);
		showChatView(session.user);
	} catch (error) {
		loginError.textContent = error.message;
		loginError.classList.remove("hidden");
	} finally {
		loginBtn.querySelector(".btn-text").classList.remove("hidden");
		loginBtn.querySelector(".btn-loading").classList.add("hidden");
		loginBtn.disabled = false;
	}
});

// Logout handler
logoutBtn.addEventListener("click", async () => {
	await supabase.signOut();
	await api.clearCache();
	currentConversationId = null;
	messagesContainer.innerHTML = `
    <div class="message assistant">
      <div class="message-content">
        👋 Hi! I'm your Memory Palace assistant. Ask me anything about your memories, or say <strong>"save this page"</strong> to save the current webpage.
      </div>
    </div>
  `;
	showLoginView();
});

// Save page button handler
savePageBtn.addEventListener("click", async () => {
	await saveCurrentPage();
});

// Save current page as memory
async function saveCurrentPage() {
	savePageBtn.disabled = true;
	savePageBtn.classList.add("saving");
	savePageBtn.innerHTML = `
    <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
    </svg>
    Saving...
  `;

	try {
		// Get page content from content script
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: extractPageContent,
		});

		const pageContent = results[0].result;

		if (!pageContent || !pageContent.content) {
			throw new Error("Could not extract page content");
		}

		// Create memory via API
		const memory = await api.createMemory(
			pageContent.title || "Saved Page",
			formatMemoryContent(pageContent),
		);

		// Show success
		savePageBtn.classList.remove("saving");
		savePageBtn.classList.add("success");
		savePageBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Saved!
    `;

		// Add success message to chat
		addMessage(
			"assistant",
			`✅ Saved "${pageContent.title}" to your memories! You can now ask me questions about it.`,
		);

		// Reset button after delay
		setTimeout(() => {
			savePageBtn.classList.remove("success");
			savePageBtn.disabled = false;
			savePageBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17,21 17,13 7,13 7,21"/>
          <polyline points="7,3 7,8 15,8"/>
        </svg>
        Save This Page
      `;
		}, 2000);
	} catch (error) {
		console.error("Save error:", error);
		savePageBtn.classList.remove("saving");
		savePageBtn.disabled = false;
		savePageBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17,21 17,13 7,13 7,21"/>
        <polyline points="7,3 7,8 15,8"/>
      </svg>
      Save This Page
    `;
		addMessage("assistant", `❌ Failed to save page: ${error.message}`);
	}
}

// Extract page content (runs in content script context)
function extractPageContent() {
	// Get title (try multiple sources)
	const title =
		document.querySelector('meta[property="og:title"]')?.content ||
		document.querySelector('meta[name="twitter:title"]')?.content ||
		document.title ||
		document.querySelector("h1")?.textContent ||
		"Untitled";

	// Get meta description
	const metaDesc =
		document.querySelector('meta[property="og:description"]')?.content ||
		document.querySelector('meta[name="description"]')?.content ||
		"";

	// Get author (try multiple sources)
	const author =
		document.querySelector('meta[name="author"]')?.content ||
		document.querySelector('meta[property="article:author"]')?.content ||
		document.querySelector('[rel="author"]')?.textContent ||
		document.querySelector(".author-name")?.textContent ||
		document.querySelector(".byline")?.textContent ||
		"";

	// Get publish date
	const publishDate =
		document.querySelector('meta[property="article:published_time"]')
			?.content ||
		document.querySelector("time")?.getAttribute("datetime") ||
		"";

	// Get main content - extensive list of selectors for different sites
	const mainSelectors = [
		// Medium
		"article[data-testid='post']",
		".meteredContent",
		".postArticle-content",
		"section[data-testid='post-body']",

		// Substack
		".post-content",
		".body.markup",
		".available-content",

		// WordPress
		".entry-content",
		".post-content",
		".post-body",
		".article-content",
		".article-body",
		".blog-post-content",

		// News sites
		".story-body",
		".article__body",
		".article-text",
		".story-content",

		// Dev/Tech blogs
		".markdown-body",
		".prose",
		".content-body",

		// Generic article structure
		"article",
		"main",
		'[role="main"]',
		'[role="article"]',
		"#content",
		"#main-content",
		".content",
	];

	let mainElement = null;
	let maxContentLength = 0;

	// Find the best content element
	for (const selector of mainSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			const textLength = element.innerText?.length || 0;
			if (textLength > 200 && textLength > maxContentLength) {
				mainElement = element;
				maxContentLength = textLength;
			}
		}
	}

	// Fallback to body
	if (!mainElement) {
		mainElement = document.body;
	}

	// Clone and clean the element
	const clone = mainElement.cloneNode(true);

	// Remove unwanted elements
	const removeSelectors = [
		"script",
		"style",
		"noscript",
		"iframe",
		"nav",
		"header",
		"footer",
		"aside",
		".sidebar",
		".navigation",
		".menu",
		".nav",
		".comments",
		".comment",
		".advertisement",
		".ad",
		".ads",
		".social-share",
		".share-buttons",
		".related-posts",
		".related-articles",
		".newsletter",
		".subscribe",
		'[role="navigation"]',
		'[role="banner"]',
		'[role="contentinfo"]',
		'[aria-hidden="true"]',
		".cookie-notice",
		".popup",
		".modal",
		".author-bio",
		".tags",
		".meta",
		"button",
		"form",
		"input",
	];

	removeSelectors.forEach((sel) => {
		clone.querySelectorAll(sel).forEach((el) => el.remove());
	});

	// Extract text with structure
	let content = "";
	const walkNode = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			content += node.textContent;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = node.tagName.toLowerCase();
			const blockElements = [
				"p",
				"div",
				"h1",
				"h2",
				"h3",
				"h4",
				"h5",
				"h6",
				"li",
				"br",
				"hr",
				"blockquote",
				"pre",
				"tr",
			];

			if (blockElements.includes(tag)) content += "\n";
			if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag))
				content += "\n## ";
			if (tag === "li") content += "• ";

			for (const child of node.childNodes) walkNode(child);

			if (blockElements.includes(tag)) content += "\n";
		}
	};
	walkNode(clone);

	// Clean up whitespace
	content = content
		.replace(/\t/g, " ")
		.replace(/ +/g, " ")
		.replace(/\n\s*\n\s*\n+/g, "\n\n")
		.replace(/^\s+/gm, "")
		.trim();
	// No content limit - Chrome extension has full DOM access, get everything

	return {
		title: title.trim(),
		url: window.location.href,
		description: metaDesc,
		author: author.trim(),
		publishDate,
		content,
	};
}

// Format content for memory with proper structure
function formatMemoryContent(pageContent) {
	let markdown = "";

	if (pageContent.url) {
		markdown += `**Source:** [${pageContent.url}](${pageContent.url})\n\n`;
	}

	if (pageContent.description) {
		markdown += `> ${pageContent.description}\n\n`;
	}

	if (pageContent.author) {
		markdown += `**Author:** ${pageContent.author}\n\n`;
	}

	if (pageContent.publishDate) {
		markdown += `**Published:** ${pageContent.publishDate}\n\n`;
	}

	markdown += "---\n\n";

	// Preserve the paragraph structure from content
	markdown += pageContent.content;

	return markdown;
}

// Chat form handler
chatForm.addEventListener("submit", async (e) => {
	e.preventDefault();

	const query = chatInput.value.trim();
	if (!query || isStreaming) return;

	// Check if user wants to save the page
	const savePatterns = [
		/save\s*(this)?\s*page/i,
		/save\s*(this)?\s*(web)?page/i,
		/remember\s*(this)?\s*page/i,
		/store\s*(this)?\s*page/i,
		/add\s*(this)?\s*page/i,
		/save\s*(this)?\s*article/i,
		/save\s*(this)?\s*site/i,
	];

	if (savePatterns.some((pattern) => pattern.test(query))) {
		chatInput.value = "";
		addMessage("user", query);
		await saveCurrentPage();
		return;
	}

	// Regular chat
	chatInput.value = "";
	addMessage("user", query);
	await streamChat(query);
});

// Stream chat response
async function streamChat(query) {
	isStreaming = true;
	sendBtn.disabled = true;

	// Add assistant message placeholder
	const messageDiv = document.createElement("div");
	messageDiv.className = "message assistant";
	messageDiv.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
	messagesContainer.appendChild(messageDiv);
	scrollToBottom();

	const contentDiv = messageDiv.querySelector(".message-content");
	let fullResponse = "";
	let citations = [];

	try {
		showStatus("Searching memories...");

		for await (const event of api.streamChat(query, currentConversationId)) {
			switch (event.type) {
				case "status":
					showStatus(event.payload);
					break;

				case "token":
					if (fullResponse === "") {
						contentDiv.innerHTML = "";
						hideStatus();
					}
					fullResponse += event.payload;
					contentDiv.innerHTML = formatMarkdownSafe(fullResponse);
					scrollToBottom();
					break;

				case "sources":
					// Store for later
					break;

				case "done":
					currentConversationId = event.payload.conversation_id;
					citations = event.payload.citations || [];

					if (citations.length > 0) {
						contentDiv.innerHTML =
							formatMarkdownSafe(fullResponse) + formatCitations(citations);
					}
					break;

				case "error":
					contentDiv.innerHTML = `❌ ${escapeHtml(
						event.payload.message || "An error occurred",
					)}`;
					break;
			}
		}
	} catch (error) {
		console.error("Chat error:", error);
		contentDiv.innerHTML = `❌ ${escapeHtml(error.message)}`;
	} finally {
		isStreaming = false;
		sendBtn.disabled = false;
		hideStatus();
		scrollToBottom();
		chatInput.focus();
	}
}

// Add message to chat
function addMessage(role, content) {
	const messageDiv = document.createElement("div");
	messageDiv.className = `message ${role}`;
	messageDiv.innerHTML = `<div class="message-content">${formatMarkdownSafe(
		content,
	)}</div>`;
	messagesContainer.appendChild(messageDiv);
	scrollToBottom();
}

// Format markdown (basic) - DEPRECATED: Use formatMarkdownSafe instead
// Kept for reference only
function formatMarkdown(text) {
	console.warn("formatMarkdown is deprecated, use formatMarkdownSafe instead");
	return formatMarkdownSafe(text);
}

// Format citations (XSS protected)
function formatCitations(citations) {
	if (!citations || citations.length === 0) return "";

	const citationItems = citations
		.map(
			(c) => `<span class="citation">${escapeHtml(c.title || "Memory")}</span>`,
		)
		.join("");

	return `<div class="citations"><strong>Sources:</strong> ${citationItems}</div>`;
}

// Status bar
function showStatus(text) {
	statusText.textContent = text;
	statusBar.classList.remove("hidden");
}

function hideStatus() {
	statusBar.classList.add("hidden");
}

// Scroll to bottom of messages
function scrollToBottom() {
	messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initialize on load
init();
