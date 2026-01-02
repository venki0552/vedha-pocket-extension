// Background service worker for Memory Palace Chrome Extension

// Handle extension install
chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		console.log("Memory Palace extension installed");
	} else if (details.reason === "update") {
		console.log("Memory Palace extension updated");
	}
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "GET_PAGE_CONTENT") {
		// Forward to content script
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]) {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ type: "EXTRACT_CONTENT" },
					(response) => {
						sendResponse(response);
					}
				);
			}
		});
		return true; // Keep channel open for async response
	}

	if (message.type === "OPEN_APP") {
		chrome.tabs.create({ url: message.url });
		return;
	}
});

// Context menu for quick save
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "save-to-memory-palace",
		title: "Save to Memory Palace",
		contexts: ["page", "selection"],
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "save-to-memory-palace") {
		// Open popup to save
		chrome.action.openPopup();
	}
});
