/**
 * Chat service using API calls for real-time messaging.
 */

import { apiCall } from './api';

export interface ChatUser {
  id: number;
  name: string;
  username: string;
  online: boolean;
}

export interface ChatMessage {
  id: number;
  from_user_id: number;
  to_user_id: number;
  message_text: string;
  timestamp: string;
  read_status: boolean;
}

type Listener = () => void;

class ChatService {
  private currentUserId: number | null = null;
  private listeners: Set<Listener> = new Set();
  private _snapshot: { users: ChatUser[]; totalUnread: number } = { users: [], totalUnread: 0 };
  private _convSnapshots: Map<number, ChatMessage[]> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private unreadByUser: Record<number, number> = {};

  constructor() {
    // Disable automatic polling to prevent infinite re-renders
    // this.pollInterval = setInterval(() => this.pollUpdates(), 10000);
  }

  private async pollUpdates() {
    if (!this.currentUserId) return;

    try {
      // Update presence
      await this.updatePresence(true);

      // Get updated user list and unread counts
      const [users, unreadData] = await Promise.all([
        this.fetchUsers(),
        this.fetchUnreadCount()
      ]);

      // Store unread counts by user
      this.unreadByUser = {};
      unreadData.unread_by_user.forEach((item: any) => {
        this.unreadByUser[item.user_id] = item.unread_count;
      });

      // Check if data actually changed before updating snapshot
      const filteredUsers = users.filter((u) => u.id !== this.currentUserId);
      const newTotalUnread = unreadData.total_unread;

      const usersChanged = !this._snapshot.users || 
        filteredUsers.length !== this._snapshot.users.length ||
        filteredUsers.some((user, index) => {
          const oldUser = this._snapshot.users[index];
          return !oldUser || user.id !== oldUser.id || user.name !== oldUser.name || 
                 user.username !== oldUser.username || user.online !== oldUser.online;
        });

      const unreadChanged = this._snapshot.totalUnread !== newTotalUnread;

      if (usersChanged || unreadChanged) {
        this._snapshot = {
          users: filteredUsers,
          totalUnread: newTotalUnread,
        };
        this.notify();
      }
    } catch (error) {
      console.error('Error polling updates:', error);
    }
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async connect(userId: number) {
    this.currentUserId = userId;
    await this.updatePresence(true);
    this.pollUpdates(); // Initial poll
  }

  async disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.currentUserId) {
      await this.updatePresence(false);
      this.currentUserId = null;
    }
  }

  private async updatePresence(isOnline: boolean) {
    if (!this.currentUserId) return;

    try {
      await apiCall('/chat/presence', {
        method: 'POST',
        body: JSON.stringify({ is_online: isOnline }),
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  async sendMessage(toUserId: number, text: string) {
    if (!this.currentUserId) return;

    try {
      const message = await apiCall('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ to_user_id: toUserId, message_text: text }),
      });

      // Clear conversation cache for this user
      this._convSnapshots.delete(toUserId);

      // Update snapshots
      await this.pollUpdates();

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async markAsRead(fromUserId: number) {
    if (!this.currentUserId) return;

    try {
      await apiCall(`/chat/mark-read/${fromUserId}`, {
        method: 'PUT',
      });

      // Clear conversation cache
      this._convSnapshots.delete(fromUserId);
      this.notify();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  private async fetchUsers(): Promise<ChatUser[]> {
    try {
      return await apiCall('/chat/users');
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  private async fetchUnreadCount(): Promise<{ total_unread: number; unread_by_user: any[] }> {
    try {
      return await apiCall('/chat/unread-count');
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return { total_unread: 0, unread_by_user: [] };
    }
  }

  async getConversationSnapshot(otherUserId: number): Promise<ChatMessage[]> {
    let cached = this._convSnapshots.get(otherUserId);
    if (!cached) {
      try {
        const response = await apiCall(`/chat/messages?other_user_id=${otherUserId}&limit=50`);
        // Handle both array and object responses
        cached = Array.isArray(response) ? response : (response?.messages || response?.data || []);
        if (!Array.isArray(cached)) {
          cached = [];
        }
        this._convSnapshots.set(otherUserId, cached);
        this.notify();
      } catch (error) {
        console.error('Error fetching conversation:', error);
        cached = [];
        this._convSnapshots.set(otherUserId, cached);
      }
    }
    return cached;
  }

  getCachedConversation(otherUserId: number): ChatMessage[] {
    return this._convSnapshots.get(otherUserId) || [];
  }

  getSnapshot() {
    return this._snapshot;
  }

  getUsers(): ChatUser[] {
    return this._snapshot.users;
  }

  getUnreadCount(fromUserId: number): number {
    return this.unreadByUser[fromUserId] || 0;
  }

  getTotalUnread(): number {
    return this._snapshot.totalUnread;
  }

  getCurrentUserId() {
    return this.currentUserId;
  }
}

export const chatService = new ChatService();
