import { UserSession } from '../types';
import { Menu, Clock, CalendarCheck, BarChart3, History, UserPlus, BarChart2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import UnitaLogo from './UnitaLogo';

type TabType = 'agora' | 'plantao' | 'relatorios' | 'plantonistas';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  session: UserSession;
  activeSubTab?: 'desempenho' | 'auditoria' | 'uti';
  setActiveSubTab?: (subTab: 'desempenho' | 'auditoria' | 'uti') => void;
}

export default function Sidebar({ activeTab, setActiveTab, session, activeSubTab, setActiveSubTab }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { id: 'agora' as TabType, label: 'Painel Agora', icon: Clock, adminOnly: false },
    { id: 'plantao' as TabType, label: 'Escala de Plantão', icon: CalendarCheck, adminOnly: false },
    { id: 'relatorios' as TabType, label: 'Relatórios', icon: BarChart3, adminOnly: false },
    { id: 'plantonistas' as TabType, label: 'Credenciamento', icon: UserPlus, adminOnly: true },
  ];

  const subMenuItems = [
    { id: 'desempenho' as const, label: 'Desempenho Clínico', icon: BarChart2 },
    { id: 'auditoria' as const, label: 'Segurança & Auditoria', icon: History },
    { id: 'uti' as const, label: 'UTI Não Programada', icon: AlertCircle },
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
            <div key={item.id} className="space-y-1">
              <button
                id={`sidebar-link-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'relatorios' && setActiveSubTab) {
                    setActiveSubTab('desempenho');
                  }
                }}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                    : 'hover:bg-slate-800/50 hover:text-white text-slate-400 font-sans'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-white" />
                )}
                <Icon className={`h-5 w-5 shrink-0 transition-transform duration-250 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span
                  className={`transition-opacity duration-200 whitespace-nowrap overflow-hidden ${
                    isHovered ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
                  }`}
                >
                  {item.label}
                </span>
              </button>

              {/* Render submenu for Relatórios only */}
              {item.id === 'relatorios' && isHovered && (
                <div 
                  className={`pl-6 pr-1 space-y-1 overflow-hidden transition-all duration-300 ${
                    isActive ? 'max-h-40 opacity-100 mt-1 py-1' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  {subMenuItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = isActive && activeSubTab === subItem.id;
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => {
                          setActiveTab('relatorios');
                          if (setActiveSubTab) {
                            setActiveSubTab(subItem.id);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                          isSubActive
                            ? 'bg-slate-800 text-blue-400 border border-slate-700/50'
                            : 'hover:bg-slate-850 hover:text-slate-200 text-slate-500'
                        }`}
                      >
                        <SubIcon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="truncate">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="p-4 border-t border-slate-800/60 flex items-center gap-3">
        <UnitaLogo size={32} className="rounded-full bg-slate-800 border border-slate-700/50 shadow-xs" />
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
