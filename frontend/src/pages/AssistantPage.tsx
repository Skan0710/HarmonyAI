import React, { useState, useRef, useEffect } from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { usePlayer } from '../hooks/usePlayer';
import { Link } from 'react-router-dom';
import { Sparkles, Trash2, CheckCircle2, Play, Pause } from 'lucide-react';
import { GenerateButton } from '../components/ui/generate-button';
import { ScrollArea } from '../components/ui/scroll-area';
import { SmoothInput } from '../components/ui/SmoothInput';

const SUGGESTION_EXAMPLES = [
  'Find calm songs for studying',
  'Add these songs to my playlist',
  'Make my queue more energetic',
  'Create a 15-song late-night playlist',
  'Recommend something outside my usual taste',
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
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-accent-wash flex items-center justify-center border border-accent/30">
            <Sparkles className="w-5 h-5 text-accent animate-pulse" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-xl md:text-2xl text-text-primary tracking-tight flex items-center gap-2">
              AI Music Assistant
              <span className="text-xs uppercase px-2 py-0.5 rounded-[var(--radius-pill)] bg-gold-wash text-gold border border-gold/30 font-semibold">
                Live
              </span>
            </h1>
            <p className="text-xs text-text-tertiary">Discover music, curate playlists, control queue, and explore your taste</p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearHistory}
          className="text-xs text-text-tertiary hover:text-text-primary px-3 py-1.5 rounded-[var(--radius-md)] bg-surface-1 hover:bg-surface-2 border border-border-default transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Clear Conversation History"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          Clear Chat
        </button>
      </div>

      {/* Global Active Action Confirmation Banner */}
      {activeActionConfirmation && (
        <div className="mt-3 py-2 px-3 rounded-[var(--radius-md)] bg-surface-1 border border-success/40 text-success text-xs flex items-center gap-2 animate-fadeIn shrink-0">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" strokeWidth={1.75} />
          <span className="font-semibold">Action Confirmed:</span> {activeActionConfirmation}
        </div>
      )}

      {/* Conversation Stream */}
      <ScrollArea className="flex-1 min-h-0 py-4">
        <div className="space-y-4 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} transition-all`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-[var(--radius-lg)] p-4 ${
                  msg.sender === 'user'
                    ? 'bg-accent text-text-on-accent rounded-br-[var(--radius-sharp)]'
                    : 'bg-surface-1 border border-border-default text-text-secondary rounded-bl-[var(--radius-sharp)]'
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
                  <div className="mt-2.5 pt-2 border-t border-border-subtle text-xs text-success flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {msg.actionConfirmation}
                  </div>
                )}

                {/* Render Structured Results (Songs / Recommendations) if returned */}
                {msg.data && (
                  <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-2">
                    {/* Render Songs List */}
                    {Array.isArray(msg.data.songs || msg.data.recommendations) && (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {(msg.data.songs || msg.data.recommendations).slice(0, 8).map((item: any, idx: number) => {
                          const song = item.song || item;
                          if (!song || !song._id) return null;
                          const isCurrent = currentSong?._id === song._id;

                          return (
                            <div
                              key={song._id || idx}
                              className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-surface-0/60 hover:bg-surface-0 border border-border-subtle transition group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => playSong(song)}
                                  className="w-7 h-7 rounded-full bg-accent/80 group-hover:bg-accent flex items-center justify-center text-text-on-accent shrink-0 transition cursor-pointer"
                                >
                                  {isCurrent && isPlaying ? (
                                    <Pause className="w-3.5 h-3.5 animate-pulse" fill="currentColor" strokeWidth={0} />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" strokeWidth={0} />
                                  )}
                                </button>
                                <div className="truncate">
                                  <Link
                                    to={`/songs/${song._id}`}
                                    className="text-xs font-semibold text-text-primary hover:text-accent truncate block"
                                  >
                                    {song.title}
                                  </Link>
                                  <span className="text-[10px] text-text-tertiary truncate block">
                                    {song.artist?.name || 'Artist'} {song.genre?.name ? `• ${song.genre.name}` : ''}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => addToQueue(song)}
                                className="text-text-tertiary hover:text-accent p-1 rounded-[var(--radius-sm)] hover:bg-surface-1 transition text-[11px] shrink-0 cursor-pointer"
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
                      <div className="p-3 rounded-[var(--radius-md)] bg-surface-0/80 border border-accent/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-accent font-semibold uppercase tracking-wider block">Playlist</span>
                          <Link to={`/playlists/${msg.data._id}`} className="text-sm font-bold text-text-primary hover:text-accent">
                            {msg.data.name}
                          </Link>
                          <p className="text-[11px] text-text-tertiary">{msg.data.description || 'Curated with AI'}</p>
                        </div>
                        <Link
                          to={`/playlists/${msg.data._id}`}
                          className="px-3 py-1 rounded-[var(--radius-pill)] bg-accent hover:bg-accent-strong text-text-on-accent text-xs font-medium transition-colors cursor-pointer"
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
              <div className="w-8 h-8 rounded-full bg-accent-wash flex items-center justify-center text-accent shrink-0 animate-spin">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="bg-surface-1 border border-border-default rounded-[var(--radius-lg)] rounded-bl-[var(--radius-sharp)] p-3.5 text-text-secondary text-xs flex items-center gap-2">
                <span className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-accent animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-accent-strong animate-bounce [animation-delay:0.4s]"></span>
                </span>
                <span className="ml-1 text-text-tertiary font-medium">Assistant is thinking & processing your request...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Example Suggestion Chips */}
      <div className="py-2 overflow-x-auto flex gap-2 no-scrollbar shrink-0">
        {SUGGESTION_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            disabled={isLoading}
            className="text-sm whitespace-nowrap px-4 py-2 rounded-[var(--radius-pill)] bg-surface-1 hover:bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary transition-all duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.45)] active:translate-y-0 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            ✨ {example}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="pt-2 shrink-0">
        <div className="relative flex items-center rounded-[var(--radius-lg)] bg-surface-1 border border-border-default focus-within:border-accent transition-colors">
          <SmoothInput
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            maxLength={500}
            disabled={isLoading}
            placeholder="Ask HarmonyAI (e.g. 'Find calm songs for studying', 'Create a 15-song late-night playlist')..."
            wrapperClassName="w-full"
            className="w-full px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary disabled:opacity-60"
          />

          <div className="flex items-center gap-2 pr-3">
            <span className="text-[10px] text-text-tertiary hidden sm:inline">
              {inputPrompt.length}/500
            </span>
            <GenerateButton
              type="submit"
              hue={24}
              isGenerating={isLoading}
              disabled={!inputPrompt.trim() || isLoading}
              className="!text-xs disabled:opacity-40"
            />
          </div>
        </div>
      </form>
    </div>
  );
};
