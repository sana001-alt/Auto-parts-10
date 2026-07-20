import React, { useState, useEffect } from "react";
import { MessageSquare, ArrowRight, Compass, Search } from "lucide-react";
import { User, Chat } from "../types";
import { subscribeToUserChats } from "../lib/firebase";

interface ChatsScreenProps {
  currentUser: User;
  onSelectChat: (chat: Chat) => void;
  unreadCounts: Record<string, number>;
}

export default function ChatsScreen({ currentUser, onSelectChat, unreadCounts = {} }: ChatsScreenProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log(`[ChatsScreen] Subscribing to chats for user ${currentUser.id}`);
    const unsubscribe = subscribeToUserChats(
      currentUser.id,
      (data) => {
        console.log(`[ChatsScreen] Chats received in ChatsScreen. Size: ${data.length}`);
        setChats(data);
        setLoading(false);
      },
      (err) => {
        console.error(`[ChatsScreen] Error syncing chats in ChatsScreen:`, err);
        setError(err.message || String(err));
        setLoading(false);
      }
    );
    return () => {
      console.log(`[ChatsScreen] Unsubscribing from chats listener in ChatsScreen`);
      unsubscribe();
    };
  }, [currentUser.id]);

  const filteredChats = chats.filter((chat) => {
    const isUserBuyer = currentUser.id === chat.buyerId;
    const partnerName = isUserBuyer ? chat.sellerName : chat.buyerName;
    return (
      partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.partTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getRelativeTime = (timestamp: number) => {
    const difference = Date.now() - timestamp;
    const minutes = Math.floor(difference / (60 * 1000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 h-full relative" id="chats-screen-container">
      {/* Title Header */}
      <div className="bg-slate-900 text-white pt-5 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <h2 className="text-sm font-black tracking-wider uppercase mb-3">My Inbox</h2>
        
        {/* Custom Inbox Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats by user or product..."
            className="w-full bg-slate-800 border-none rounded-full py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
            id="chats-search-input"
          />
        </div>
      </div>

      {/* Main Lists Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-red-50 rounded-3xl border border-red-100 shadow-sm" id="chats-error">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3 text-lg font-black">
              ⚠
            </div>
            <h4 className="text-xs font-extrabold text-red-800">Failed to Sync Chats</h4>
            <p className="text-[11px] text-red-600 mt-1 max-w-xs leading-relaxed font-semibold">
              {error}
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12" id="chats-loading">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[10px] font-bold text-slate-400 tracking-wide font-mono animate-pulse">
              SYNCING CHATS...
            </span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm" id="chats-empty">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
              <MessageSquare size={24} />
            </div>
            <h4 className="text-xs font-extrabold text-slate-800">No conversations yet</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
              {searchQuery 
                ? "No chat matches your search terms. Try searching something else." 
                : "Your chat inbox is empty. Browse listings and select 'Chat with Seller' to start negotiating!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2" id="chats-list">
            {filteredChats.map((chat) => {
              const isUserBuyer = currentUser.id === chat.buyerId;
              const partnerName = isUserBuyer ? chat.sellerName : chat.buyerName;
              const partnerRole = isUserBuyer ? "Seller" : "Buyer";
              const isUnread = (unreadCounts[chat.id] || 0) > 0;

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center gap-3 cursor-pointer group ${
                    isUnread 
                      ? "bg-indigo-50/40 border-indigo-200 hover:border-indigo-300 shadow-sm" 
                      : "bg-white border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md"
                  }`}
                  id={`chat-item-${chat.id}`}
                >
                  {/* Part Thumbnail */}
                  <div className="relative shrink-0">
                    <img
                      src={chat.partImageUrl}
                      alt={chat.partTitle}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-100"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600/10 border border-white text-indigo-600 rounded-full flex items-center justify-center text-[8px] font-black uppercase">
                      {partnerName.substring(0, 1)}
                    </div>
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-xs truncate group-hover:text-indigo-600 transition-colors ${
                          isUnread ? "font-black text-slate-950" : "font-extrabold text-slate-800"
                        }`}>
                          {partnerName}
                        </span>
                        <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.2 rounded shrink-0 uppercase">
                          {partnerRole}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">
                        {getRelativeTime(chat.lastMessageAt)}
                      </span>
                    </div>

                    <p className={`text-[11px] truncate leading-snug ${
                      isUnread ? "font-extrabold text-slate-900" : "font-semibold text-slate-700"
                    }`}>
                      {chat.partTitle}
                    </p>
                    
                    <p className={`text-[10px] truncate mt-0.5 font-medium ${
                      isUnread ? "text-indigo-600 font-extrabold" : "text-slate-400 italic"
                    }`}>
                      {chat.lastMessageText || "No messages yet"}
                    </p>
                  </div>

                  {/* Arrow Indicator & Unread Badge */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {isUnread && (
                      <span className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] font-black animate-pulse shadow-sm">
                        {unreadCounts[chat.id]}
                      </span>
                    )}
                    <div className="text-slate-300 group-hover:text-slate-500 transition-colors pl-1">
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
