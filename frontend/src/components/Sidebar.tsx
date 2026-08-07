import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-800 text-slate-200 border-r border-slate-700 flex flex-col p-4 shrink-0">
      <nav className="flex flex-col gap-1.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </NavLink>

        <NavLink
          to="/genres"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Browse Genres
        </NavLink>

        <NavLink
          to="/playlists"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Playlists
        </NavLink>

        <NavLink
          to="/library"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          Music Library
        </NavLink>

        <NavLink
          to="/liked-songs"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-rose-600 text-white font-semibold shadow-md shadow-rose-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          Liked Songs
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) =>
            `px-4 py-2.5 rounded-xl transition-all flex items-center gap-3 text-sm font-medium ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
            }`
          }
        >
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Listening History
        </NavLink>
      </nav>
    </aside>
  );
};
