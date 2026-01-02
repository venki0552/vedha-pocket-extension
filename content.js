// Content script for Memory Palace Chrome Extension
// This runs on every page and can extract content

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "EXTRACT_CONTENT") {
		const content = extractPageContent();
		sendResponse(content);
	}
	return true;
});

// Extract page content
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
		document.querySelector('meta[name="publish-date"]')?.content ||
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
		".single-post-content",

		// News sites
		".story-body",
		".article__body",
		".article-text",
		".story-content",
		".news-article",
		"[data-component='text-block']",

		// Dev/Tech blogs
		".markdown-body",
		".prose",
		".content-body",
		".documentation-content",
		".doc-content",

		// Generic article structure
		"article",
		"main",
		'[role="main"]',
		'[role="article"]',
		"#content",
		"#main-content",
		".main-content",
		".content",
		".post",
		".article",
	];

	let mainElement = null;
	let maxContentLength = 0;

	// Find the best content element
	for (const selector of mainSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			const textLength = element.innerText?.length || 0;
			// Take the element with the most content (but at least 200 chars)
			if (textLength > 200 && textLength > maxContentLength) {
				mainElement = element;
				maxContentLength = textLength;
			}
		}
	}

	// Fallback to body if no good content found
	if (!mainElement) {
		mainElement = document.body;
	}

	const content = cleanContent(mainElement);

	return {
		title: title.trim(),
		url: window.location.href,
		description: metaDesc,
		author: author.trim(),
		publishDate,
		content,
	};
}

// Clean content by removing unwanted elements
function cleanContent(element) {
	const clone = element.cloneNode(true);

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
		".advert",
		".social-share",
		".share-buttons",
		".sharing",
		".related-posts",
		".related-articles",
		".recommended",
		".newsletter",
		".subscribe",
		".subscription",
		'[role="navigation"]',
		'[role="banner"]',
		'[role="contentinfo"]',
		'[aria-hidden="true"]',
		".cookie-notice",
		".cookie-banner",
		".popup",
		".modal",
		".overlay",
		".author-bio",
		".author-card",
		".tags",
		".tag-list",
		".meta",
		".metadata",
		".byline-info",
		".follow-button",
		".clap-button",
		"button",
		"form",
		"input",
		"select",
	];

	removeSelectors.forEach((selector) => {
		clone.querySelectorAll(selector).forEach((el) => el.remove());
	});

	// Extract text with better formatting
	let text = extractTextWithFormatting(clone);

	// Clean up whitespace while preserving paragraphs
	text = text
		.replace(/\t/g, " ") // Replace tabs with spaces
		.replace(/ +/g, " ") // Collapse multiple spaces (but not newlines)
		.replace(/\n\s*\n\s*\n+/g, "\n\n") // Normalize 3+ newlines to double newline
		.replace(/^\s+/gm, "") // Remove leading whitespace from lines
		.trim();

	// No content limit - Chrome extension has full DOM access
	// Get everything the page has

	return text;
}

// Extract text while preserving some structure
function extractTextWithFormatting(element) {
	let result = "";

	const walkNode = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			result += node.textContent;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const tagName = node.tagName.toLowerCase();

			// Add line breaks before block elements
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
			if (blockElements.includes(tagName)) {
				result += "\n";
			}

			// Add heading markers
			if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
				result += "\n## ";
			}

			// Add list markers
			if (tagName === "li") {
				result += "• ";
			}

			// Process children
			for (const child of node.childNodes) {
				walkNode(child);
			}

			// Add line break after block elements
			if (blockElements.includes(tagName)) {
				result += "\n";
			}
		}
	};

	walkNode(element);
	return result;
}

// Notify that content script is ready
console.log("Memory Palace content script loaded - Enhanced extraction ready");
