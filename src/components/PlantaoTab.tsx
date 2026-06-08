import React, { useState, useEffect, useMemo } from 'react';
import { Doctor, ShiftConfig, UserSession, DailyPresence } from '../types';
import {
  Clock,
  UserCheck,
  ShieldAlert,
  Save,
  Award,
  Calendar,
  UserPlus,
  Trash2,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Clock3,
  Sun,
  Sunset,
  Search,
  Crown,
  ChevronLeft,
  ChevronRight,
  Shield,
  Filter,
  Check,
  User,
  ListTodo,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { logSystemEvent } from '../utils';
import UnitaLogo from './UnitaLogo';

interface PlantaoTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  session: UserSession;
  setSession?: React.Dispatch<React.SetStateAction<UserSession | null>>;
  dailyPresences: DailyPresence[];
  setDailyPresences: React.Dispatch<React.SetStateAction<DailyPresence[]>>;
}

export default function PlantaoTab({
  doctors,
  setDoctors,
  session,
  setSession,
  dailyPresences,
  setDailyPresences
}: PlantaoTabProps) {
  // 1. Calculate Tomorrow's Date for Preselection as default
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA'); // e.g. "YYYY-MM-DD"
  }, []);

  // 2. Active Wizard Routing State
  const [activeStep, setActiveStep] = useState<number>(1); // Step 1, 2, or 3
  const [selectedDate, setSelectedDate] = useState(tomorrowStr);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rosterError, setRosterError] = useState('');

  // 3. Temporary state structures representing pending scale edits under selectedDate
  const [tempSelectedDoctorIds, setTempSelectedDoctorIds] = useState<string[]>([]);
  const [tempShiftTypes, setTempShiftTypes] = useState<Record<string, '12h' | '6h-manha' | '6h-tarde'>>({});
  const [tempCoordinatorIds, setTempCoordinatorIds] = useState<string[]>([]);

  // 4. Persistence Registry for Daily Coordinators
  const [dateCoordinators, setDateCoordinators] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('unita_date_coordinators') || '{}');
    } catch (e) {
      return {};
    }
  });

  // Calendar month/year navigation state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // Automatically load the saved state for selectedDate upon change
  useEffect(() => {
    // A. Detect existing presences for selectedDate
    const preExisting = dailyPresences.filter(p => p.date === selectedDate);
    setTempSelectedDoctorIds(preExisting.map(p => p.doctorID));

    // Map their respective shift configurations
    const preShifts: Record<string, '12h' | '6h-manha' | '6h-tarde'> = {};
    preExisting.forEach(p => {
      preShifts[p.doctorID] = p.shiftType;
    });
    setTempShiftTypes(preShifts);

    // B. Detect coordinators designated for selectedDate
    const coordsForDate = dateCoordinators[selectedDate] || [];
    setTempCoordinatorIds(coordsForDate);

    // Reset error contexts, success status, and return to Step 1
    setRosterError('');
    setSaveSuccess(false);
    setActiveStep(1);
  }, [selectedDate, dailyPresences, dateCoordinators]);

  // Compute filtered search list inside Doctor Picker
  const filteredDoctors = useMemo(() => {
    const term = doctorSearch.toLowerCase().trim();
    if (!term) return doctors;
    return doctors.filter(
      d =>
        d.nome.toLowerCase().includes(term) ||
        d.crm.toLowerCase().includes(term)
    );
  }, [doctors, doctorSearch]);

  // Handle toggling check-status of doctor in Step 1
  const handleToggleDoctorSelection = (docId: string) => {
    if (session.perfil !== 'administrador') {
      alert('Apenas Administradores podem atualizar a equipe de plantonistas.');
      return;
    }

    if (tempSelectedDoctorIds.includes(docId)) {
      setTempSelectedDoctorIds(prev => prev.filter(id => id !== docId));
      // if this doctor was designated as coordinator, remove them from coordinator list as well
      setTempCoordinatorIds(prev => prev.filter(id => id !== docId));
    } else {
      if (tempSelectedDoctorIds.length >= 22) {
        setRosterError('Limite máximo de 22 plantonistas por plantão diário atingido.');
        return;
      }
      setTempSelectedDoctorIds(prev => [...prev, docId]);
      // set general 12h shifts by default if left unassigned
      if (!tempShiftTypes[docId]) {
        setTempShiftTypes(prev => ({ ...prev, [docId]: '12h' }));
      }
      setRosterError('');
    }
  };

  // Process shift change for general doctors
  const handleChangeShiftType = (docId: string, type: '12h' | '6h-manha' | '6h-tarde') => {
    setTempShiftTypes(prev => ({
      ...prev,
      [docId]: type
    }));
  };

  // Toggle Coordinator Designation in Step 2 (Restricted to selected list in Step 1, max 2)
  const handleToggleCoordinator = (docId: string) => {
    if (session.perfil !== 'administrador') {
      alert('Apenas Administradores podem definir coordenadores.');
      return;
    }

    if (tempCoordinatorIds.includes(docId)) {
      setTempCoordinatorIds(prev => prev.filter(id => id !== docId));
    } else {
      if (tempCoordinatorIds.length >= 2) {
        setRosterError('É permitido configurar no máximo 2 coordenadores em cada plantão.');
        return;
      }
      setTempCoordinatorIds(prev => [...prev, docId]);
      setRosterError('');
    }
  };

  // Save changes to database (DailyPresence state) inside Step 3
  const handleFinalizeAndConfirmRoster = () => {
    if (session.perfil !== 'administrador') {
      alert('Apenas Administradores têm permissão para salvar escalas de plantão.');
      return;
    }

    // 1. Bulk map DailyPresence records for selected date
    const updatedPresRecords = tempSelectedDoctorIds.map(docId => ({
      id: `pres-${docId}-${selectedDate}`,
      date: selectedDate,
      doctorID: docId,
      shiftType: tempShiftTypes[docId] || '12h'
    }));

    // Filter out previous records for this date and push updated batch
    const remainingPres = dailyPresences.filter(p => p.date !== selectedDate);
    const finalizedPres = [...remainingPres, ...updatedPresRecords];

    setDailyPresences(finalizedPres);
    localStorage.setItem('unita_daily_presences', JSON.stringify(finalizedPres));

    // 2. Save Daily assigned Coordinators
    const updatedDateCoords = {
      ...dateCoordinators,
      [selectedDate]: tempCoordinatorIds
    };
    setDateCoordinators(updatedDateCoords);
    localStorage.setItem('unita_date_coordinators', JSON.stringify(updatedDateCoords));

    // 3. Synchronize global today active coordinators if matching currently active date
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (selectedDate === todayStr) {
      try {
        const activeGlobalShift = JSON.parse(
          localStorage.getItem('unita_shift') || '{"coordenadores":["d20"],"inicio":"07:00","fim":"19:00"}'
        );
        activeGlobalShift.coordenadores = tempCoordinatorIds;
        localStorage.setItem('unita_shift', JSON.stringify(activeGlobalShift));
      } catch (e) {
        console.error('Error synchronizing active shift', e);
      }
    }

    setSaveSuccess(true);
    setRosterError('');
    
    // Log System Audit Trail event
    const doctorsCount = tempSelectedDoctorIds.length;
    const coordinatorsDetails = doctors
      .filter(d => tempCoordinatorIds.includes(d.id))
      .map(d => d.nome)
      .join(' e ') || 'Nenhum';

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Entrada no plantão',
      `Consolidou roteiro para ${selectedDate.split('-').reverse().join('/')}: ${doctorsCount} médicos escalados. Coordenador(es) designado(s): ${coordinatorsDetails}.`
    );

    // Timeout alert success styling
    setTimeout(() => {
      setSaveSuccess(false);
    }, 5000);
  };

  // Handle simulations to quickly test Coordinator workspace features
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

  // Revert active simulation back to Administrators
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

  // Calendar Logic Math Calculations
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

  // List doctors matching the selected ids
  const selectedDoctorsList = useMemo(() => {
    return doctors.filter(d => tempSelectedDoctorIds.includes(d.id));
  }, [doctors, tempSelectedDoctorIds]);

  // List of active chosen coordinators
  const coordinatorDoctorsList = useMemo(() => {
    return doctors.filter(d => tempCoordinatorIds.includes(d.id));
  }, [doctors, tempCoordinatorIds]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto" id="plantao-tab-container">
      {/* Simulation Banner Info */}
      {isSimulated && (
        <div className="bg-amber-600/95 backdrop-blur-md text-white rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-bold">Modo Coordenador Simulado Ativo</p>
              <p className="text-xs text-amber-100 font-medium">
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

      {/* Main Title Banner & Date picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
        <div className="flex items-center gap-3">
          <UnitaLogo size={36} className="p-1 rounded-lg bg-slate-50 border border-slate-150 shadow-3xs" />
          <div>
            <h2 className="text-lg font-black text-slate-950 font-display">Roteiro & Escala de Plantonistas</h2>
            <p className="text-xs text-slate-500 font-medium">
              Gestão programada de profissionais ativos, definição de lideranças em 3 etapas integradas.
            </p>
          </div>
        </div>

        {/* Dynamic Date Selector */}
        <div className="flex items-center gap-2 font-sans text-xs">
          <label htmlFor="roster-active-date" className="font-extrabold text-slate-800 uppercase tracking-widest text-[10px]">
            Data de Referência:
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <input
              id="roster-active-date"
              type="date"
              className="pl-8 pr-3 py-1.5 font-bold border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden text-slate-800 bg-slate-50 cursor-pointer shadow-3xs font-mono"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setRosterError('');
                setSaveSuccess(false);
              }}
            />
          </div>
        </div>
      </div>

      {session.perfil !== 'administrador' && !isSimulated && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Acesso restrito ao perfil Administrador:</span> Você está logado no sistema como Coordenador de Turno. Funcionalidades de planejamento de escala futura, cadastro de líderes e simulações só podem ser executadas por Administradores.
          </div>
        </div>
      )}

      {/* THREE STEP STEPPER INDICATOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
        <div className="grid grid-cols-3 gap-2">
          {/* Step 1 indicator */}
          <button
            onClick={() => {
              setRosterError('');
              setActiveStep(1);
            }}
            className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all text-left ${
              activeStep === 1
                ? 'bg-blue-50/50 border border-blue-200'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              activeStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-150 text-slate-600'
            }`}>
              1
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">Escolher Plantonistas</p>
              <p className="hidden md:block text-[10px] text-slate-500 font-medium truncate">Selecionar equipe (máx. 22)</p>
            </div>
          </button>

          {/* Step 2 indicator */}
          <button
            onClick={() => {
              if (tempSelectedDoctorIds.length === 0) {
                setRosterError('Selecione pelo menos um plantonista na Etapa 1 antes de gerenciar a coordenação.');
                return;
              }
              setRosterError('');
              setActiveStep(2);
            }}
            className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all text-left ${
              activeStep === 2
                ? 'bg-blue-50/50 border border-blue-200'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              activeStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-150 text-slate-600'
            }`}>
              2
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 tracking-tight leading-tight font-display">Definir Coordenação</p>
              <p className="hidden md:block text-[10px] text-slate-500 font-medium truncate">Indicar líderes do dia (até 2)</p>
            </div>
          </button>

          {/* Step 3 indicator */}
          <button
            onClick={() => {
              if (tempSelectedDoctorIds.length === 0) {
                setRosterError('Selecione os médicos escalados na Etapa 1 antes de validar o plantão.');
                return;
              }
              setRosterError('');
              setActiveStep(3);
            }}
            className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all text-left ${
              activeStep === 3
                ? 'bg-blue-50/50 border border-blue-200'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              activeStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-150 text-slate-600'
            }`}>
              3
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">Revisar & Registrar</p>
              <p className="hidden md:block text-[10px] text-slate-500 font-medium truncate">Auditoria automática e envio</p>
            </div>
          </button>
        </div>

        {rosterError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-bounce">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{rosterError}</span>
          </div>
        )}
      </div>

      {/* ACTIVE STEP WORKSPACE WIDGETS */}
      <div className="transition-all duration-300">
        
        {/* ================= STEP 1: SELECT DOCTORS AND TARGET SHIFTS ================= */}
        {activeStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Search CheckBox List (Left Panel - 5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest flex justify-between items-center">
                  <span>Banco de Anestesiologistas</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                    tempSelectedDoctorIds.length > 20 ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {tempSelectedDoctorIds.length} / 22 Máx
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Marque as caixas para cadastrar a presença oficial do anestesista no plantão.
                </p>
              </div>

              {/* Dynamic search input */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 text-slate-800"
                  placeholder="Pesquisar por nome ou CRM..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                />
              </div>

              {/* Fast Selector Scroll */}
              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1 bg-slate-50/40">
                {filteredDoctors.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 italic">
                    Nenhum anestesista correspondente encontrado.
                  </p>
                ) : (
                  filteredDoctors.map(doc => {
                    const isSelected = tempSelectedDoctorIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleToggleDoctorSelection(doc.id)}
                        className={`flex items-center gap-3 p-2.5 hover:bg-slate-50 transition-colors select-none ${
                          session.perfil === 'administrador' ? 'cursor-pointer' : 'cursor-default opacity-80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`check-doctor-picker-${doc.id}`}
                          checked={isSelected}
                          disabled={session.perfil !== 'administrador'}
                          readOnly
                          className="h-3.5 w-3.5 text-blue-600 border-slate-300 rounded-sm focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                            {doc.nome}
                          </p>
                          <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono mt-0.5">
                            <span>CRM {doc.crm}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Shift Assignment List (Right Panel - 7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest flex items-center justify-between">
                    <span>Configuração de Períodos de Plantão</span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      Data: {selectedDate.split('-').reverse().join('/')}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight mt-1">
                    Defina o período de permanência de cada médico presente (12h, 6h Manhã ou Tarde).
                  </p>
                </div>

                {selectedDoctorsList.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <ListTodo className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    Nenhum anestesista selecionado para este plantão ainda.
                    <br />
                    <span className="text-[10px] text-slate-400 font-normal">Selecione profissionais no painel esquerdo para começar.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedDoctorsList.map(doc => {
                      const activeShiftType = tempShiftTypes[doc.id] || '12h';
                      return (
                        <div
                          key={doc.id}
                          className="p-3 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-800 truncate">{doc.nome}</p>
                            <p className="text-[9px] font-mono text-slate-500 mt-0.5">CRM {doc.crm}</p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <select
                              disabled={session.perfil !== 'administrador'}
                              value={activeShiftType}
                              onChange={(e) => handleChangeShiftType(doc.id, e.target.value as any)}
                              className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-250 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                            >
                              <option value="12h">Integral (12h)</option>
                              <option value="6h-manha">Manhã (6h - 07h às 13h)</option>
                              <option value="6h-tarde">Tarde (6h - 13h às 19h)</option>
                            </select>

                            {session.perfil === 'administrador' && (
                              <button
                                onClick={() => handleToggleDoctorSelection(doc.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-sm hover:bg-rose-50 transition-colors"
                                title="Desmarcar Presença"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step Navigation Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <span className="text-[10px] text-slate-500 font-medium">
                  {tempSelectedDoctorIds.length} médico(s) presente(s) no Roteiro.
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (tempSelectedDoctorIds.length === 0) {
                      setRosterError('Selecione pelo menos um profissional no painel antes de avançar.');
                      return;
                    }
                    setRosterError('');
                    setActiveStep(2);
                  }}
                  disabled={tempSelectedDoctorIds.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black uppercase transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  Etapa 2: Definir Coordenadores <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: SELECT UP TO 2 COORDINATORS ================= */}
        {activeStep === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                  Designação de Coordenadores do Turno
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Selecione até 2 profissionais pré-selecionados na Etapa Anterior para assumirem a liderança do expediente clínico.
                </p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-black self-start sm:self-center ${
                tempCoordinatorIds.length === 2 ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'
              }`}>
                Coordenadores: {tempCoordinatorIds.length} / 2 designados
              </span>
            </div>

            {selectedDoctorsList.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400 italic">
                Nenhum médico escalado. Por favor, volte para a Etapa 1.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedDoctorsList.map(doc => {
                  const isCoord = tempCoordinatorIds.includes(doc.id);
                  const shiftText = tempShiftTypes[doc.id] === '12h' ? 'Integral 12h' : tempShiftTypes[doc.id] === '6h-manha' ? 'Manhã 6h' : 'Tarde 6h';
                  
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleToggleCoordinator(doc.id)}
                      className={`p-4 rounded-2xl border transition-all select-none cursor-pointer flex flex-col justify-between min-h-[120px] relative ${
                        isCoord
                          ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/10 shadow-3xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      {/* Check Crown Indicator */}
                      <div className="absolute top-3 right-3">
                        {isCoord ? (
                          <div className="text-amber-500 bg-amber-50 border border-amber-200 p-1 rounded-full shadow-3xs">
                            <Crown className="h-4 w-4 fill-amber-300" />
                          </div>
                        ) : (
                          <div className="text-slate-300 bg-white border border-slate-200 p-1 rounded-full hover:text-slate-500">
                            <Shield className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 max-w-[85%]">
                        <p className={`text-xs font-black truncate ${isCoord ? 'text-indigo-950 font-black' : 'text-slate-800'}`}>
                          {doc.nome}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500">CRM {doc.crm}</p>
                        <span className="inline-block text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-sm">
                          Regime: {shiftText}
                        </span>
                      </div>

                      {/* Simulation switch inside the card when active */}
                      {isCoord && (
                        <div className="mt-3 pt-2.5 border-t border-indigo-100/50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid untoggling coordinator status
                              handleSimulateCustomCoordinator(doc.id);
                            }}
                            className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[9px] font-black uppercase tracking-wider transition-all shadow-3xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Liberar Coordenador
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Navigation Buttons Step 2 */}
            <div className="pt-4 border-t border-slate-150 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setRosterError('');
                  setActiveStep(1);
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-black text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Plantonistas
              </button>

              <button
                type="button"
                onClick={() => {
                  setRosterError('');
                  setActiveStep(3);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                Etapa 3: Revisar & Confirmar <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: AUDIT PROTOCOL AND CONCLUDE WRITE ================= */}
        {activeStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Summary Review (Left Column) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest">
                  Resumo Executivo da Escala Planejada
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Confira as informações estruturadas da data antes de efetivar e homologar no banco de dados.
                </p>
              </div>

              {/* Hero Statistics info */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Data Oficial</span>
                  <span className="text-xs font-black text-slate-800 font-mono">
                    {selectedDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="text-center border-x border-slate-150">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Total Escala</span>
                  <span className="text-xs font-black text-slate-800">
                    {tempSelectedDoctorIds.length} médico(s)
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Coordenadores</span>
                  <span className="text-xs font-black text-slate-800 text-indigo-700">
                    {tempCoordinatorIds.length} ativo(s)
                  </span>
                </div>
              </div>

              {/* Relação de Coordenadores */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Coordenadores Clínicos Designados (Até 2)
                </span>

                {coordinatorDoctorsList.length === 0 ? (
                  <div className="p-3 bg-amber-50/50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Nenhum coordenador clínico selecionado. Recomenda-se designar pelo menos 1 na Etapa 2.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {coordinatorDoctorsList.map(doc => (
                      <div key={doc.id} className="p-3 bg-indigo-50/30 border border-indigo-150 rounded-xl flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-indigo-950 truncate">{doc.nome}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">CRM {doc.crm}</p>
                        </div>
                        <div className="text-indigo-600 shrink-0">
                          <Crown className="h-4.5 w-4.5 text-amber-500 fill-amber-300 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Roster Details Grid */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Relação de Anestesistas e Regimes
                </span>

                <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[170px] overflow-y-auto pr-1 bg-slate-50/30">
                  {selectedDoctorsList.map(doc => {
                    const regimeStr = tempShiftTypes[doc.id] === '12h' ? 'Integral 12h' : tempShiftTypes[doc.id] === '6h-manha' ? 'Período Manhã (6h)' : 'Período Tarde (6h)';
                    const isAlsoCoord = tempCoordinatorIds.includes(doc.id);
                    return (
                      <div key={doc.id} className="p-2 flex items-center justify-between gap-3 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate flex items-center gap-1">
                            {doc.nome}
                            {isAlsoCoord && <Crown className="h-3 w-3 text-amber-500 fill-amber-300 shrink-0" />}
                          </p>
                          <p className="text-[9px] font-mono text-slate-500">CRM {doc.crm}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                          tempShiftTypes[doc.id] === '12h' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {regimeStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Validation & Confirm button (Right Column) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest">
                    Validação Automática de Postos
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    O sistema de governança clínica executa a conferência imediata de parâmetros:
                  </p>
                </div>

                {/* Checklist checks */}
                <div className="space-y-3 text-xs font-medium">
                  {/* Cap check */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {tempSelectedDoctorIds.length > 0 && tempSelectedDoctorIds.length <= 22 ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 leading-tight">Limite de Capacidade Máxima</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {tempSelectedDoctorIds.length} selecionados (o teto operacional rígido é 22 por dia).
                      </p>
                    </div>
                  </div>

                  {/* Date check */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 leading-tight">Data do Turno Programado</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Dia: {selectedDate.split('-').reverse().join('/')} (futuro ou corrente de prontidão).
                      </p>
                    </div>
                  </div>

                  {/* Coordinator presence check */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {tempCoordinatorIds.length > 0 ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 leading-tight">Liderança do Plantão</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {tempCoordinatorIds.length === 0
                          ? 'Alerta: Escala sem coordenador ativo pode dificultar a aprovação rápida de novos procedimentos.'
                          : `${tempCoordinatorIds.length} Coordenador(es) apto(s) para plantão.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm submit actions */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                {session.perfil === 'administrador' ? (
                  <button
                    type="button"
                    onClick={handleFinalizeAndConfirmRoster}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]"
                  >
                    <Save className="h-4.5 w-4.5" /> Confirmar e Registrar Plantão
                  </button>
                ) : (
                  <p className="p-3 bg-slate-50 text-slate-500 text-center text-[10px] italic rounded-lg">
                    Apenas administradores podem gravar dados no sistema.
                  </p>
                )}

                {saveSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 animate-bounce">
                    <Sparkles className="h-4.5 w-4.5 text-emerald-600 animate-pulse" />
                    ✓ Plantão salvo, validado e integrado com sucesso!
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setRosterError('');
                    setActiveStep(2);
                  }}
                  className="w-full py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Ajustar Coordenadores
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* COMPACT CHECKLIST MONTHLY CALENDAR GRID BELOW (Admin only checklist visual preview) */}
      {session.perfil === 'administrador' && (
        <section className="bg-white rounded-xl border border-slate-250 p-4 shadow-3xs max-w-sm mx-auto space-y-3" id="compact-calendar-reference">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black text-slate-900 font-display flex items-center gap-1.5 uppercase tracking-tight">
                <Calendar className="h-4 w-4 text-blue-600" />
                Mapa de Roteiros Confirmados
              </h3>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                Consulte ou modifique o planejamento de escalas do mês.
              </p>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-black text-slate-800 font-display min-w-[85px] text-center">
                {monthLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider py-1 bg-slate-50/50 rounded-lg">
            <div>D</div>
            <div>S</div>
            <div>T</div>
            <div>Q</div>
            <div>Q</div>
            <div>S</div>
            <div>S</div>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 justify-items-center">
            {calendarDays.map((dayItem, index) => {
              if (!dayItem) {
                return <div key={`empty-${index}`} className="w-8 h-8 bg-transparent"></div>;
              }

              const isCurrent = dayItem.dateString === selectedDate;
              const escCount = dailyPresences.filter(p => p.date === dayItem.dateString).length;
              const hasRoster = escCount > 0;

              // Check if coordinator is complete
              const coordsOnDay = dateCoordinators[dayItem.dateString] || [];
              const hasCoordOnDay = coordsOnDay.length > 0;
              const coordDocName = hasCoordOnDay ? doctors.find(d => d.id === coordsOnDay[0])?.nome : null;

              return (
                <div
                  key={`day-${dayItem.day}`}
                  onClick={() => {
                    setSelectedDate(dayItem.dateString);
                    setActiveStep(1);
                  }}
                  className={`w-8 h-8 rounded-lg border flex flex-col items-center justify-center relative cursor-pointer group transition-all text-xs ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/30 text-blue-700 font-black ring-1 ring-blue-500/20'
                      : hasRoster
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100 font-black'
                        : 'border-slate-150 hover:border-slate-300 text-slate-650 hover:bg-slate-50'
                  }`}
                  title={`${dayItem.day} de ${monthLabel}: ${escCount} plantonista(s) escalado(s) ${hasCoordOnDay ? `(Coordenador: ${coordDocName})` : ''}`}
                >
                  <span className="font-mono text-[10px]">{dayItem.day}</span>

                  {/* Indicator labels */}
                  <div className="absolute bottom-0.5 flex gap-0.5 justify-center items-center">
                    {hasRoster && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    )}
                    {hasCoordOnDay && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compact Legend for the admin */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100 text-[8px] font-black text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Com Escala</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span>Coordenador</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>Selecionado</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
