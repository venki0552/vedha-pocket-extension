// Supabase client for Chrome Extension
import { CONFIG } from "./config.js";

class SupabaseClient {
	constructor() {
		this.url = CONFIG.SUPABASE_URL;
		this.anonKey = CONFIG.SUPABASE_ANON_KEY;
		this.session = null;
	}

	async init() {
		// Load session from storage
		const stored = await chrome.storage.local.get(["supabase_session"]);
		if (stored.supabase_session) {
			this.session = stored.supabase_session;
			// Validate session is not expired
			if (this.isSessionExpired()) {
				await this.refreshSession();
			}
		}
		return this.session;
	}

	isSessionExpired() {
		if (!this.session?.expires_at) return true;
		// Add 60 second buffer
		return Date.now() / 1000 > this.session.expires_at - 60;
	}

	async signInWithPassword(email, password) {
		const response = await fetch(
			`${this.url}/auth/v1/token?grant_type=password`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: this.anonKey,
				},
				body: JSON.stringify({ email, password }),
			}
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(
				error.error_description || error.message || "Login failed"
			);
		}

		const data = await response.json();
		this.session = {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expires_at: data.expires_at,
			user: data.user,
		};

		// Save to storage
		await chrome.storage.local.set({ supabase_session: this.session });

		return this.session;
	}

	async refreshSession() {
		if (!this.session?.refresh_token) {
			throw new Error("No refresh token available");
		}

		try {
			const response = await fetch(
				`${this.url}/auth/v1/token?grant_type=refresh_token`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						apikey: this.anonKey,
					},
					body: JSON.stringify({ refresh_token: this.session.refresh_token }),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to refresh session");
			}

			const data = await response.json();
			this.session = {
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				expires_at: data.expires_at,
				user: data.user,
			};

			await chrome.storage.local.set({ supabase_session: this.session });
			return this.session;
		} catch (error) {
			// Clear invalid session
			await this.signOut();
			throw error;
		}
	}

	async signOut() {
		this.session = null;
		await chrome.storage.local.remove(["supabase_session"]);
	}

	async getSession() {
		if (!this.session) {
			await this.init();
		}

		if (this.session && this.isSessionExpired()) {
			try {
				await this.refreshSession();
			} catch {
				return null;
			}
		}

		return this.session;
	}

	async getAccessToken() {
		const session = await this.getSession();
		return session?.access_token;
	}

	getUser() {
		return this.session?.user;
	}
}

// Export singleton
export const supabase = new SupabaseClient();
