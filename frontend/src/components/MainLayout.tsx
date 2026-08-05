import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MiniPlayer } from './MiniPlayer';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 pb-24">
          <Outlet />
        </main>
      </div>
      <MiniPlayer />
    </div>
  );
};
