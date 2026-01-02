// API client for Memory Palace
import { CONFIG } from "./config.js";
import { supabase } from "./supabase.js";

class APIClient {
	constructor() {
		this.baseUrl = CONFIG.API_URL;
		this.orgId = null;
	}

	async getHeaders() {
		const token = await supabase.getAccessToken();
		if (!token) {
			throw new Error("Not authenticated");
		}
		return {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};
	}

	// Fetch user's organizations and cache the first one
	async getOrgId() {
		if (this.orgId) return this.orgId;

		// Check storage first
		const stored = await chrome.storage.local.get(["selected_org_id"]);
		if (stored.selected_org_id) {
			this.orgId = stored.selected_org_id;
			return this.orgId;
		}

		// Fetch from API
		const headers = await this.getHeaders();
		const response = await fetch(`${this.baseUrl}/orgs`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error("Failed to fetch organizations");
		}

		const { data: orgs } = await response.json();
		if (!orgs || orgs.length === 0) {
			throw new Error(
				"No organization found. Please create one in the web app first."
			);
		}

		// Use the first org
		this.orgId = orgs[0].id;
		await chrome.storage.local.set({ selected_org_id: this.orgId });
		return this.orgId;
	}

	// Clear cached org on logout
	async clearCache() {
		this.orgId = null;
		await chrome.storage.local.remove(["selected_org_id"]);
	}

	// Create a new memory
	async createMemory(title, content) {
		const headers = await this.getHeaders();
		const orgId = await this.getOrgId();

		const response = await fetch(`${this.baseUrl}/memories`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				org_id: orgId,
				title,
				content,
				content_html: content,
				tags: ["saved-from-extension"],
				color: "default",
				status: "published",
			}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.message || "Failed to create memory");
		}

		return response.json();
	}

	// Stream chat with memories
	async *streamChat(query, conversationId = null) {
		const headers = await this.getHeaders();
		const orgId = await this.getOrgId();

		const body = {
			org_id: orgId,
			question: query,
		};
		if (conversationId) {
			body.conversation_id = conversationId;
		}

		const response = await fetch(`${this.baseUrl}/general-chat/ask/stream`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.message || "Chat request failed");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.startsWith("data: ")) continue;
				const data = line.slice(6).trim();
				if (data === "[DONE]") continue;

				try {
					const event = JSON.parse(data);
					yield event;
				} catch {
					// Ignore parse errors
				}
			}
		}
	}

	// Get conversations
	async getConversations() {
		const headers = await this.getHeaders();

		const response = await fetch(`${this.baseUrl}/general-chat/conversations`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error("Failed to fetch conversations");
		}

		return response.json();
	}
}

export const api = new APIClient();
