import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MiniPlayer } from './MiniPlayer';
import { QueueDrawer } from './QueueDrawer';
import { FullPlayer } from './FullPlayer';
import { AmbientBackground } from './ui/AmbientBackground';

export const MainLayout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen text-text-primary">
      <AmbientBackground />
      <Navbar onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 overflow-y-auto pb-28">
          <Outlet />
        </main>
      </div>
      <MiniPlayer onExpand={() => setFullPlayerOpen(true)} />
      <QueueDrawer />
      <FullPlayer isOpen={fullPlayerOpen} onClose={() => setFullPlayerOpen(false)} />
    </div>
  );
};
