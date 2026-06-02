import { UserSession } from '../types';
import { Menu, Clock, CalendarCheck, BarChart3, History, UserPlus } from 'lucide-react';
import { useState } from 'react';

type TabType = 'agora' | 'plantao' | 'relatorios' | 'auditoria' | 'plantonistas';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  session: UserSession;
}

export default function Sidebar({ activeTab, setActiveTab, session }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { id: 'agora' as TabType, label: 'Agora', icon: Clock, adminOnly: false },
    { id: 'plantao' as TabType, label: 'Plantão', icon: CalendarCheck, adminOnly: false },
    { id: 'relatorios' as TabType, label: 'Relatórios', icon: BarChart3, adminOnly: false },
    { id: 'auditoria' as TabType, label: 'Auditoria', icon: History, adminOnly: false },
    { id: 'plantonistas' as TabType, label: 'Cadastrar plantonista', icon: UserPlus, adminOnly: true },
  ];

  const visibleItems = menuItems.filter(item => !item.adminOnly || session.perfil === 'administrador');

  return (
    <aside
      id="app-sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-[73px] bottom-0 left-0 bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 z-40 flex flex-col no-print ${
        isHovered ? 'w-64 shadow-2xl' : 'w-16'
      }`}
    >
      {/* Top hamburger indicator */}
      <div className="h-14 flex items-center px-5 border-b border-slate-800/60 justify-start gap-4">
        <Menu className="h-5 w-5 shrink-0 text-blue-400" />
        <span
          className={`font-display text-xs tracking-wider uppercase font-bold text-slate-400 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          Navegação
        </span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              id={`sidebar-link-${item.id}`}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span
                className={`transition-opacity duration-200 whitespace-nowrap overflow-hidden ${
                  isHovered ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="p-4 border-t border-slate-800/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
          U
        </div>
        <div
          className={`transition-opacity duration-200 whitespace-nowrap ${
            isHovered ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
          }`}
        >
          <div className="text-xs font-semibold text-slate-200">Unitá Anestesia</div>
          <div className="text-[10px] text-slate-500">MVP Escala v1.0</div>
        </div>
      </div>
    </aside>
  );
}
