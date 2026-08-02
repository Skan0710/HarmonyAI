import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-800 text-slate-200 border-r border-slate-700 flex flex-col p-4">
      <nav className="flex flex-col gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md transition-colors ${
              isActive ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-700/50 text-slate-300'
            }`
          }
        >
          Home
        </NavLink>
      </nav>
    </aside>
  );
};
