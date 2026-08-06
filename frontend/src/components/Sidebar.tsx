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
      </nav>
    </aside>
  );
};
