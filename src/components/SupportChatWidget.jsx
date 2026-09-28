import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  requestSupport, 
  sendChatMessage, 
  subscribeToChat, 
  subscribeToMessages, 
  deleteMessageRecord,
  endSupportSession
} from '../firebase/firestore';
import { 
  MessageSquare, 
  X, 
  Send, 
  Headphones, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  ArrowDown
} from 'lucide-react';

export default function SupportChatWidget() {
  const { currentUser, userDoc } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [chatConfig, setChatConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  const chatEndRef = useRef(null);

  // Subscribe to parent chat document
  useEffect(() => {
    if (!currentUser) return;
    const unsubChat = subscribeToChat(currentUser.uid, (data) => {
      setChatConfig(data);
    });
    return () => unsubChat();
  }, [currentUser]);

  // Subscribe to messages if chat is active/requesting
  useEffect(() => {
    if (!currentUser || !chatConfig || chatConfig.status === 'idle') {
      setMessages([]);
      return;
    }
    const unsubMsgs = subscribeToMessages(currentUser.uid, (data) => {
      setMessages(data);
    });
    return () => unsubMsgs();
  }, [currentUser, chatConfig]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRequestSupport = async () => {
    setLoading(true);
    try {
      await requestSupport(currentUser.uid, userDoc?.name || 'Client', currentUser.email);
    } catch (error) {
      console.error("Failed to request support:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await sendChatMessage(
        currentUser.uid, 
        currentUser.uid, 
        userDoc?.name || 'Client', 
        inputText.trim()
      );
      setInputText('');
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (!currentUser) return null;

  const status = chatConfig?.status || 'idle';
  const disappearingEnabled = chatConfig?.disappearingEnabled || false;
  const disappearTime = chatConfig?.disappearTime || 15;

  return (
    <div className="font-sans">
      {/* Floating Action Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 group p-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center border border-indigo-550 active:scale-95 animate-bounce-subtle"
          title="Open Support Chat"
        >
          {status === 'requesting' && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-bold items-center justify-center text-white">!</span>
            </span>
          )}
          {status === 'active' && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white dark:border-gray-950"></span>
            </span>
          )}
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window Container */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[520px] z-50 bg-white dark:bg-gray-900 sm:border border-gray-150 dark:border-gray-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between border-b border-indigo-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm tracking-tight truncate">Direct Admin Support</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'active' 
                      ? 'bg-emerald-400' 
                      : status === 'requesting' 
                      ? 'bg-rose-400 animate-pulse' 
                      : 'bg-white/40'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">
                    {status === 'active' 
                      ? 'Connected' 
                      : status === 'requesting' 
                      ? 'Requesting Admin...' 
                      : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-indigo-100 hover:text-white"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Chat Settings Indicator */}
          {disappearingEnabled && status === 'active' && (
            <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/20 flex items-center gap-2 text-rose-800 dark:text-rose-400 text-xs font-semibold select-none animate-fade-in">
              <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Disappearing Messages is Active (15s limit)</span>
            </div>
          )}

          {/* Main Feed Content Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-gray-950/40 relative">
            {status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fade-in">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                  <Headphones className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h5 className="font-extrabold text-sm text-gray-950 dark:text-white">Need Support?</h5>
                  <p className="text-xs text-gray-450 dark:text-gray-500 leading-relaxed font-semibold max-w-[240px]">
                    Initiate a live support request to open a real-time message session. Messages self-destruct once disappearing settings are enabled.
                  </p>
                </div>
                <button
                  onClick={handleRequestSupport}
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-705 disabled:bg-indigo-400 text-white rounded-xl shadow-lg shadow-indigo-600/10 text-xs font-bold transition-all"
                >
                  {loading ? 'Initializing...' : 'Request Live Support'}
                </button>
              </div>
            )}

            {status === 'requesting' && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 animate-pulse">
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950 rounded-full flex items-center justify-center text-rose-500 shadow-inner">
                  <Sparkles className="w-6 h-6 animate-spin-slow" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-sm text-gray-950 dark:text-white">Notifying Administrators</h5>
                  <p className="text-xs text-gray-400 dark:text-gray-500 leading-normal max-w-[200px] font-semibold">
                    Support request dispatched. Please wait for an administrator to accept and open the portal.
                  </p>
                </div>
              </div>
            )}

            {status === 'active' && messages.length === 0 && (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs font-bold leading-normal max-w-[200px] mx-auto space-y-2 select-none">
                <p>Support session active. Type your message below to begin.</p>
              </div>
            )}

            {status === 'active' && messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                clientUid={currentUser.uid} 
                disappearingEnabled={disappearingEnabled} 
                disappearTime={disappearTime} 
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input Footer */}
          {status === 'active' && (
            <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-150 dark:border-gray-800 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a support message..."
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-sm px-3.5 py-2.5 border border-gray-250 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-bold"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-650 hover:bg-indigo-705 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Message Bubble with local tick timer for disappearing messages and auto-delete hooks.
 */
function MessageBubble({ message, clientUid, disappearingEnabled, disappearTime }) {
  const isMe = message.senderId === clientUid;
  const [secondsLeft, setSecondsLeft] = useState(disappearTime);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (message.senderId === 'system') return; // System messages do not expire/disappear
    if (!disappearingEnabled) return;
    if (!message.createdAt) return; // Wait for Firestore server timestamp to resolve

    const calculateTimeLeft = () => {
      const created = message.createdAt instanceof Date 
        ? message.createdAt.getTime() 
        : new Date(message.createdAt).getTime();
      const elapsed = Date.now() - created;
      const remaining = Math.max(0, Math.ceil((disappearTime * 1000 - elapsed) / 1000));
      return remaining;
    };

    // Initialize
    const remaining = calculateTimeLeft();
    setSecondsLeft(remaining);

    if (remaining <= 0) {
      setIsHidden(true);
      deleteMessageRecord(clientUid, message.id);
      return;
    }

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      setSecondsLeft(left);
      
      if (left <= 0) {
        clearInterval(timer);
        setIsHidden(true);
        // Wipe from Firestore
        deleteMessageRecord(clientUid, message.id);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [message, disappearingEnabled, disappearTime, clientUid]);

  if (isHidden) return null;

  if (message.senderId === 'system') {
    return (
      <div className="flex flex-col items-center justify-center p-3.5 my-2 text-center bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl select-none animate-fade-in w-full">
        <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase tracking-wider block mb-1">
          {message.senderName}
        </span>
        <p className="text-xs text-indigo-900 dark:text-indigo-300 font-semibold leading-relaxed">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} animate-fade-in`}>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold px-1.5 mb-0.5 select-none">
        {message.senderName}
      </span>
      <div className={`px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed relative border ${
        isMe 
          ? 'bg-indigo-650 border-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-850 dark:text-gray-200 rounded-tl-none shadow-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        
        {/* Tiny visual timer bar */}
        {disappearingEnabled && secondsLeft > 0 && (
          <div className={`absolute bottom-0 left-0 h-0.5 bg-rose-500/80 transition-all duration-1000`} style={{
            width: `${(secondsLeft / disappearTime) * 100}%`
          }} />
        )}
      </div>

      {disappearingEnabled && secondsLeft > 0 && (
        <span className="text-[9px] text-rose-550 dark:text-rose-400 font-extrabold flex items-center gap-0.5 mt-1 select-none animate-pulse">
          <Clock className="w-2.5 h-2.5" />
          <span>Vanish in {secondsLeft}s</span>
        </span>
      )}
    </div>
  );
}
