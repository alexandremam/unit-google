import React, { useState, useEffect, useMemo } from 'react';
import { Doctor, UserSession, DailyPresence } from '../types';
import {
  Save,
  Award,
  Users,
  Search,
  Crown,
  Shield,
  ShieldCheck,
  Clock3,
  ListTodo,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Repeat
} from 'lucide-react';
import { logSystemEvent } from '../utils';

interface ScaleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  session: UserSession;
  dailyPresences: DailyPresence[];
  setDailyPresences: React.Dispatch<React.SetStateAction<DailyPresence[]>>;
  dateCoordinators: Record<string, string[]>;
  setDateCoordinators: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  handleSimulateCustomCoordinator?: (coordinatorId: string) => void;
}

export default function ScaleConfigModal({
  isOpen,
  onClose,
  selectedDate,
  doctors,
  setDoctors,
  session,
  dailyPresences,
  setDailyPresences,
  dateCoordinators,
  setDateCoordinators,
  handleSimulateCustomCoordinator
}: ScaleConfigModalProps) {
  // Wizard States
  const [activeStep, setActiveStep] = useState<number>(1);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rosterError, setRosterError] = useState('');

  // Temporary States
  const [tempSelectedDoctorIds, setTempSelectedDoctorIds] = useState<string[]>([]);
  const [tempShiftTypes, setTempShiftTypes] = useState<Record<string, string>>({});
  const [tempCoordinatorIds, setTempCoordinatorIds] = useState<string[]>([]);

  // Replication States
  const [showCopyFromDateDiv, setShowCopyFromDateDiv] = useState(false);
  const [copySourceDate, setCopySourceDate] = useState('');
  const [replicateWeekly, setReplicateWeekly] = useState(false);
  const [replicateWeeksCount, setReplicateWeeksCount] = useState<number>(4);
  const [replicateSpecificDates, setReplicateSpecificDates] = useState(false);
  const [specificDestDates, setSpecificDestDates] = useState<string[]>([]);

  // Automatically load the saved state for selectedDate upon initialization
  useEffect(() => {
    if (isOpen) {
      const preExisting = dailyPresences.filter(p => p.date === selectedDate);
      setTempSelectedDoctorIds(preExisting.map(p => p.doctorID));

      const preShifts: Record<string, string> = {};
      preExisting.forEach(p => {
        preShifts[p.doctorID] = p.shiftType;
      });
      setTempShiftTypes(preShifts);

      const coordsForDate = dateCoordinators[selectedDate] || [];
      setTempCoordinatorIds(coordsForDate);

      // Reset wizard flow
      setRosterError('');
      setSaveSuccess(false);
      setActiveStep(1);
      setReplicateWeekly(false);
      setReplicateSpecificDates(false);
      setSpecificDestDates([]);
      setShowCopyFromDateDiv(false);
      setDoctorSearch('');
    }
  }, [isOpen, selectedDate, dailyPresences, dateCoordinators]);

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

  const selectedDoctorsList = useMemo(() => {
    return doctors.filter(d => tempSelectedDoctorIds.includes(d.id));
  }, [doctors, tempSelectedDoctorIds]);

  const coordinatorDoctorsList = useMemo(() => {
    return doctors.filter(d => tempCoordinatorIds.includes(d.id));
  }, [doctors, tempCoordinatorIds]);

  if (!isOpen) return null;

  // Handle toggling check-status of doctor in Step 1
  const handleToggleDoctorSelection = (docId: string) => {
    if (session.perfil !== 'administrador') {
      alert('Apenas Administradores podem atualizar a equipe de plantonistas.');
      return;
    }

    if (tempSelectedDoctorIds.includes(docId)) {
      setTempSelectedDoctorIds(prev => prev.filter(id => id !== docId));
      setTempCoordinatorIds(prev => prev.filter(id => id !== docId));
    } else {
      if (tempSelectedDoctorIds.length >= 22) {
        setRosterError('Limite máximo de 22 plantonistas por plantão diário atingido.');
        return;
      }
      setTempSelectedDoctorIds(prev => [...prev, docId]);
      if (!tempShiftTypes[docId]) {
        setTempShiftTypes(prev => ({ ...prev, [docId]: '12h' }));
      }
      setRosterError('');
    }
  };

  // Process shift change for general doctors
  const handleChangeShiftType = (docId: string, type: string) => {
    setTempShiftTypes(prev => ({
      ...prev,
      [docId]: type
    }));
  };

  // Toggle Coordinator Designation in Step 2 
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

  // Save changes to database (DailyPresence state) inside Step 4
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

    const remainingPres = dailyPresences.filter(p => p.date !== selectedDate);
    let finalizedPres = [...remainingPres, ...updatedPresRecords];

    // 2. Save Daily assigned Coordinators
    let updatedDateCoords = {
      ...dateCoordinators,
      [selectedDate]: tempCoordinatorIds
    };

    // 2.5 Apply replication logic
    const datesToCopy: string[] = [];
    if (replicateWeekly) {
      for (let w = 1; w <= replicateWeeksCount; w++) {
        const parts = selectedDate.split('-');
        const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        targetDate.setDate(targetDate.getDate() + w * 7);
        const targetDateStr = targetDate.toLocaleDateString('en-CA');
        datesToCopy.push(targetDateStr);
      }
    } else if (replicateSpecificDates && specificDestDates.length > 0) {
      datesToCopy.push(...specificDestDates);
    }

    if (datesToCopy.length > 0) {
      datesToCopy.forEach(destDate => {
        finalizedPres = finalizedPres.filter(p => p.date !== destDate);
        tempSelectedDoctorIds.forEach(docId => {
          finalizedPres.push({
            id: `pres-${docId}-${destDate}`,
            date: destDate,
            doctorID: docId,
            shiftType: tempShiftTypes[docId] || '12h'
          });
        });
        updatedDateCoords[destDate] = tempCoordinatorIds;
      });
    }

    setDailyPresences(finalizedPres);
    localStorage.setItem('unita_daily_presences', JSON.stringify(finalizedPres));

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

      setDoctors(prevDocs => {
        const updated = prevDocs.map(d => {
          if (tempSelectedDoctorIds.includes(d.id)) {
            return {
              ...d,
              presente: true,
              disponivelDesde: d.presente && d.disponivelDesde ? d.disponivelDesde : new Date().toISOString()
            };
          } else {
            return {
              ...d,
              presente: false
            };
          }
        });
        localStorage.setItem('unita_doctors', JSON.stringify(updated));
        return updated;
      });
    }

    setSaveSuccess(true);
    setRosterError('');
    
    // Log System Audit Trail event
    const doctorsCount = tempSelectedDoctorIds.length;
    const coordinatorsDetails = doctors
      .filter(d => tempCoordinatorIds.includes(d.id))
      .map(d => d.nome)
      .join(' e ') || 'Nenhum';

    let replicationLogSuffix = '';
    if (datesToCopy.length > 0) {
      replicationLogSuffix = ` Replicado escala para outras ${datesToCopy.length} semanas/datas futuras.`;
    }

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Entrada no plantão',
      `Consolidou roteiro para ${selectedDate.split('-').reverse().join('/')}: ${doctorsCount} médicos escalados. Coordenador(es) designado(s): ${coordinatorsDetails}.${replicationLogSuffix}`
    );

    // Timeout alert success styling to automatically close modal
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 2000);
  };

  const handleSimulateCustomCoordinatorLocal = (docId: string) => {
    if (handleSimulateCustomCoordinator) {
      handleSimulateCustomCoordinator(docId);
      onClose();
    } else {
      alert(`Permissão concedida via simulação para ${doctors.find(d => d.id === docId)?.nome || docId}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 relative max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-fade-in">
        
        {/* Modal Window Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-150">
          <div>
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-150 font-extrabold uppercase px-2 py-0.5 rounded tracking-wider">
              Configurador de Escala de Turnos
            </span>
            <h3 className="text-base font-black text-slate-900 font-display mt-1">
              Roteiro de Plantonistas para {selectedDate.split('-').reverse().join('/')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg font-black text-xs cursor-pointer transition-all"
            aria-label="Fecar"
          >
            ✕
          </button>
        </div>

        {/* Error notification display */}
        {rosterError && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 animate-bounce">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{rosterError}</span>
          </div>
        )}

        {/* Success notification receipt inside modal */}
        {saveSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-extrabold">Roteiro Salvo com Sucesso!</p>
              <p className="font-normal text-[10px] text-emerald-700">Homologado e programado para {selectedDate.split('-').reverse().join('/')}. Fechando ferramenta...</p>
            </div>
          </div>
        )}

        {/* FOUR STEP STEPPER INDICATOR */}
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            
            {/* Step 1 Button */}
            <button
              type="button"
              onClick={() => {
                setRosterError('');
                setActiveStep(1);
              }}
              className={`flex flex-col md:flex-row items-center gap-2 p-2 rounded-lg transition-all text-left border cursor-pointer ${
                activeStep === 1
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                activeStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                1
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none">Equipe</p>
              </div>
            </button>

            {/* Step 2 Button */}
            <button
              type="button"
              onClick={() => {
                if (tempSelectedDoctorIds.length === 0) {
                  setRosterError('Selecione pelo menos um plantonista na Etapa 1 antes de gerenciar a coordenação.');
                  return;
                }
                setRosterError('');
                setActiveStep(2);
              }}
              className={`flex flex-col md:flex-row items-center gap-2 p-2 rounded-lg transition-all text-left border cursor-pointer ${
                activeStep === 2
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                activeStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                2
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none">Coordenação</p>
              </div>
            </button>

            {/* Step 3 Button */}
            <button
              type="button"
              onClick={() => {
                if (tempSelectedDoctorIds.length === 0) {
                  setRosterError('Selecione pelo menos um plantonista na Etapa 1 antes de configurar turnos.');
                  return;
                }
                setRosterError('');
                setActiveStep(3);
              }}
              className={`flex flex-col md:flex-row items-center gap-2 p-2 rounded-lg transition-all text-left border cursor-pointer ${
                activeStep === 3
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                activeStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                3
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none">Regimes/Turnos</p>
              </div>
            </button>

            {/* Step 4 Button */}
            <button
              type="button"
              onClick={() => {
                if (tempSelectedDoctorIds.length === 0) {
                  setRosterError('Selecione os médicos escalados antes de prosseguir.');
                  return;
                }
                setRosterError('');
                setActiveStep(4);
              }}
              className={`flex flex-col md:flex-row items-center gap-2 p-2 rounded-lg transition-all text-left border cursor-pointer ${
                activeStep === 4
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                activeStep === 4 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                4
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none">Revisão/Resumo</p>
              </div>
            </button>

          </div>
        </div>

        {/* STEP CONTROLLER CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border border-slate-100 rounded-xl p-4 bg-slate-50/20">
          
          {/* STEP 1: SELECT DOCTORS */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">Banco de Profissionais</h4>
                  <p className="text-[10px] text-slate-450">Marque para incluir no plantão deste dia.</p>
                </div>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-3 w-3" />
                  </span>
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Pesquisar anestesista..."
                    className="w-full pl-7 pr-3 py-1 border border-slate-250 bg-slate-50 text-xs rounded-lg"
                  />
                </div>

                {/* Copy Scale component inside Step 1 */}
                <div className="border border-blue-150 bg-blue-50/20 rounded-lg p-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowCopyFromDateDiv(!showCopyFromDateDiv)}
                      className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-transparent border-none"
                    >
                      <Repeat className="h-3.5 w-3.5" /> Copiar escala de outro dia
                    </button>
                  </div>
                  {showCopyFromDateDiv && (
                    <div className="space-y-1.5 pt-1.5 animate-fade-in">
                      <input
                        type="date"
                        value={copySourceDate}
                        onChange={(e) => setCopySourceDate(e.target.value)}
                        className="w-full text-[10.5px] px-2 py-1 border border-slate-200 rounded font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!copySourceDate) {
                            alert('Escolha o dia de origem.');
                            return;
                          }
                          const sourcePresences = dailyPresences.filter(p => p.date === copySourceDate);
                          if (sourcePresences.length === 0) {
                            alert('Nenhum plantonista agendado nesta data.');
                            return;
                          }
                          const docIds = sourcePresences.map(p => p.doctorID);
                          const shifts: Record<string, string> = {};
                          sourcePresences.forEach(p => {
                            shifts[p.doctorID] = p.shiftType;
                          });
                          const coords = dateCoordinators[copySourceDate] || [];

                          setTempSelectedDoctorIds(docIds);
                          setTempShiftTypes(shifts);
                          setTempCoordinatorIds(coords);

                          alert(`Carregado com sucesso! ${docIds.length} médicos importados.`);
                          setShowCopyFromDateDiv(false);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold uppercase transition-all cursor-pointer text-[9px]"
                      >
                        Carregar Cópia
                      </button>
                    </div>
                  )}
                </div>

                <div className="border border-slate-150 rounded-lg divide-y divide-slate-100 max-h-[220px] overflow-y-auto bg-slate-50/50 p-1">
                  {filteredDoctors.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 italic">Nenhum médico encontrado.</p>
                  ) : (
                    filteredDoctors.map(doc => {
                      const isSelected = tempSelectedDoctorIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleToggleDoctorSelection(doc.id)}
                          className="flex items-center gap-2.5 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-3 w-3 text-blue-600 rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{doc.nome}</p>
                            <p className="text-[9px] font-mono text-slate-400">CRM {doc.crm}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Step 1 Selected Panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase">Equipe Selecionada ({tempSelectedDoctorIds.length})</h4>
                    <p className="text-[10px] text-slate-450">Estes médicos serão agendados para trabalhar neste turno.</p>
                  </div>

                  {tempSelectedDoctorIds.length === 0 ? (
                    <div className="py-12 border-2 border-dashed border-slate-150 rounded-xl text-center text-slate-400 text-xs">
                      <ListTodo className="h-6 w-6 mx-auto mb-1 text-slate-300" />
                      Escolha profissionais à esquerda para começar.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
                      {selectedDoctorsList.map(doc => (
                        <span
                          key={doc.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-150 text-blue-800 rounded font-bold text-[11px]"
                        >
                          <span>{doc.nome}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleDoctorSelection(doc.id)}
                            className="text-slate-400 hover:text-red-650 cursor-pointer text-xs leading-none bg-transparent"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Máximo: 22 plantonistas por dia</span>
                  <button
                    type="button"
                    disabled={tempSelectedDoctorIds.length === 0}
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded text-xs font-black uppercase flex items-center gap-1 cursor-pointer shadow"
                  >
                    Próximo Passo <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ASSIGN COORDINATORS */}
          {activeStep === 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 animate-fade-in">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase">Supervisores / Coordenadores de Turno</h4>
                <p className="text-[10px] text-slate-450">Designar até 2 da equipe que estarão em regime de chefia diária.</p>
              </div>

              {selectedDoctorsList.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-450">Escolha a equipe primeiro no Passo 1.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedDoctorsList.map(doc => {
                    const isCoord = tempCoordinatorIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleToggleCoordinator(doc.id)}
                        className={`p-3 rounded-xl border cursor-pointer select-none relative transition-all min-h-[100px] flex flex-col justify-between ${
                          isCoord
                            ? 'border-indigo-500 bg-indigo-50/40'
                            : 'border-slate-200 hover:border-slate-350 bg-slate-50'
                        }`}
                      >
                        <div className="absolute top-2.5 right-2.5">
                          {isCoord ? <Crown className="h-4 w-4 text-amber-500 fill-amber-250" /> : <Shield className="h-4 w-4 text-slate-300" />}
                        </div>
                        <div>
                          <p className={`text-xs font-black truncate ${isCoord ? 'text-indigo-900' : 'text-slate-800'}`}>{doc.nome}</p>
                          <p className="text-[9px] font-mono text-slate-400">CRM {doc.crm}</p>
                        </div>
                        {isCoord && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSimulateCustomCoordinatorLocal(doc.id);
                            }}
                            className="mt-2 w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[8px] font-bold uppercase"
                          >
                            Liberar Coordenador
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-3 py-1.5 border hover:bg-slate-50 rounded text-xs text-slate-600 font-bold uppercase flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <span className="text-[10px] text-slate-450">Designados: {tempCoordinatorIds.length} / 2</span>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-black uppercase flex items-center gap-1 cursor-pointer shadow"
                >
                  Continuar <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WORK SHIFT PER DIEMS */}
          {activeStep === 3 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 animate-fade-in">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase">Regimes e Extendido (Noite)</h4>
                <p className="text-[10px] text-slate-450">Ajuste se o turno é integral ou de 6h e habilite regime estendido noturno (19h-24h).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                {selectedDoctorsList.map(doc => {
                  const shiftVal = tempShiftTypes[doc.id] || '12h';
                  const parts = shiftVal.split(',');
                  const hasExt = parts.includes('extendido');
                  const mainVal = parts.filter(p => p !== 'extendido')[0] || 'none';

                  const updateShift = (newPrimary: string, extend: boolean) => {
                    let finalS = '';
                    if (newPrimary !== 'none') finalS = newPrimary;
                    if (extend) finalS = finalS ? `${finalS},extendido` : 'extendido';
                    if (!finalS) finalS = '12h';
                    handleChangeShiftType(doc.id, finalS);
                  };

                  return (
                    <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{doc.nome}</p>
                        <p className="text-[9px] text-slate-400">CRM {doc.crm}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[8px] uppercase text-slate-400 font-extrabold">Regime</label>
                          <select
                            value={mainVal}
                            onChange={(e) => updateShift(e.target.value, hasExt)}
                            className="bg-white border border-slate-200 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-bold focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="12h">Integral 12h</option>
                            <option value="6h-manha">Manhã 6h</option>
                            <option value="6h-tarde">Tarde 6h</option>
                            <option value="none">Apenas Noite</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <label className="text-[8px] uppercase text-slate-400 font-extrabold">Extendido</label>
                          <button
                            type="button"
                            onClick={() => updateShift(mainVal, !hasExt)}
                            className={`text-[9px] px-2 py-0.5 rounded font-extrabold border cursor-pointer ${
                              hasExt ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            {hasExt ? 'Sim' : 'Não'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-3 py-1.5 border hover:bg-slate-50 rounded text-xs text-slate-600 font-bold uppercase flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-black uppercase flex items-center gap-1 cursor-pointer shadow"
                >
                  Resumo Final <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {activeStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">Resumo Planejado</h5>
                <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-slate-50 border rounded-lg">
                  <div>
                    <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Data</span>
                    <span className="font-bold text-slate-700">{selectedDate.split('-').reverse().join('/')}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Total Roteiro</span>
                    <span className="font-bold text-slate-705">{tempSelectedDoctorIds.length} plantonista(s)</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Coordenadores</span>
                    <span className="font-black text-indigo-805">
                      {coordinatorDoctorsList.map(c => c.nome).join(', ') || 'Nenhum'}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-150 rounded-lg max-h-[120px] overflow-y-auto divide-y divide-slate-100 p-1">
                  {selectedDoctorsList.map(doc => {
                    const currentShiftVal = tempShiftTypes[doc.id] || '12h';
                    const parts = currentShiftVal.split(',');
                    const hasExt = parts.includes('extendido');
                    const mainPart = parts.filter(p => p !== 'extendido')[0] || 'none';

                    let regimeStr = '12h Integral';
                    if (mainPart === '6h-manha') regimeStr = '6h Manhã';
                    if (mainPart === '6h-tarde') regimeStr = '6h Tarde';
                    if (mainPart === 'none') regimeStr = 'Período Noite';
                    if (hasExt) regimeStr += ' + Extendido';

                    return (
                      <div key={doc.id} className="p-2 flex items-center justify-between text-[11px]">
                        <p className="font-bold text-slate-700 truncate">{doc.nome}</p>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-black">{regimeStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 4 Replication Side Card */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">Replicação & Períodos</h5>
                  <p className="text-[10px] text-slate-450 leading-tight">Copie esta escala idênticamente para outras datas futuras:</p>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setReplicateWeekly(!replicateWeekly);
                        if (replicateSpecificDates) setReplicateSpecificDates(false);
                      }}
                      className={`py-1.5 px-2.5 rounded border text-center transition-all cursor-pointer ${
                        replicateWeekly ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Semanalmente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplicateSpecificDates(!replicateSpecificDates);
                        if (replicateWeekly) setReplicateWeekly(false);
                      }}
                      className={`py-1.5 px-2.5 rounded border text-center transition-all cursor-pointer ${
                        replicateSpecificDates ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Datas Específicas
                    </button>
                  </div>

                  {replicateWeekly && (
                    <div className="p-2 bg-slate-50 border border-slate-150 rounded text-[10px] space-y-1">
                      <label className="block font-black text-slate-550 uppercase">Tempo de Replicação:</label>
                      <select
                        value={replicateWeeksCount}
                        onChange={(e) => setReplicateWeeksCount(parseInt(e.target.value))}
                        className="w-full text-xs p-1 border rounded bg-white text-slate-800"
                      >
                        <option value="4">4 semanas (1 mês)</option>
                        <option value="8">8 semanas (2 meses)</option>
                        <option value="12">12 semanas (3 meses)</option>
                      </select>
                    </div>
                  )}

                  {replicateSpecificDates && (
                    <div className="p-2 bg-slate-50 border border-slate-150 rounded text-[10px] space-y-1">
                      <input
                        type="date"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !specificDestDates.includes(val)) {
                            setSpecificDestDates(prev => [...prev, val]);
                          }
                        }}
                        className="w-full text-xs p-1 border rounded font-mono"
                      />
                      {specificDestDates.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 max-h-16 overflow-y-auto">
                          {specificDestDates.map(dStr => (
                            <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border text-[9px] text-blue-800 font-mono">
                              {dStr.split('-').reverse().slice(0, 2).join('/')}
                              <button
                                type="button"
                                onClick={() => setSpecificDestDates(prev => prev.filter(x => x !== dStr))}
                                className="text-slate-400 hover:text-red-500 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={handleFinalizeAndConfirmRoster}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-black text-xs uppercase tracking-wider transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="h-4 w-4" /> Gravar Turno Oficial
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="w-full py-1.5 border hover:bg-slate-50 rounded text-slate-600 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" /> Voltar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
