import React, { useState, useRef, useEffect } from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { usePlayer } from '../hooks/usePlayer';
import { Link } from 'react-router-dom';

const SUGGESTION_EXAMPLES = [
  'Find calm songs for studying',
  'Add these songs to my playlist',
  'Make my queue more energetic',
  'Recommend late night synthwave tracks',
  'What are my top music preferences?',
];

export const AssistantPage: React.FC = () => {
  const { messages, isLoading, activeActionConfirmation, sendMessage, clearHistory } = useAssistantStore();
  const { playSong, addToQueue, currentSong, isPlaying } = usePlayer();
  const [inputPrompt, setInputPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;
    sendMessage(inputPrompt.trim());
    setInputPrompt('');
  };

  const handleExampleClick = (example: string) => {
    if (isLoading) return;
    sendMessage(example);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <svg className="w-6 h-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              AI Music Assistant
              <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400">Discover music, curate playlists, control queue, and explore your taste</p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearHistory}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          title="Clear Conversation History"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Chat
        </button>
      </div>

      {/* Global Active Action Confirmation Banner */}
      {activeActionConfirmation && (
        <div className="mt-3 py-2 px-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn shrink-0 shadow-md">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">Action Confirmed:</span> {activeActionConfirmation}
        </div>
      )}

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} transition-all`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-md ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                  : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none backdrop-blur-sm'
              }`}
            >
              {/* Message Header / Timestamp */}
              <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] opacity-70">
                <span className="font-semibold flex items-center gap-1">
                  {msg.sender === 'user' ? 'You' : 'HarmonyAI Assistant'}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Text */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* Step Action Confirmation Badge */}
              {msg.actionConfirmation && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/60 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {msg.actionConfirmation}
                </div>
              )}

              {/* Render Structured Results (Songs / Recommendations) if returned */}
              {msg.data && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-2">
                  {/* Render Songs List */}
                  {Array.isArray(msg.data.songs || msg.data.recommendations) && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {(msg.data.songs || msg.data.recommendations).slice(0, 6).map((item: any, idx: number) => {
                        const song = item.song || item;
                        if (!song || !song._id) return null;
                        const isCurrent = currentSong?._id === song._id;

                        return (
                          <div
                            key={song._id || idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 transition group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => playSong(song)}
                                className="w-7 h-7 rounded-full bg-indigo-600/80 group-hover:bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow transition cursor-pointer"
                              >
                                {isCurrent && isPlaying ? (
                                  <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </button>
                              <div className="truncate">
                                <Link
                                  to={`/songs/${song._id}`}
                                  className="text-xs font-semibold text-slate-200 hover:text-indigo-400 truncate block"
                                >
                                  {song.title}
                                </Link>
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {song.artist?.name || 'Artist'} {song.genre?.name ? `• ${song.genre.name}` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => addToQueue(song)}
                              className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition text-[11px] shrink-0"
                              title="Add to Queue"
                            >
                              + Queue
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Render Created Playlist Card */}
                  {msg.data.name && msg.data._id && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-indigo-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block">Playlist</span>
                        <Link to={`/playlists/${msg.data._id}`} className="text-sm font-bold text-white hover:text-indigo-300">
                          {msg.data.name}
                        </Link>
                        <p className="text-[11px] text-slate-400">{msg.data.description || 'Curated with AI'}</p>
                      </div>
                      <Link
                        to={`/playlists/${msg.data._id}`}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                      >
                        View
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Lightweight Loading State Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 animate-spin">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-bl-none p-3.5 text-slate-300 text-xs flex items-center gap-2 shadow-md">
              <span className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]"></span>
              </span>
              <span className="ml-1 text-slate-400 font-medium">Assistant is thinking & processing your request...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Suggestion Chips */}
      <div className="py-2 overflow-x-auto flex gap-2 no-scrollbar shrink-0">
        {SUGGESTION_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            disabled={isLoading}
            className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            ✨ {example}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="pt-2 shrink-0">
        <div className="relative flex items-center rounded-2xl bg-slate-800/90 border border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 shadow-xl transition">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            maxLength={500}
            disabled={isLoading}
            placeholder="Ask HarmonyAI (e.g. 'Find calm songs for studying', 'Queue up energetic rock')..."
            className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
          />

          <div className="flex items-center gap-2 pr-3">
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              {inputPrompt.length}/500
            </span>
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-40 transition shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
