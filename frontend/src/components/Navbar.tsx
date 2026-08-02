import React from 'react';

export const Navbar: React.FC = () => {
  return (
    <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <span className="font-bold text-xl tracking-wide">HarmonyAI</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-300">
        <span>Status: Connected</span>
      </div>
    </header>
  );
};
