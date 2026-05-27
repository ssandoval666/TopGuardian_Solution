import { useState, useEffect, useRef, useCallback } from "react";
import { chatService, type ChatUser, type ChatMessage } from "@/services/chatService";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, X, Send, ArrowLeft, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Simple emoji list
const EMOJI_LIST = ["😀","😂","😍","👍","❤️","🔥","🎉","👋","😊","🤔","😎","💪","✅","⭐","🚀","💬","📌","🙏","😢","😡"];

// Custom hook for chat state management
const useChatState = () => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [conversations, setConversations] = useState<Map<number, ChatMessage[]>>(new Map());

  useEffect(() => {
    const handleUpdate = () => {
      const snapshot = chatService.getSnapshot();
      setUsers(snapshot.users);
      setTotalUnread(snapshot.totalUnread);
    };

    const unsubscribe = chatService.subscribe(handleUpdate);
    handleUpdate(); // Initial update

    return unsubscribe;
  }, []);

  const getConversation = useCallback((userId: number) => {
    return conversations.get(userId) || [];
  }, [conversations]);

  const loadConversation = useCallback(async (userId: number) => {
    try {
      const messages = await chatService.getConversationSnapshot(userId);
      setConversations(prev => new Map(prev.set(userId, messages)));
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }, []);

  const markAsRead = useCallback(async (userId: number) => {
    await chatService.markAsRead(userId);
    // Force update after marking as read
    const snapshot = chatService.getSnapshot();
    setUsers(snapshot.users);
    setTotalUnread(snapshot.totalUnread);
  }, []);

  return {
    users,
    totalUnread,
    getConversation,
    loadConversation,
    markAsRead,
  };
};

const ChatWidget = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);

  // Connect/disconnect on auth changes
  useEffect(() => {
    if (isAuthenticated && user) {
      chatService.onForceLogout(() => {
        chatService.disconnect();
        logout();
        toast.error("Sesión finalizada: Se detectó un acceso desde otra ubicación o pestaña.", { duration: 6000 });
      });
      chatService.connect(parseInt(user.id));
      return () => {
        chatService.onForceLogout(undefined);
        chatService.disconnect();
      };
    }
  }, [isAuthenticated, user, logout]);

  const { users, totalUnread, loadConversation, markAsRead } = useChatState();

  if (!isAuthenticated) return null;

  // Mantiene al usuario seleccionado siempre actualizado con los cambios en tiempo real
  const currentSelectedUser = selectedUser 
    ? users.find(u => u.id === selectedUser.id) || selectedUser 
    : null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[480px] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {currentSelectedUser ? (
            <ChatConversation
              otherUser={currentSelectedUser}
              onBack={() => setSelectedUser(null)}
              onClose={() => { setOpen(false); setSelectedUser(null); }}
              loadConversation={loadConversation}
              markAsRead={markAsRead}
            />
          ) : (
            <ChatUserList
              users={users}
              onSelect={(u) => {
                setSelectedUser(u);
                markAsRead(u.id);
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      )}
    </>
  );
};

/* ---- User List ---- */
const ChatUserList = ({
  users,
  onSelect,
  onClose,
}: {
  users: ChatUser[];
  onSelect: (u: ChatUser) => void;
  onClose: () => void;
}) => (
  <>
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
      <h3 className="font-semibold text-foreground">Chat</h3>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto">
      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No hay usuarios disponibles</p>
      )}
      {users.map((u) => {
        const unread = chatService.getUnreadCount(u.id);
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/60 transition-colors text-left"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {u.name.charAt(0)}
              </div>
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
                  u.online ? "bg-green-500" : "bg-red-400"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground">
                {u.online ? "En línea" : "Desconectado"}
              </p>
            </div>
            {unread > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </>
);

/* ---- Conversation ---- */
const ChatConversation = ({
  otherUser,
  onBack,
  onClose,
  loadConversation,
  markAsRead,
}: {
  otherUser: ChatUser;
  onBack: () => void;
  onClose: () => void;
  loadConversation: (userId: number) => Promise<void>;
  markAsRead: (userId: number) => Promise<void>;
}) => {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation on mount or when otherUser changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      loadConversation(otherUser.id),
      markAsRead(otherUser.id)
    ]).then(() => {
      // Get messages from cache after loading
      const cachedMessages = chatService.getCachedConversation(otherUser.id);
      setMessages(cachedMessages);
      setLoading(false);
    }).catch((error) => {
      console.error('Error loading conversation:', error);
      setError('Error al cargar la conversación');
      setLoading(false);
    });
  }, [otherUser.id, loadConversation, markAsRead]);

  // Listen for message updates
  useEffect(() => {
    const handleUpdate = () => {
      const cachedMessages = chatService.getCachedConversation(otherUser.id);
      setMessages(cachedMessages);
    };

    const unsubscribe = chatService.subscribe(handleUpdate);
    return unsubscribe;
  }, [otherUser.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await chatService.sendMessage(otherUser.id, trimmed);
      setText("");
      setShowEmoji(false);
      // Messages will be updated via the subscription
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [text, otherUser.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const currentUserId = chatService.getCurrentUserId();

  // Check if user is properly authenticated
  if (!currentUserId) {
    return (
      <div className="flex-1 flex items-center justify-center px-3 py-3">
        <p className="text-xs text-muted-foreground text-center">
          Usuario no autenticado
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-muted/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
            {otherUser.name.charAt(0)}
          </div>
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
              otherUser.online ? "bg-green-500" : "bg-red-400"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{otherUser.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {otherUser.online ? "En línea" : "Desconectado"}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-background/50">
        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Cargando conversación...</p>
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Inicia la conversación 👋
          </p>
        )}
        {!loading && !error && messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMine={msg.from_user_id === currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 flex flex-wrap gap-1">
          {EMOJI_LIST.map((e) => (
            <button
              key={e}
              className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-lg"
              onClick={() => setText((prev) => prev + e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setShowEmoji(!showEmoji)}
        >
          <Smile className="h-4 w-4" />
        </Button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary transition-colors"
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={send}
          disabled={!text.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
};

/* ---- Bubble ---- */
const MessageBubble = ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{msg.message_text}</p>
        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {time}
          {isMine && (
            <span className="ml-1">{msg.read_status ? "✓✓" : "✓"}</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ChatWidget;
