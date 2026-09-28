import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  subscribeToActiveSupportRequests, 
  subscribeToMessages, 
  subscribeToChat,
  sendChatMessage, 
  acceptSupportRequest, 
  updateChatConfig, 
  endSupportSession,
  deleteMessageRecord,
  getClientSessions
} from '../firebase/firestore';
import { generateSmartSellerReplies } from '../services/geminiChatService';
import { 
  X, 
  Send, 
  Headphones, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Volume2, 
  Check,
  User,
  MessageSquare,
  ArrowLeft,
  Sparkles,
  Bot,
  RefreshCw,
  Zap,
  ShieldCheck,
  HeartHandshake,
  CheckCheck,
  ChevronDown
} from 'lucide-react';

export default function AdminChatDrawer({ isOpen, onClose }) {
  const { currentUser, userDoc } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatConfig, setChatConfig] = useState(null);
  const [clientSessions, setClientSessions] = useState([]);
  const [mobileActiveTab, setMobileActiveTab] = useState('list'); // 'list' or 'chat'
  
  // Gemini AI Smart Reply States
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [activeAiPreset, setActiveAiPreset] = useState('general');

  const chatEndRef = useRef(null);

  // Subscribe to all requesting/active support channels
  useEffect(() => {
    if (!isOpen || !userDoc) return;
    const unsubRequests = subscribeToActiveSupportRequests((data) => {
      setRequests(data);
    });
    return () => unsubRequests();
  }, [isOpen, userDoc]);

  // Subscribe to messages of selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setAiPanelOpen(false);
      setAiSuggestions([]);
      return;
    }
    const unsubMsgs = subscribeToMessages(selectedChat.clientUid, (data) => {
      setMessages(data);
    });
    return () => unsubMsgs();
  }, [selectedChat?.clientUid]);

  // Subscribe to config of selected chat
  useEffect(() => {
    if (!selectedChat) {
      setChatConfig(null);
      setClientSessions([]);
      return;
    }
    const unsubConfig = subscribeToChat(selectedChat.clientUid, (data) => {
      setChatConfig(data);
      if (data && data.status === 'idle') {
        setSelectedChat(null);
        setMessages([]);
      }
    });

    const loadSessions = async () => {
      try {
        const data = await getClientSessions(selectedChat.clientUid);
        setClientSessions(data);
      } catch (err) {
        console.error("Failed to load client sessions:", err);
      }
    };
    loadSessions();

    return () => unsubConfig();
  }, [selectedChat?.clientUid]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoinChat = async (clientUid) => {
    try {
      await acceptSupportRequest(clientUid);
    } catch (err) {
      console.error("Failed to accept support request:", err);
    }
  };

  const handleToggleDisappearing = async () => {
    if (!selectedChat || !chatConfig) return;
    try {
      await updateChatConfig(selectedChat.clientUid, {
        disappearingEnabled: !chatConfig.disappearingEnabled
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndChat = async (clientUid) => {
    if (window.confirm("Wipe conversation history and terminate this support session? Messages will disappear completely.")) {
      try {
        await endSupportSession(clientUid);
        setSelectedChat(null);
        setMessages([]);
        setAiPanelOpen(false);
      } catch (err) {
        console.error("Failed to close chat session:", err);
      }
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedChat) return;
    try {
      await sendChatMessage(
        selectedChat.clientUid,
        currentUser.uid,
        userDoc?.name || 'Admin',
        inputText.trim()
      );
      setInputText('');
      setAiPanelOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Gemini AI Suggestions
  const handleFetchAISuggestions = async (preset = 'general') => {
    if (!selectedChat) return;
    setActiveAiPreset(preset);
    setAiLoading(true);
    setAiPanelOpen(true);

    let stylePrompt = '';
    if (preset === 'closer') {
      stylePrompt = 'Focus strongly on closing the sale, reassuring customer with verified proofs, and providing bank/payment or delivery next steps.';
    } else if (preset === 'action') {
      stylePrompt = 'Focus on immediate step-by-step instructions for OTP, login credentials check, and fast handover.';
    } else if (preset === 'policy') {
      stylePrompt = 'Focus on strict escrow policy, security cooldowns, zero-leak warranty, and terms of service explanation.';
    } else if (preset === 'polish' && inputText.trim()) {
      stylePrompt = `Take the seller's draft: "${inputText.trim()}" and transform it into 3 ultra-professional seller responses.`;
    }

    try {
      const suggestions = await generateSmartSellerReplies({
        clientName: selectedChat.clientName,
        clientEmail: selectedChat.clientEmail,
        messages,
        sellerDraft: inputText.trim(),
        stylePrompt
      });
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error("Error generating AI suggestions:", err);
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle AI Panel
  const handleToggleAIPanel = () => {
    if (!aiPanelOpen) {
      handleFetchAISuggestions('general');
    } else {
      setAiPanelOpen(false);
    }
  };

  // 1-Click Direct Send AI Suggestion
  const handleDirectSendAI = async (replyText) => {
    if (!selectedChat || !replyText) return;
    try {
      await sendChatMessage(
        selectedChat.clientUid,
        currentUser.uid,
        userDoc?.name || 'Admin',
        replyText.trim()
      );
      setInputText('');
      setAiPanelOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Apply AI Suggestion into Input Box
  const handleApplyAISuggestion = (replyText) => {
    setInputText(replyText);
    setAiPanelOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans select-none">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Sliding Panel */}
      <div className="relative w-full max-w-3xl h-full bg-white dark:bg-gray-900 shadow-2xl flex border-l border-gray-150 dark:border-gray-800 overflow-hidden animate-slide-left z-10">
        
        {/* Left Side: Support Channels list */}
        <div className={`w-full md:w-[260px] border-r border-gray-150 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-gray-955/20 shrink-0 ${
          selectedChat && mobileActiveTab === 'chat' ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">Active Channels</h4>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-550 text-xs font-semibold leading-normal max-w-[180px] mx-auto select-none">
                No active support requests at this time.
              </div>
            ) : (
              requests.map(req => {
                const isActive = selectedChat?.clientUid === req.clientUid;
                return (
                  <button
                    key={req.clientUid}
                    onClick={() => {
                      setSelectedChat(req);
                      setMobileActiveTab('chat');
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                        : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-extrabold text-xs truncate flex-1 leading-none">{req.clientName}</span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                        req.status === 'requesting' 
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse' 
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-955/40 dark:text-emerald-400'
                      }`}>
                        {req.status === 'requesting' ? 'Requesting' : 'In Chat'}
                      </span>
                    </div>
                    <span className={`text-[10px] truncate leading-none ${isActive ? 'text-indigo-150' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                      {req.clientEmail}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Chat Box */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 ${
          !selectedChat || mobileActiveTab === 'list' ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Header */}
          <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/25 dark:bg-gray-950/10">
            <div className="flex items-center gap-2 min-w-0">
              {selectedChat && (
                <button 
                  onClick={() => setMobileActiveTab('list')}
                  className="p-1.5 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-500 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-gray-900 md:hidden shrink-0 cursor-pointer"
                  title="Back to Channels"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
              )}
              {selectedChat ? (
                <div className="min-w-0">
                  <h4 className="font-extrabold text-gray-900 dark:text-white text-sm truncate leading-none">{selectedChat.clientName}</h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate font-medium">{selectedChat.clientEmail}</p>
                </div>
              ) : (
                <div>
                  <h4 className="font-extrabold text-gray-900 dark:text-white text-sm leading-none">Support Conversation</h4>
                  <p className="text-[10px] text-gray-455 dark:text-gray-550 mt-1 font-semibold">Select a client channel from the list</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-450 hover:text-gray-700 dark:hover:text-gray-200 transition-colors bg-white dark:bg-gray-900 shrink-0 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Active Settings Panel */}
          {selectedChat && chatConfig && chatConfig.status === 'active' && (
            <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-950/20 border-b border-gray-150 dark:border-gray-800 flex flex-wrap gap-4 items-center justify-between">
              
              {/* Disappearing Toggler */}
              <button
                onClick={handleToggleDisappearing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  chatConfig.disappearingEnabled
                    ? 'bg-rose-50 border-rose-250 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/60 dark:text-rose-400 shadow-sm'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{chatConfig.disappearingEnabled ? 'Disappearing (15s)' : 'Standard History'}</span>
              </button>

              {/* End Chat */}
              <button
                onClick={() => handleEndChat(selectedChat.clientUid)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>End Session</span>
              </button>

            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {!selectedChat ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-3xl">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-extrabold text-sm text-gray-900 dark:text-white">Select a channel</h5>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold max-w-[200px]">
                    Choose a client from the left pane to view messages and assist them.
                  </p>
                </div>
              </div>
            ) : chatConfig && chatConfig.status === 'requesting' ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fade-in">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-550 dark:text-amber-400 rounded-full animate-bounce">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-extrabold text-sm text-gray-950 dark:text-white">Pending Invitation</h5>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold max-w-[220px] mx-auto leading-relaxed">
                    Client is requesting help. Accept the invitation to join and initialize the secure support channel.
                  </p>
                </div>
                <button
                  onClick={() => handleJoinChat(selectedChat.clientUid)}
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-705 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept and Join Chat</span>
                </button>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs font-bold max-w-[200px] mx-auto select-none">
                    Session accepted. Send a message or use ✨ AI Smart Reply to assist the client.
                  </div>
                )}
                {messages.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    adminUid={currentUser.uid} 
                    clientUid={selectedChat.clientUid}
                    disappearingEnabled={chatConfig?.disappearingEnabled} 
                    disappearTime={chatConfig?.disappearTime || 15} 
                  />
                ))}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Gemini AI Smart Suggestions Popover */}
          {selectedChat && chatConfig && chatConfig.status === 'active' && aiPanelOpen && (
            <div className="border-t border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/90 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 p-4 space-y-3 shadow-2xl animate-fade-in relative z-20">
              
              {/* AI Popover Header */}
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/30">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>Gemini AI Seller Copilot</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-955/60 text-purple-700 dark:text-purple-300 font-extrabold">
                        POWERED BY GEMINI
                      </span>
                    </h5>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFetchAISuggestions(activeAiPreset)}
                    disabled={aiLoading}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer disabled:opacity-50"
                    title="Regenerate Suggestions"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiPanelOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"
                    title="Close AI Assistant"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick AI Presets Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px] font-black uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => handleFetchAISuggestions('general')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    activeAiPreset === 'general'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ⚡ Auto Smart
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchAISuggestions('closer')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    activeAiPreset === 'closer'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🤝 Deal Closer
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchAISuggestions('action')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    activeAiPreset === 'action'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ⚡ Steps / OTP
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchAISuggestions('policy')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    activeAiPreset === 'policy'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🛡️ Escrow Rule
                </button>
                {inputText.trim() && (
                  <button
                    type="button"
                    onClick={() => handleFetchAISuggestions('polish')}
                    className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      activeAiPreset === 'polish'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 dark:bg-purple-955/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    ✍️ Enhance My Draft
                  </button>
                )}
              </div>

              {/* Suggestions Cards */}
              {aiLoading ? (
                <div className="p-6 text-center space-y-2 bg-white/60 dark:bg-gray-850/50 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                    Gemini is analyzing client context & generating professional options...
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {aiSuggestions.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-white dark:bg-gray-850 border border-gray-200/90 dark:border-gray-750 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl shadow-xs space-y-2 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-955/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 tracking-wider">
                          {item.badge || item.tone || `Option #${idx + 1}`}
                        </span>
                        
                        <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleApplyAISuggestion(item.reply)}
                            className="px-2 py-1 text-[10px] font-black uppercase bg-gray-100 dark:bg-gray-750 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            title="Insert text into draft input"
                          >
                            <span>✏️ Draft</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDirectSendAI(item.reply)}
                            className="px-2.5 py-1 text-[10px] font-black uppercase bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Send directly to customer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed break-words">
                        {item.reply}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* Input Footer with Gemini AI Sparkle Button */}
          {selectedChat && chatConfig && chatConfig.status === 'active' && (
            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-900 border-t border-gray-150 dark:border-gray-800 flex items-center gap-2 relative">
              
              {/* Input Textbox */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message or click ✨ AI Copilot..."
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-sm px-4 py-2.5 border border-gray-250 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              />

              {/* Gemini AI Smart Suggestions Button */}
              <button
                type="button"
                onClick={handleToggleAIPanel}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                  aiPanelOpen
                    ? 'bg-purple-600 border-purple-500 text-white shadow-purple-600/30'
                    : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 hover:scale-105 text-white border-transparent shadow-indigo-600/20'
                }`}
                title="✨ Gemini AI Smart Copilot & Professional Reply Generator"
              >
                <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                <span className="text-xs font-black uppercase hidden sm:inline">AI Reply</span>
              </button>

              {/* Normal Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

/**
 * Visual message bubble for admin console supporting disappearing updates.
 */
function MessageBubble({ message, adminUid, clientUid, disappearingEnabled, disappearTime }) {
  const isMe = message.senderId === adminUid;
  const [secondsLeft, setSecondsLeft] = useState(disappearTime);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
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
      <span className="text-[10px] text-gray-450 dark:text-gray-500 font-bold px-1.5 mb-0.5 select-none">
        {message.senderName}
      </span>
      <div className={`px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed relative border ${
        isMe 
          ? 'bg-indigo-650 border-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-850 dark:text-gray-200 rounded-tl-none shadow-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        
        {disappearingEnabled && secondsLeft > 0 && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-rose-500/80 transition-all duration-1000" style={{
            width: `${(secondsLeft / disappearTime) * 100}%`
          }} />
        )}
      </div>

      {disappearingEnabled && secondsLeft > 0 && (
        <span className="text-[9px] text-rose-550 dark:text-rose-450 font-extrabold flex items-center gap-0.5 mt-1 select-none animate-pulse">
          <Clock className="w-2.5 h-2.5" />
          <span>Vanish in {secondsLeft}s</span>
        </span>
      )}
    </div>
  );
}
