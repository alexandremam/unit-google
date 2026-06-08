/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { UserSession, Doctor, Escalation, DailyPresence } from './types';
import { initializeDatabase, helperGetDoctors, helperGetEscalations, helperGetDailyPresences } from './data';
import Login from './components/Login';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AgoraTab from './components/AgoraTab';
import PlantaoTab from './components/PlantaoTab';
import RelatoriosTab from './components/RelatoriosTab';
import PlantonistaTab from './components/PlantonistaTab';

type TabType = 'agora' | 'plantao' | 'relatorios' | 'plantonistas';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('agora');
  const [relatoriosSubTab, setRelatoriosSubTab] = useState<'desempenho' | 'auditoria' | 'uti'>('desempenho');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [dailyPresences, setDailyPresences] = useState<DailyPresence[]>([]);

  // 1. Initialize databases on mount
  useEffect(() => {
    initializeDatabase();

    // Check for existing active session in browser
    const storedSession = localStorage.getItem('unita_session');
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession));
      } catch (e) {
        localStorage.removeItem('unita_session');
      }
    }

    setDoctors(helperGetDoctors());
    setEscalations(helperGetEscalations());
    setDailyPresences(helperGetDailyPresences());
  }, []);

  // Synchronize doctor.presente boolean based on dailyPresences for Today's date
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todaysDoctorIDs = dailyPresences
      .filter(p => p.date === todayStr)
      .map(p => p.doctorID);

    setDoctors(prevDocs => {
      let changed = false;
      const updated = prevDocs.map(d => {
        const isRostered = todaysDoctorIDs.includes(d.id);
        if (d.presente !== isRostered) {
          changed = true;
          return { ...d, presente: isRostered };
        }
        return d;
      });
      if (changed) {
        localStorage.setItem('unita_doctors', JSON.stringify(updated));
        return updated;
      }
      return prevDocs;
    });
  }, [dailyPresences]);

  // Handler for user login
  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setActiveTab('agora');
    // Refresh records in case login happens after actions
    setDoctors(helperGetDoctors());
    setEscalations(helperGetEscalations());
  };

  // Handler for logout
  const handleLogout = () => {
    localStorage.removeItem('unita_session');
    setSession(null);
    setActiveTab('agora');
  };

  // If there's no active session, restrict access to Login screen only
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-root-container">
      {/* 1. Header with metadata and logout */}
      <Header session={session} onLogout={handleLogout} />

      {/* 2. Main Workspace layout (Sidebar & content grid) */}
      <div className="flex-1 flex relative">
        {/* Sidebar begins collapsed as hamburger stripe, expands on hover */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          session={session}
          activeSubTab={relatoriosSubTab}
          setActiveSubTab={setRelatoriosSubTab}
        />

        {/* Content panel, shifted 64px (pl-16) to account for collapsed sidebar gutter */}
        <main className="flex-1 min-w-0 pl-16 py-8 px-4 sm:px-6 lg:px-8 transition-all duration-300">
          <div className="max-w-7xl mx-auto">
            
            {activeTab === 'agora' && (
              <AgoraTab
                doctors={doctors}
                setDoctors={setDoctors}
                escalations={escalations}
                setEscalations={setEscalations}
                session={session}
                dailyPresences={dailyPresences}
                setDailyPresences={setDailyPresences}
              />
            )}

            {activeTab === 'plantao' && (
              <PlantaoTab
                doctors={doctors}
                setDoctors={setDoctors}
                session={session}
                setSession={setSession}
                dailyPresences={dailyPresences}
                setDailyPresences={setDailyPresences}
              />
            )}

            {activeTab === 'relatorios' && (
              <RelatoriosTab
                doctors={doctors}
                escalations={escalations}
                session={session}
                defaultSubTab={relatoriosSubTab}
                onChangeSubTab={setRelatoriosSubTab}
              />
            )}

            {activeTab === 'plantonistas' && (
              <PlantonistaTab
                doctors={doctors}
                setDoctors={setDoctors}
                session={session}
                dailyPresences={dailyPresences}
                setDailyPresences={setDailyPresences}
              />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
