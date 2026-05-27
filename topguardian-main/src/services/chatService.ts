/**
 * Chat service using API calls for real-time messaging.
 */

import { apiCall } from './api';
import { io, Socket } from 'socket.io-client';

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
  private _snapshot: { users: ChatUser[]; totalUnread: number; onlineCount: number; trainingOnlineCount: number } = { users: [], totalUnread: 0, onlineCount: 0, trainingOnlineCount: 0 };
  private _convSnapshots: Map<number, ChatMessage[]> = new Map();
  private unreadByUser: Record<number, number> = {};
  private socket: Socket | null = null;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {}

  private async pollUpdates() {
    if (!this.currentUserId) return;

    try {
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
          onlineCount: this._snapshot.onlineCount,
          trainingOnlineCount: this._snapshot.trainingOnlineCount,
        };
        this.notify();
      }
    } catch (error) {
      console.error('Error polling updates:', error);
    }
  }

  private debouncedPollUpdates() {
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
    this.pollTimeout = setTimeout(() => {
      this.pollUpdates();
    }, 500);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  async connect(userId: number) {
    this.currentUserId = userId;
    
    // Conectar WebSocket (usa tu variable de entorno o fallback a localhost)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000';
    this.socket = io(apiUrl);

    this.socket.on('connect', () => {
      this.socket?.emit('join_chat', userId);
      this.pollUpdates(); // Cargar estado inicial y conteo de no leídos
    });

    this.socket.on('receive_message', (message: ChatMessage) => {
      this.handleIncomingMessage(message);
    });

    this.socket.on('user_status_change', (data: { userId: number, online: boolean }) => {
      const updatedUsers = [...this._snapshot.users];
      const userIndex = updatedUsers.findIndex(u => u.id === data.userId);
      if (userIndex !== -1) {
        updatedUsers[userIndex] = { ...updatedUsers[userIndex], online: data.online };
        this._snapshot = { ...this._snapshot, users: updatedUsers };
        this.notify();
      }
    });

    // Escuchar el contador total de usuarios en línea emitido por el backend
    this.socket.on('online_count_update', (count: number) => {
      this._snapshot = { ...this._snapshot, onlineCount: count };
      this.notify();
    });

    // Escuchar el contador de empleados conectados a la app de Training
    this.socket.on('training_online_count_update', (count: number) => {
      this._snapshot = { ...this._snapshot, trainingOnlineCount: count };
      this.notify();
    });

    // Escuchar cuando el otro usuario lee mis mensajes
    this.socket.on('messages_read_by_user', (data: { read_by: number }) => {
      const cached = this._convSnapshots.get(data.read_by);
      if (cached) {
        const updated = cached.map(m => ({ ...m, read_status: true }));
        this._convSnapshots.set(data.read_by, updated);
        this.notify();
      }
    });
  }

  private handleIncomingMessage(message: ChatMessage) {
    if (!this.currentUserId) return;
    
    // Identificar a la contraparte de la conversación (ya sea si enviamos o recibimos)
    const otherUserId = message.from_user_id === this.currentUserId 
      ? message.to_user_id 
      : message.from_user_id;

    // Si la conversación ya está cargada en memoria, adjuntamos el mensaje
    if (this._convSnapshots.has(otherUserId)) {
      const conv = this._convSnapshots.get(otherUserId)!;
      if (!conv.some(m => m.id === message.id)) {
        this._convSnapshots.set(otherUserId, [...conv, message]);
      }
    }

    // Si recibimos un mensaje de otro usuario, actualizamos el conteo de no leídos
    if (message.from_user_id !== this.currentUserId) {
      // Incrementamos localmente para evitar hacer peticiones HTTP al backend (Mejora de performance)
      this.unreadByUser[message.from_user_id] = (this.unreadByUser[message.from_user_id] || 0) + 1;
      this._snapshot.totalUnread += 1;
    }
    
    this.notify(); // Notifica a ChatWidget.tsx para re-renderizar
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = null;
  }

  async sendMessage(toUserId: number, text: string) {
    if (!this.currentUserId || !this.socket) return;

    try {
      // Emitir el evento de mensajería directamente vía WebSockets
      this.socket.emit('send_message', {
        from_user_id: this.currentUserId,
        to_user_id: toUserId,
        message_text: text
      });
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

      // Avisar al otro usuario en tiempo real que leímos sus mensajes
      this.socket?.emit('messages_read', {
        from_user_id: fromUserId,
        to_user_id: this.currentUserId
      });

      // Actualizar la caché en memoria en lugar de borrarla (evita que desaparezca el chat)
      const cached = this._convSnapshots.get(fromUserId);
      if (cached) {
        const updated = cached.map(m => ({ ...m, read_status: true }));
        this._convSnapshots.set(fromUserId, updated);
      }

      // Actualizar los conteos de no leídos localmente
      const unreadCount = this.unreadByUser[fromUserId] || 0;
      if (unreadCount > 0) {
        this._snapshot.totalUnread = Math.max(0, this._snapshot.totalUnread - unreadCount);
        this.unreadByUser[fromUserId] = 0;
      }
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

  getOnlineCount(): number {
    return this._snapshot.onlineCount;
  }

  getTrainingOnlineCount(): number {
    return this._snapshot.trainingOnlineCount;
  }

  getCurrentUserId() {
    return this.currentUserId;
  }
}

export const chatService = new ChatService();
