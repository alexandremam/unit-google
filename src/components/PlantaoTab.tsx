import React, { useState, useEffect, useMemo } from 'react';
import { Doctor, UserSession, DailyPresence } from '../types';
import {
  Calendar,
  Users,
  Shield,
  ShieldAlert,
  Crown,
  ChevronLeft,
  ChevronRight,
  ListTodo,
} from 'lucide-react';
import { logSystemEvent } from '../utils';
import UnitaLogo from './UnitaLogo';
import ScaleConfigModal from './ScaleConfigModal';

interface PlantaoTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  session: UserSession;
  setSession?: React.Dispatch<React.SetStateAction<UserSession | null>>;
  dailyPresences: DailyPresence[];
  setDailyPresences: React.Dispatch<React.SetStateAction<DailyPresence[]>>;
  subTab?: 'calendario' | 'escalas';
  setSubTab?: (subTab: 'calendario' | 'escalas') => void;
}

export default function PlantaoTab({
  doctors,
  setDoctors,
  session,
  setSession,
  dailyPresences,
  setDailyPresences,
}: PlantaoTabProps) {
  
  // 1. Calculate Tomorrow's Date for Preselection as default
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA'); // e.g. "YYYY-MM-DD"
  }, []);

  // 2. Main Selected Date State
  const [selectedDate, setSelectedDate] = useState(tomorrowStr);

  // 3. Persistent Coordinator State
  const [dateCoordinators, setDateCoordinators] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('unita_date_coordinators') || '{}');
    } catch (e) {
      return {};
    }
  });

  // 4. Modal Window Toggle
  const [showConfigModal, setShowConfigModal] = useState(false);

  // 5. Calendar Navigation State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // Automatically read date coordinators from localstorage if updated externally
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('unita_date_coordinators') || '{}');
        setDateCoordinators(stored);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Simulation handlers for coordinator roles
  const handleSimulateCustomCoordinator = (coordinatorId: string) => {
    if (!setSession) return;
    const targetDoc = doctors.find(d => d.id === coordinatorId);
    if (!targetDoc) return;

    // Save backup admin registry
    localStorage.setItem('unita_admin_backup', JSON.stringify(session));

    // Swap active context to Coordenador
    const mockSession: UserSession = {
      usuario: targetDoc.nome,
      perfil: 'coordenador'
    };

    localStorage.setItem('unita_session', JSON.stringify(mockSession));
    setSession(mockSession);

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Alteração de coordenador',
      `Privilégios liberados via simulador para Coordenador do Plantão: Dr(a). ${targetDoc.nome}.`
    );

    alert(`Portal de Coordenador Liberado! Você foi transferido para o perfil de Dr(a). ${targetDoc.nome}.`);
  };

  const handleRevertSimulation = () => {
    if (!setSession) return;
    const backup = localStorage.getItem('unita_admin_backup');
    if (backup) {
      const parsed = JSON.parse(backup) as UserSession;
      localStorage.setItem('unita_session', JSON.stringify(parsed));
      setSession(parsed);
      localStorage.removeItem('unita_admin_backup');
    } else {
      const adminSession: UserSession = { usuario: 'Admin', perfil: 'administrador' };
      localStorage.setItem('unita_session', JSON.stringify(adminSession));
      setSession(adminSession);
    }
  };

  const isSimulated = useMemo(() => {
    return localStorage.getItem('unita_admin_backup') !== null;
  }, [session]);

  // Calendar Math Days Logic
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0: Sun ... 6: Sat
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateString: dStr
      });
    }
    return days;
  }, [calendarMonth]);

  const monthLabel = useMemo(() => {
    const names = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${names[calendarMonth.getMonth()]} de ${calendarMonth.getFullYear()}`;
  }, [calendarMonth]);

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  // Compute scheduled doctors and coordinators on SELECTED date natively from global arrays
  const doctorsOnSelectedDate = useMemo(() => {
    const onDate = dailyPresences.filter(p => p.date === selectedDate);
    return onDate.map(p => {
      const doc = doctors.find(d => d.id === p.doctorID);
      if (doc) {
        return {
          ...doc,
          shiftType: p.shiftType
        };
      }
      return null;
    }).filter(Boolean) as (Doctor & { shiftType: string })[];
  }, [selectedDate, dailyPresences, doctors]);

  const coordinatorsOnSelectedDate = useMemo(() => {
    const coords = dateCoordinators[selectedDate] || [];
    return doctors.filter(d => coords.includes(d.id));
  }, [selectedDate, dateCoordinators, doctors]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto" id="plantao-tab-container">
      
      {/* Simulation Alert Banner */}
      {isSimulated && (
        <div className="bg-amber-605/95 bg-amber-600 text-white rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-bold">Modo Coordenador Simulado Ativo</p>
              <p className="text-xs text-amber-100 font-medium font-sans">
                Sessão redirecionada. Você está visualizando o portal como <strong>{session.usuario}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleRevertSimulation}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-amber-950 rounded-lg text-xs font-black uppercase transition-all shadow-sm cursor-pointer"
          >
            Reverter para Admin
          </button>
        </div>
      )}

      {/* Main Row Title Header Banner with brand logo (no tab switcher sub-menus as requested) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
        <div className="flex items-center gap-3">
          <UnitaLogo size={36} className="p-1 rounded-lg bg-slate-50 border border-slate-150 shadow-3xs" />
          <div>
            <h2 className="text-lg font-black text-slate-950 font-display">Escala de Plantão de Anestesia</h2>
            <p className="text-xs text-slate-500 font-medium">
              Acompanhamento mensal integrado do roteiro e escalas diárias de anestesiologistas.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar left column, Side info details listed in the right column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Grid: Monthly Calendar Tile Container (8 columns) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-3xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 font-display flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-blue-600" />
                Calendário Mensal de Plantões
              </h3>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-center font-sans">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-black text-slate-800 font-display min-w-[115px] text-center bg-slate-50 border border-slate-205 py-1 px-2 rounded-xl font-mono">
                {monthLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday indicator labels */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-1.5 bg-slate-50/50 rounded-xl select-none">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((dayItem, index) => {
              if (!dayItem) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="aspect-square bg-slate-50/10 rounded-xl border border-dashed border-slate-100"
                  />
                );
              }

              const isCurrent = dayItem.dateString === selectedDate;
              
              // Filter doctor counts for this tile day
              const dailyPresListForTile = dailyPresences.filter(p => p.date === dayItem.dateString);
              const escCount = dailyPresListForTile.length;
              const hasRoster = escCount > 0;

              // Check if day has coordinators designated
              const coordsOnDay = dateCoordinators[dayItem.dateString] || [];
              const hasCoordOnDay = coordsOnDay.length > 0;

              return (
                <div
                  key={`day-${dayItem.day}`}
                  onClick={() => {
                    setSelectedDate(dayItem.dateString);
                  }}
                  className={`aspect-square rounded-xl border p-2 flex flex-col justify-between relative cursor-pointer group transition-all select-none ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/20 text-blue-850 font-extrabold ring-2 ring-blue-500/15 shadow-xs'
                      : hasRoster
                        ? 'border-emerald-250 bg-emerald-50/50 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100'
                        : 'border-slate-150 hover:border-slate-350 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono font-bold text-xs">{dayItem.day}</span>

                  <div className="flex items-center justify-between mt-auto">
                    {hasRoster ? (
                      <div className="flex items-center gap-0.5 bg-emerald-100 border border-emerald-200 px-1 py-0.5 rounded text-[10px] font-black text-emerald-800 shrink-0">
                        <Users className="h-3 w-3 text-emerald-600" />
                        <span>{escCount}</span>
                      </div>
                    ) : (
                      <span className="text-[8.5px] text-slate-400 font-medium italic">Livre</span>
                    )}

                    {hasCoordOnDay && (
                      <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-300 shrink-0 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar Icons Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 border-t border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200"></span>
              <span>Com Plantonistas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-300" />
              <span>Coordenador Escaldo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded border-2 border-blue-600 bg-blue-50/20"></span>
              <span>Dia Selecionado</span>
            </div>
          </div>
        </div>

        {/* Right Grid: Selected Day Detail list (4 columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-3xs flex flex-col gap-4 min-h-[460px]">
          
          <div className="border-b border-slate-100 pb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                {selectedDate.split('-').reverse().join('/')}
              </span>
              <span className="text-[10.5px] font-black text-slate-400">Roteiro Diário</span>
            </div>
            <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight">Equipe de Serviço</h3>
            <p className="text-[11px] text-slate-400 leading-normal">Médicos escalados para este dia de referência.</p>
          </div>

          {/* ADDED Configurar Escala Button ABOVE the detailed list as requested */}
          <div>
            {session.perfil === 'administrador' ? (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-750 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="h-4 w-4 text-blue-200" /> Configurar Escala
              </button>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-slate-500 text-center text-xs flex items-center justify-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-amber-550 text-amber-500 shrink-0" />
                <span className="font-medium text-[11px]">Apenas Administradores escalam equipes.</span>
              </div>
            )}
          </div>

          {/* Side panel roster listings */}
          <div className="space-y-4 flex-1">
            
            {/* Coordinators designated list */}
            <div className="space-y-1.5">
              <h4 className="text-[9.5px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-200" />
                Líderes / Coordenadores Técnico do Dia
              </h4>
              <div className="space-y-1">
                {coordinatorsOnSelectedDate.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic bg-amber-50/30 border border-amber-100 p-2.5 rounded-xl">
                    Nenhum coordenador clínico selecionado para esta data ainda.
                  </p>
                ) : (
                  coordinatorsOnSelectedDate.map(doc => (
                    <div key={doc.id} className="p-2.5 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-indigo-950">{doc.nome}</p>
                        <p className="text-[9px] font-mono text-slate-400">CRM {doc.crm}</p>
                      </div>
                      <Crown className="h-4 w-4 text-amber-500 fill-amber-200" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* General Scheduled Anesthetists */}
            <div className="space-y-1.5">
              <h4 className="text-[9.5px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                Médicos Anestesiologistas Escalados ({doctorsOnSelectedDate.length})
              </h4>
              <div className="space-y-1 border border-slate-100 rounded-xl max-h-[220px] overflow-y-auto p-1 bg-slate-50/20">
                {doctorsOnSelectedDate.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <ListTodo className="h-6 w-6 text-slate-350 mx-auto mb-1 opacity-70" />
                    Plantonistas não designados.
                  </div>
                ) : (
                  doctorsOnSelectedDate.map(doc => {
                    const shiftVal = doc.shiftType || '12h';
                    const parts = shiftVal.split(',');
                    const hasExt = parts.includes('extendido');
                    const mainShift = parts.filter(p => p !== 'extendido')[0] || 'none';

                    let regimeStr = 'Integral 12h';
                    if (mainShift === '6h-manha') regimeStr = 'Manhã 6h';
                    if (mainShift === '6h-tarde') regimeStr = 'Tarde 6h';
                    if (mainShift === 'none') regimeStr = 'Apenas Noite';
                    if (hasExt) regimeStr += ' + Noite';

                    return (
                      <div key={doc.id} className="p-2 flex items-center justify-between text-xs hover:bg-white border hover:border-slate-150 border-transparent rounded-lg transition-all">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-800 truncate">{doc.nome}</p>
                          <p className="text-[9px] font-mono text-slate-400">CRM {doc.crm}</p>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                          {regimeStr}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* RENDER MODAL SCALE CONFIGURATION WIDGET IN POP-UP OVERLAY */}
      <ScaleConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        selectedDate={selectedDate}
        doctors={doctors}
        setDoctors={setDoctors}
        session={session}
        dailyPresences={dailyPresences}
        setDailyPresences={setDailyPresences}
        dateCoordinators={dateCoordinators}
        setDateCoordinators={setDateCoordinators}
        handleSimulateCustomCoordinator={handleSimulateCustomCoordinator}
      />

    </div>
  );
}
