import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Phone, MapPin, ShoppingBag } from "lucide-react";
import { User, Chat, Message } from "../types";
import { subscribeToChatMessages, sendChatMessage } from "../lib/firebase";
import { motion } from "motion/react";

interface ChatRoomWindowProps {
  chat: Chat;
  currentUser: User;
  onClose: () => void;
}

export default function ChatRoomWindow({ chat, currentUser, onClose }: ChatRoomWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Determine other participant's details
  const isUserBuyer = currentUser.id === chat.buyerId;
  const partnerName = isUserBuyer ? chat.sellerName : chat.buyerName;
  const partnerRole = isUserBuyer ? "Seller" : "Buyer";

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = subscribeToChatMessages(chat.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [chat.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      await sendChatMessage(chat.id, currentUser.id, messageText, chat);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsSending(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="absolute inset-0 bg-slate-50 flex flex-col z-40" id={`chat-room-${chat.id}`}>
      {/* Top Header */}
      <div className="bg-slate-900 text-white pt-4 pb-3 px-4 flex items-center gap-3 shadow-md">
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white"
          id="chat-back-btn"
        >
          <ArrowLeft size={18} />
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-extrabold text-xs text-white truncate">{partnerName}</h3>
            <span className="text-[8px] bg-sky-500/20 text-sky-400 font-black px-1 py-0.2 rounded uppercase">
              {partnerRole}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">Auto Parts India Marketplace</p>
        </div>

        {/* Small avatar */}
        <div className="w-8 h-8 bg-indigo-600/25 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0">
          {partnerName.substring(0, 2)}
        </div>
      </div>

      {/* Linked product card bar */}
      <div className="bg-white border-b border-slate-100 p-2.5 flex items-center gap-2.5 shadow-sm shrink-0">
        <img 
          src={chat.partImageUrl} 
          alt={chat.partTitle} 
          referrerPolicy="no-referrer"
          className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0" 
        />
        <div className="flex-1 min-w-0">
          <span className="text-[8px] font-black text-indigo-600 tracking-wider uppercase block">INQUIRY ABOUT</span>
          <h4 className="text-[11px] font-bold text-slate-800 truncate leading-snug">{chat.partTitle}</h4>
          <span className="text-[10px] font-black text-slate-900 font-mono">{formatPrice(chat.partPrice)}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-extrabold border border-emerald-100">
            Active Chat
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-indigo-500">
              <ShoppingBag size={20} />
            </div>
            <p className="text-[11px] font-extrabold text-slate-700">Start the Conversation</p>
            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
              Ask about condition, price negotiation, pick up details or fitment compatibility.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                <div 
                  className={`p-3 rounded-2xl text-xs leading-relaxed font-medium shadow-sm break-words ${
                    isMe 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[8px] text-slate-400 font-bold mt-1 px-1 font-mono">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <form 
        onSubmit={handleSend}
        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 sticky bottom-0 z-10 shadow-md shrink-0"
      >
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message here..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-full py-2.5 px-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
          required
          maxLength={500}
          id="chat-message-input"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full transition-colors shrink-0 flex items-center justify-center shadow-sm"
          id="chat-send-btn"
        >
          <Send size={14} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
        </button>
      </form>
    </div>
  );
}
