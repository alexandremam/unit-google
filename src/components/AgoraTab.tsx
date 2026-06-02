import React, { useState, useMemo, useEffect } from 'react';
import { Doctor, SectorRoom, Escalation, UserSession } from '../types';
import {
  Users,
  CheckCircle,
  Clock,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  FileText,
  Bookmark,
  Activity,
  Calendar,
  X,
  MapPin,
  Check,
  Search,
  Timer
} from 'lucide-react';
import {
  getDoctorsStatuses,
  getRoomOccupancy,
  checkOverlap,
  logSystemEvent,
  formatDurationPure
} from '../utils';
import { HOSPITAL_ROOMS } from '../data';

interface AgoraTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  escalations: Escalation[];
  setEscalations: React.Dispatch<React.SetStateAction<Escalation[]>>;
  session: UserSession;
}

export default function AgoraTab({
  doctors,
  setDoctors,
  escalations,
  setEscalations,
  session
}: AgoraTabProps) {
  // Navigation filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  // Modals for click cards
  const [activeCardModal, setActiveCardModal] = useState<'none' | 'present' | 'available' | 'escalated'>('none');

  // Allocation/Escalação state
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(HOSPITAL_ROOMS[0]?.id || '');
  const [ticketNum, setTicketNum] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [customHours, setCustomHours] = useState<string>('');
  const [numAtos, setNumAtos] = useState(1);
  const [escalationDate, setEscalationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [overlapError, setOverlapError] = useState('');

  // Editing state
  const [editingEscalation, setEditingEscalation] = useState<Escalation | null>(null);
  const [editJustification, setEditJustification] = useState('');
  const [editRequestHours, setEditRequestHours] = useState('');

  // Deletion state
  const [deletingEscalation, setDeletingEscalation] = useState<Escalation | null>(null);
  const [deleteJustification, setDeleteJustification] = useState('');

  // Real-time room click finalization popup
  const [roomToFinalize, setRoomToFinalize] = useState<Escalation | null>(null);

  // Pop-up doctor addition states
  const [showAddDoctorForm, setShowAddDoctorForm] = useState(false);
  const [addMethod, setAddMethod] = useState<'select' | 'new'>('select');
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [newDocNome, setNewDocNome] = useState('');
  const [newDocCrm, setNewDocCrm] = useState('');
  const [newDocCelular, setNewDocCelular] = useState('');
  const [newDocAfinidade, setNewDocAfinidade] = useState('');
  const [addErrorMsg, setAddErrorMsg] = useState('');

  // Force re-renders for live counters and clock
  const [, setTick] = useState(0);
  const [timeString, setTimeString] = useState(() => new Date().toLocaleTimeString('pt-BR'));
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      setTimeString(new Date().toLocaleTimeString('pt-BR'));
    }, 1000); // refresh every second
    return () => clearInterval(timer);
  }, []);

  // Compute stats
  const { present, available, escalated } = useMemo(() => {
    return getDoctorsStatuses(doctors, escalations);
  }, [doctors, escalations]);

  // Sync Room selection changes to default credit hours
  const activeRoom = useMemo(() => {
    return HOSPITAL_ROOMS.find(r => r.id === selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    if (activeRoom) {
      if (activeRoom.especial) {
        setCustomHours('6'); // Default 6 hours credit for special sectors
      } else {
        setCustomHours(''); // Calculated from timings
      }
    }
  }, [activeRoom]);

  // Clean form when modal closes/opens
  const openNewEscalation = (docId: string, roomId?: string) => {
    setSelectedDoctorId(docId);
    if (roomId) {
      setSelectedRoomId(roomId);
    } else {
      setSelectedRoomId(HOSPITAL_ROOMS[0].id);
    }
    setTicketNum('');
    
    // Set default entry time to current hours and minutes
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setEntryTime(`${hh}:${mm}`);
    setExitTime('');
    setEscalationDate(now.toISOString().split('T')[0]);
    setOverlapError('');
    setIsEscalateModalOpen(true);
  };

  // Submit Escalation
  const handleSaveEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    setOverlapError('');

    const doc = doctors.find(d => d.id === selectedDoctorId);
    if (!doc) {
      setOverlapError('Por favor, selecione um anestesista válido.');
      return;
    }

    const room = HOSPITAL_ROOMS.find(r => r.id === selectedRoomId);
    if (!room) {
      setOverlapError('Por favor, selecione uma sala válida.');
      return;
    }

    // Convert operational entry HH:mm to full ISO for today
    const [entH, entM] = entryTime.split(':').map(Number);
    const entDate = new Date();
    entDate.setHours(entH, entM, 0, 0);

    let parsedSaidaISO: string | undefined = undefined;
    if (exitTime) {
      const [exH, exM] = exitTime.split(':').map(Number);
      const exDate = new Date();
      exDate.setHours(exH, exM, 0, 0);
      parsedSaidaISO = exDate.toISOString();
    }

    // Check overlap for the doctor
    const overlapDetected = checkOverlap(
      selectedDoctorId,
      entDate.toISOString(),
      parsedSaidaISO,
      escalations
    );

    if (overlapDetected) {
      setOverlapError(`O(A) ${doc.nome} já possui outra tarefa escalada ativa ou concluída que se sobrepõe a este horário.`);
      return;
    }

    // Create escalation object
    const newEsc: Escalation = {
      id: `esc-${Date.now()}`,
      doctorID: selectedDoctorId,
      doctorName: doc.nome,
      roomId: selectedRoomId,
      setorNome: room.setor,
      salaNome: room.sala,
      atendimento: ticketNum.trim(),
      data: escalationDate,
      entrada: entDate.toISOString(),
      saida: parsedSaidaISO,
      horasManual: customHours ? parseFloat(customHours) : undefined,
      atosRealizados: numAtos,
      ativa: !parsedSaidaISO // active if no end time
    };

    const updatedEscalations = [...escalations, newEsc];
    setEscalations(updatedEscalations);
    localStorage.setItem('unita_escalations', JSON.stringify(updatedEscalations));

    // Audit action
    logSystemEvent(
      session.usuario,
      session.perfil,
      'Nova escala',
      `Agendou escala para ${doc.nome} em ${room.setor} - ${room.sala}. Atendimento: ${newEsc.atendimento || 'Sem ID'}.`,
    );

    // Also update doctor's available state if active (they are now Escalado)
    setIsEscalateModalOpen(false);
  };

  // Finalize (Check out) scale manually
  const handleFinalizeEscalation = (escId: string) => {
    const now = new Date();
    const updated = escalations.map(e => {
      if (e.id === escId) {
        // Calculate default hours if no manual credit
        let cred = e.horasManual;
        if (!cred) {
          const entry = new Date(e.entrada);
          const diffMs = now.getTime() - entry.getTime();
          const hoursFraction = Math.max(0.1, parseFloat((diffMs / (3600000)).toFixed(1)));
          cred = hoursFraction;
        }

        return {
          ...e,
          saida: now.toISOString(),
          horasManual: e.horasManual || cred, // preserve if manual else calculate
          ativa: false
        };
      }
      return e;
    });

    setEscalations(updated);
    localStorage.setItem('unita_escalations', JSON.stringify(updated));

    // Also, must reset doctor's availableSince time so they start waiting from now!
    const targetEsc = escalations.find(e => e.id === escId)!;
    const updatedDocs = doctors.map(d => {
      if (d.id === targetEsc.doctorID) {
        return {
          ...d,
          disponivelDesde: now.toISOString()
        };
      }
      return d;
    });
    setDoctors(updatedDocs);
    localStorage.setItem('unita_doctors', JSON.stringify(updatedDocs));

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Finalização',
      `Finalizou escala do Dr(a). ${targetEsc.doctorName} no setor ${targetEsc.setorNome} ${targetEsc.salaNome}.`
    );
  };

  // Remove a doctor from daily plantão (duty list) and finalize any active escalation
  const handleRemoveDoctorFromShift = (doctorId: string) => {
    const now = new Date();
    
    // 1. Finalize any active escalation
    const activeEsc = escalations.find(e => e.ativa && e.doctorID === doctorId);
    let updatedEscalations = [...escalations];
    
    if (activeEsc) {
      updatedEscalations = escalations.map(e => {
        if (e.id === activeEsc.id) {
          let cred = e.horasManual;
          if (!cred) {
            const entry = new Date(e.entrada);
            const diffMs = now.getTime() - entry.getTime();
            const hoursFraction = Math.max(0.1, parseFloat((diffMs / 3600000).toFixed(1)));
            cred = hoursFraction;
          }
          return {
            ...e,
            saida: now.toISOString(),
            horasManual: e.horasManual || cred,
            ativa: false
          };
        }
        return e;
      });
      setEscalations(updatedEscalations);
      localStorage.setItem('unita_escalations', JSON.stringify(updatedEscalations));
    }

    // 2. Set doctor as not present
    const doc = doctors.find(d => d.id === doctorId);
    const updatedDocs = doctors.map(d => {
      if (d.id === doctorId) {
        return {
          ...d,
          presente: false
        };
      }
      return d;
    });
    setDoctors(updatedDocs);
    localStorage.setItem('unita_doctors', JSON.stringify(updatedDocs));

    // Log audit
    if (doc) {
      logSystemEvent(
        session.usuario,
        session.perfil,
        'Saída do plantão',
        `Removeu Dr(a). ${doc.nome} do plantão do dia.`
      );
    }
  };

  // Promote a registered but not present doctor to the shift
  const handleAddExistingDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    setAddErrorMsg('');
    if (!selectedExistingId) {
      setAddErrorMsg('Selecione um médico do cadastro.');
      return;
    }
    const updatedDocs = doctors.map(d => {
      if (d.id === selectedExistingId) {
        return {
          ...d,
          presente: true,
          disponivelDesde: new Date().toISOString()
        };
      }
      return d;
    });
    setDoctors(updatedDocs);
    localStorage.setItem('unita_doctors', JSON.stringify(updatedDocs));

    const addedDoc = doctors.find(d => d.id === selectedExistingId);
    if (addedDoc) {
      logSystemEvent(
        session.usuario,
        session.perfil,
        'Entrada no plantão',
        `Adicionou Dr(a). ${addedDoc.nome} ao plantão do dia.`
      );
    }

    setSelectedExistingId('');
    setShowAddDoctorForm(false);
  };

  // Register a completely new doctor and put them on shift directly
  const handleAddNewDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    setAddErrorMsg('');
    if (!newDocNome.trim() || !newDocCrm.trim() || !newDocCelular.trim()) {
      setAddErrorMsg('Por favor, preencha os campos obrigatórios.');
      return;
    }

    const existingCrmComp = newDocCrm.trim().toUpperCase();
    if (doctors.some(d => d.crm.toUpperCase() === existingCrmComp)) {
      setAddErrorMsg('Já existe um anestesista cadastrado com este CRM.');
      return;
    }

    const uniqueId = `d-${Date.now()}`;
    const newDoc: Doctor = {
      id: uniqueId,
      nome: newDocNome.trim(),
      crm: existingCrmComp,
      celular: newDocCelular.trim(),
      afinidade: newDocAfinidade.trim() || 'Anestesiologia Geral',
      presente: true,
      disponivelDesde: new Date().toISOString()
    };

    const updatedDoctors = [...doctors, newDoc];
    setDoctors(updatedDoctors);
    localStorage.setItem('unita_doctors', JSON.stringify(updatedDoctors));

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Cadastro de plantonista',
      `Cadastrou e adicionou Dr(a). ${newDoc.nome} (${newDoc.crm}) ao plantão do dia.`
    );

    setNewDocNome('');
    setNewDocCrm('');
    setNewDocCelular('');
    setNewDocAfinidade('');
    setShowAddDoctorForm(false);
  };

  // Trigger Edit modal
  const openEditModal = (esc: Escalation) => {
    setEditingEscalation(esc);
    setEditJustification('');
    setEditRequestHours(esc.horasManual ? String(esc.horasManual) : '');
  };

  const handleUpdateEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEscalation) return;

    if (!editJustification.trim()) {
      alert('Por favor, informe a justificativa obrigatória para edição.');
      return;
    }

    const updated = escalations.map(esc => {
      if (esc.id === editingEscalation.id) {
        // Find if timings changed or if hours custom
        return {
          ...esc,
          atendimento: editingEscalation.atendimento,
          horasManual: editRequestHours ? parseFloat(editRequestHours) : undefined,
          atosRealizados: editingEscalation.atosRealizados,
          justificativaEdicao: editJustification
        };
      }
      return esc;
    });

    setEscalations(updated);
    localStorage.setItem('unita_escalations', JSON.stringify(updated));

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Edição de escala',
      `Editou escala de ${editingEscalation.doctorName} no setor ${editingEscalation.setorNome}.`,
      editJustification
    );

    setEditingEscalation(null);
  };

  // Trigger deletion
  const openDeleteModal = (esc: Escalation) => {
    setDeletingEscalation(esc);
    setDeleteJustification('');
  };

  const handleDeleteEscalationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingEscalation) return;

    if (!deleteJustification.trim()) {
      alert('Justificativa de exclusão é obrigatória.');
      return;
    }

    const filtered = escalations.filter(esc => esc.id !== deletingEscalation.id);
    setEscalations(filtered);
    localStorage.setItem('unita_escalations', JSON.stringify(filtered));

    // Restore doctor availability if it was active
    if (deletingEscalation.ativa) {
      const updatedDocs = doctors.map(d => {
        if (d.id === deletingEscalation.doctorID) {
          return { ...d, disponivelDesde: new Date().toISOString() };
        }
        return d;
      });
      setDoctors(updatedDocs);
      localStorage.setItem('unita_doctors', JSON.stringify(updatedDocs));
    }

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Exclusão de escala',
      `Excluiu escala ID ${deletingEscalation.id} de ${deletingEscalation.doctorName} no setor ${deletingEscalation.setorNome}.`,
      deleteJustification
    );

    setDeletingEscalation(null);
  };

  // Sector groups definition for real-time occupancy feed
  const sectorGroups = [
    { title: 'Centro cirúrgico', key: 'Centro cirúrgico' },
    { title: 'Centro obstétrico', key: 'Centro obstétrico' },
    { title: 'Delivery', key: 'Delivery' },
    { title: 'Day clinic', key: 'Day clinic' },
    { title: 'Endoscopia', key: 'Endoscopia' },
    { title: 'Hemodinâmica', key: 'Hemodinâmica' },
    { title: 'SADT', key: 'SADT' },
    { title: 'Avaliação Pré-anestésica/RPA', key: 'Avaliação Pré-anestésica/RPA' }
  ];

  // Filters for rooms and queues
  const filteredRooms = useMemo(() => {
    return HOSPITAL_ROOMS.filter(r => {
      const matchSearch = r.setor.toLowerCase().includes(searchTerm.toLowerCase()) || r.sala.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSector = sectorFilter === '' || r.setor === sectorFilter;
      return matchSearch && matchSector;
    });
  }, [searchTerm, sectorFilter]);

  // Compute Timeline schedule logs for the day (07:00 to 19:00, 12 hours total)
  const timelineHours = Array.from({ length: 13 }, (_, i) => 7 + i); // 7 to 19

  const totalVagasLivres = useMemo(() => {
    const activeRoomIds = escalations.filter(e => e.ativa).map(e => e.roomId);
    return HOSPITAL_ROOMS.filter(r => !activeRoomIds.includes(r.id)).length;
  }, [escalations]);

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. SMALL CLICKABLE RESUME CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="resume-cards-section">
        {/* Presente / No Plantão Card */}
        <div
          id="card-present"
          onClick={() => setActiveCardModal('present')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-blue-50 hover:shadow-xs transition-colors group"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 transition-transform group-hover:scale-105 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">No Plantão</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-800 font-display">{present.length}</span>
              <span className="text-xs text-slate-400 font-semibold font-sans">médicos</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 w-fit">
              {totalVagasLivres} vagas livres
            </div>
          </div>
        </div>

        {/* Disponíveis Card */}
        <div
          id="card-available"
          onClick={() => setActiveCardModal('available')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-green-50 hover:shadow-xs transition-colors group relative"
        >
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 transition-transform group-hover:scale-105 shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div className="w-full">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Disponíveis</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-800 font-display">{available.length}</span>
              <span className="text-[10px] text-slate-400 font-semibold font-sans">aptos</span>
            </div>
            {available.some(a => a.isIdle) ? (
              <div className="mt-1 text-[10px] text-amber-600 font-mono font-bold flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100 w-fit">
                <AlertTriangle className="h-2.5 w-2.5" /> {available.filter(a => a.isIdle).length} ociosos
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-green-600 font-bold flex items-center gap-1">
                Ver status &rarr;
              </div>
            )}
          </div>
        </div>

        {/* Escalados Card */}
        <div
          id="card-escalated"
          onClick={() => setActiveCardModal('escalated')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-orange-50 hover:shadow-xs transition-colors group"
        >
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 transition-transform group-hover:scale-105 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Escalados</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-800 font-display">{escalated.length}</span>
              <span className="text-[10px] text-slate-400 font-semibold font-sans">em sala</span>
            </div>
            <div className="mt-1 text-[10px] text-orange-600 font-bold flex items-center gap-1">
              Ver setores &rarr;
            </div>
          </div>
        </div>

        {/* Realtime Hour Hand (Clock Card) */}
        <div className="bg-slate-800 rounded-xl p-4 flex flex-col justify-center text-white shadow-sm border border-slate-700">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Horário Atual</p>
          <p className="text-2xl font-mono font-black mt-1.5 text-slate-100 tracking-wider">
            {timeString}
          </p>
        </div>
      </section>

      {/* 2. REALTIME OCCUPATION DISPLAY & LIST */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" id="real-time-display-section">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-md font-bold text-slate-800 font-display flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Display de Ocupação em Tempo Real
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Indicador compacto por setor hospitalar diurno</p>
          </div>
          
          <div className="flex items-center gap-2 no-print">
            <select
              id="sector-filter"
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-3xs"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              <option value="">Filtrar todos setores</option>
              {Array.from(new Set(HOSPITAL_ROOMS.map(r => r.setor))).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {session.perfil === 'administrador' && (
              <button
                onClick={() => openNewEscalation('')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm uppercase tracking-wider"
              >
                <Plus className="h-3.5 w-3.5" /> Nova Escalação
              </button>
            )}
          </div>
        </div>

        {/* Grid display grouped by sector exactly as requested */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sectorGroups.map(grp => {
            // Find rooms belonging to this sector
            const roomsInGrp = filteredRooms.filter(r => r.setor === grp.key);
            if (roomsInGrp.length === 0) return null;

            return (
              <div key={grp.key} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-150 pb-2 uppercase font-display tracking-wider flex items-center justify-between">
                    <span>{grp.title}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                      {roomsInGrp.length}
                    </span>
                  </h4>

                  <ul className="mt-3 space-y-1.5 text-xs">
                    {roomsInGrp.map(room => {
                      const activeEsc = getRoomOccupancy(room.id, escalations);

                      return (
                        <li 
                          key={room.id} 
                          onClick={() => {
                            if (activeEsc) {
                              setRoomToFinalize(activeEsc);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                            activeEsc 
                              ? 'bg-blue-50/70 border border-blue-100 text-blue-900 cursor-pointer hover:bg-blue-100/90 hover:border-blue-300 hover:shadow-2xs' 
                              : 'bg-slate-50/50 border border-slate-150 border-dashed text-slate-400 hover:bg-emerald-50/30'
                          }`}
                          title={activeEsc ? "Clique para desocupar esta sala e liberar o plantonista" : "Sala livre"}
                        >
                          <span className="font-mono font-medium tracking-tight truncate mr-1">{room.sala}</span>
                          
                          {activeEsc ? (
                            <div className="flex items-center justify-end text-right gap-1.5 overflow-hidden w-full max-w-[150px]">
                              {/* NAME COMPLETO AND TIME MULTIPLE RULES MET
                                  "Nome completo do plantonista escalado ... ao lado do nome, apenas o número do tempo de permanência no local..." */}
                              <span className="text-blue-900 font-bold truncate text-right block text-[11px]" title={activeEsc.doctorName}>
                                {activeEsc.doctorName}
                              </span>
                              <span className="bg-blue-200/60 text-blue-950 font-extrabold px-1.5 py-0.2 rounded font-mono text-[9px] select-none shrink-0" title="Tempo de Permanência em minutos">
                                {formatDurationPure(activeEsc.entrada)}m
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent trigger LI click if any, although activeEsc is null
                                openNewEscalation('', room.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-200 bg-emerald-50/80 rounded cursor-pointer transition-colors uppercase tracking-wider shadow-2xs"
                              title="Clique para selecionar o plantonista"
                            >
                              Selecionar
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>





      {/* 5. LINHA DO TEMPO (CHRONOLOGICAL TIMELINE GRAPH) */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" id="timeline-section">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              Visão do Dia: Linha do Tempo do Plantão
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Distribuição horária das escalações de hoje (07h às 19h)</p>
          </div>
          <div className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded font-mono">
            Escala Diurna
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          <div className="min-w-[800px] border border-slate-200/80 rounded-lg overflow-hidden">
            {/* Header times */}
            <div className="grid grid-cols-12 bg-slate-50 text-[10px] font-mono text-slate-500 border-b border-slate-200 py-2.5 px-3">
              <div className="col-span-3 font-semibold text-slate-700">Hospital Anestesiologista</div>
              <div className="col-span-9 grid grid-cols-12 text-center text-[9px]">
                {timelineHours.slice(0, 12).map((h) => (
                  <div key={h} className="border-l border-slate-200/50">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Doctors timeline rows */}
            <div className="divide-y divide-slate-100">
              {present.map(doc => {
                // Find all allocations for this doctor today
                const docEscalations = escalations.filter(e => e.doctorID === doc.id);

                return (
                  <div key={doc.id} className="grid grid-cols-12 items-center py-2 px-3 text-xs hover:bg-slate-50/40">
                    {/* Name column */}
                    <div className="col-span-3 font-semibold text-slate-800 truncate" title={doc.nome}>
                      {doc.nome}
                    </div>

                    {/* Timeline visualization bar */}
                    <div className="col-span-9 h-6 relative bg-slate-100/50 rounded grid grid-cols-12 border border-slate-200/40">
                      {/* Grid divisions */}
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <div key={idx} className="border-r border-slate-200/30 h-full" />
                      ))}

                      {/* Overlap overlays/absolute markers of scaled blocks */}
                      {docEscalations.map(esc => {
                        // Calculate percentage boundaries (07:00 to 19:00 = 12 hours)
                        const start = new Date(esc.entrada);
                        const end = esc.saida ? new Date(esc.saida) : new Date();

                        const startHour = start.getHours() + start.getMinutes() / 60;
                        const endHour = end.getHours() + end.getMinutes() / 60;

                        // Clamp values to timeline bounds (7 to 19)
                        const clampedStart = Math.max(7, Math.min(19, startHour));
                        const clampedEnd = Math.max(7, Math.min(19, endHour));

                        if (clampedStart >= clampedEnd) return null;

                        const leftPct = ((clampedStart - 7) / 12) * 100;
                        const widthPct = ((clampedEnd - clampedStart) / 12) * 100;

                        return (
                          <div
                            key={esc.id}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-0.5 bottom-0.5 rounded px-1.5 text-[9px] font-semibold text-white flex items-center justify-between whitespace-nowrap overflow-hidden shadow-xs cursor-pointer select-none transition-all ${
                              esc.ativa
                                ? 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                                : 'bg-slate-400 hover:bg-slate-500'
                            }`}
                            title={`${esc.salaNome} (${esc.setorNome}) - Atendimento: ${esc.atendimento || 'Sem atendimento'} - Entrada: ${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`}
                          >
                            <span className="truncate">{esc.salaNome}</span>
                            <span className="text-[8px] font-mono opacity-80 shrink-0">
                              {formatDurationPure(esc.entrada, esc.saida)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 6. MODAL NEW ESCALAÇÃO (ALLOCATION FORM) */}
      {isEscalateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" id="new-escalation-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold font-display">Escalar Anestesiologista</h3>
                <p className="text-[11px] text-slate-400">Inserir parâmetros do ato anestésico</p>
              </div>
              <button
                onClick={() => setIsEscalateModalOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEscalation} className="p-6 space-y-4">
              {overlapError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{overlapError}</span>
                </div>
              )}

              {/* Anesthesiologist Select */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Anestesiologista</label>
                <select
                  id="form-select-doctor"
                  required
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50"
                >
                  <option value="">Selecione um anestesista...</option>
                  {[...present].sort((a, b) => {
                    const escA = escalations.find(e => e.ativa && e.doctorID === a.id);
                    const escB = escalations.find(e => e.ativa && e.doctorID === b.id);
                    // Available doctors first
                    if (!escA && escB) return -1;
                    if (escA && !escB) return 1;
                    if (!escA && !escB) {
                      // Descending order of wait time (earlier availableSince timestamps at the top)
                      return new Date(a.disponivelDesde).getTime() - new Date(b.disponivelDesde).getTime();
                    }
                    return 0;
                  }).map(d => {
                    const activeEsc = escalations.find(e => e.ativa && e.doctorID === d.id);
                    const isAvailable = !activeEsc;
                    const waitMins = isAvailable ? formatDurationPure(d.disponivelDesde) : '0';
                    const labelSuffix = isAvailable 
                      ? `(Disponível - ${waitMins} min ocioso)` 
                      : `(🚫 Escalado na ${activeEsc.salaNome})`;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.nome} CRM {d.crm} {labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sectores & Sala Select */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Local do Procedimento</label>
                <select
                  id="form-select-room"
                  required
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50"
                >
                  {HOSPITAL_ROOMS.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.setor} - {room.sala} {room.especial ? '⭐ (Especial 6h)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient code (Atendimento) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Nº Atendimento <span className="text-slate-400 text-[10px] font-normal">(Opcional)</span>
                </label>
                <input
                  id="form-input-ticket"
                  type="text"
                  placeholder="Ex: AT-129038"
                  value={ticketNum}
                  onChange={(e) => setTicketNum(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50"
                />
              </div>

              {/* Timing parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Horário Entrada</label>
                  <input
                    id="form-input-entry-time"
                    type="time"
                    required
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Horário Saída <span className="text-slate-400 text-[10px] font-normal">(Fim)</span>
                  </label>
                  <input
                    id="form-input-exit-time"
                    type="time"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    placeholder="Contínuo"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50"
                  />
                </div>
              </div>

              {/* Special Sector rules indicator & manual hours display */}
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">Horas Creditadas</label>
                  <input
                    id="form-input-custom-hours"
                    type="number"
                    step="0.5"
                    className="w-20 text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 font-mono text-right"
                    placeholder="Automático"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  {activeRoom?.especial 
                    ? '⭐ Setor Especial contabilizado inicialmente como bloco de 6 horas.' 
                    : 'Calculada de forma dinâmica a partir da permanência de entrada e saída se deixado em branco.'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Atos Anestésicos Realizados</label>
                <input
                  id="form-input-atos"
                  type="number"
                  min="1"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50 font-mono"
                  value={numAtos}
                  onChange={(e) => setNumAtos(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  id="form-cancel-btn"
                  onClick={() => setIsEscalateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="form-submit-btn"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all cursor-pointer"
                >
                  Confirmar Escala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL EDIT ESCALAÇÃO (REQUIRE JUSTIFICATION) */}
      {editingEscalation && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" id="edit-escalation-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold font-display">Editar Registro de Escala</h3>
                <p className="text-[11px] text-slate-400">Procedimento de {editingEscalation.doctorName}</p>
              </div>
              <button
                onClick={() => setEditingEscalation(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEscalation} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Nº Atendimento</label>
                <input
                  type="text"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                  value={editingEscalation.atendimento}
                  onChange={(e) => setEditingEscalation({ ...editingEscalation, atendimento: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Horas Creditadas</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                    value={editRequestHours}
                    onChange={(e) => setEditRequestHours(e.target.value)}
                    placeholder="Carga horária"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Atos anestésicos</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                    value={editingEscalation.atosRealizados}
                    onChange={(e) => setEditingEscalation({ ...editingEscalation, atosRealizados: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {/* Justification - MUST MANDATORY REQUIRED */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Justificativa de Edição <span className="text-rose-500 font-bold">*</span>
                </label>
                <textarea
                  id="edit-justification-input"
                  required
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 bg-slate-50 text-slate-800"
                  placeholder="Por que está alterando este registro ?"
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                {/* Deletion directly triggers from here */}
                <button
                  type="button"
                  onClick={() => {
                    openDeleteModal(editingEscalation);
                    setEditingEscalation(null);
                  }}
                  className="font-semibold text-xs text-rose-600 hover:text-rose-800 hover:underline transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir Registro
                </button>

                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingEscalation(null)}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    Salvar Alteração
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL DELETE ESCALAÇÃO (REQUIRE JUSTIFICATION) */}
      {deletingEscalation && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" id="delete-escalation-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-rose-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold font-display">Confirmar Exclusão</h3>
                <p className="text-[11px] text-rose-300">Ação irreversível de auditoria</p>
              </div>
              <button
                onClick={() => setDeletingEscalation(null)}
                className="p-1 hover:bg-rose-850 text-rose-300 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteEscalationSubmit} className="p-6 space-y-4">
              <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded-lg border border-rose-100 space-y-1 leading-relaxed">
                <p className="font-semibold">Atenção:</p>
                <p>Você está prestes a excluir permanentemente a escala de <strong className="text-rose-900">{deletingEscalation.doctorName}</strong>.</p>
              </div>

              {/* Justification - MUST MANDATORY REQUIRED */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Justificativa de Exclusão <span className="text-rose-500 font-bold">*</span>
                </label>
                <textarea
                  id="delete-justification-input"
                  required
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-600 bg-slate-50 text-slate-800"
                  placeholder="Informe o motivo da desvinculação..."
                  value={deleteJustification}
                  onChange={(e) => setDeleteJustification(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDeletingEscalation(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Excluir e Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8.5. MODAL DESOCUPAR SALA (REAL-TIME DISPLAY CLICK) */}
      {roomToFinalize && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" id="finalize-room-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold font-display">Desocupar Sala & Liberar Plantonista</h3>
                <p className="text-[11px] text-slate-400">Finalizar o tempo de permanência no posto</p>
              </div>
              <button
                onClick={() => setRoomToFinalize(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1.5 text-xs text-blue-900 leading-relaxed">
                <p className="font-bold text-blue-950 uppercase tracking-wide">Informações da Alocação:</p>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 pt-1 font-medium">
                  <div>
                    <span className="text-slate-500 font-normal">Anestesista:</span>
                    <p className="font-bold text-slate-800 text-[13px]">{roomToFinalize.doctorName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">Setor / Sala:</span>
                    <p className="font-bold text-slate-800 text-[13px]">{roomToFinalize.setorNome} - {roomToFinalize.salaNome}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">Iniciou em:</span>
                    <p className="font-mono text-slate-700">{new Date(roomToFinalize.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">Permanência atual:</span>
                    <p className="font-mono text-rose-600 font-bold">{formatDurationPure(roomToFinalize.entrada)} minutos</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Ao clicar em confirmar, a ocupação desta sala será finalizada com o horário atual, e o anestesista retornará automaticamente para o topo da lista de <strong>médicos disponíveis</strong> por estar com o horário de liberação recente.
              </p>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRoomToFinalize(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all cursor-pointer font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleFinalizeEscalation(roomToFinalize.id);
                    setRoomToFinalize(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  <Check className="h-4 w-4" /> Confirmar e Liberar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. CLICK DETAIL POP-UPS */}
      {activeCardModal !== 'none' && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" id="detail-popups-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold font-display">
                  {activeCardModal === 'present' && 'Detalhamento de Presentes no Plantão'}
                  {activeCardModal === 'available' && 'Detalhamento de Médicos Disponíveis'}
                  {activeCardModal === 'escalated' && 'Detalhamento de Ativos Escalados'}
                </h3>
                <p className="text-[11px] text-slate-400">MVP Controle de Médicos Anestesistas</p>
              </div>
              <button
                onClick={() => setActiveCardModal('none')}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Lists */}
            <div className="p-6 max-h-[400px] overflow-y-auto divide-y divide-slate-100">
              {activeCardModal === 'present' && (
                <div className="space-y-4 pt-1">
                  
                  {/* Toggle header and button to Add Doctor */}
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-sidebar-divider">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Médicos Presentes ({present.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDoctorForm(!showAddDoctorForm);
                        setAddErrorMsg('');
                      }}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus className="h-3 w-3" /> Adicionar Médico
                    </button>
                  </div>

                  {/* Add Doctor form area */}
                  {showAddDoctorForm && (
                    <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs text-slate-700 space-y-3 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Adicionar Médico ao Plantão</span>
                        <button
                          type="button"
                          onClick={() => setShowAddDoctorForm(false)}
                          className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Add Method Tab */}
                      <div className="flex rounded-md bg-slate-200/80 p-0.5">
                        <button
                          type="button"
                          onClick={() => { setAddMethod('select'); setAddErrorMsg(''); }}
                          className={`flex-1 py-1 text-center rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                            addMethod === 'select' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Médico Registrado
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddMethod('new'); setAddErrorMsg(''); }}
                          className={`flex-1 py-1 text-center rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                            addMethod === 'new' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Novo Cadastro + Plantão
                        </button>
                      </div>

                      {addErrorMsg && (
                        <div className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-2 py-1">
                          {addErrorMsg}
                        </div>
                      )}

                      {addMethod === 'select' ? (
                        <form onSubmit={handleAddExistingDoctor} className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Escolher Médico Registrado:</label>
                            {doctors.filter(d => !d.presente).length === 0 ? (
                              <p className="text-[11px] text-slate-500 italic py-1 bg-white border border-slate-200 rounded px-2">
                                Todos anestesistas cadastrados já estão no plantão.
                              </p>
                            ) : (
                              <select
                                value={selectedExistingId}
                                onChange={(e) => setSelectedExistingId(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-250 rounded-lg focus:ring-1 focus:ring-blue-600 text-slate-800 bg-white"
                              >
                                <option value="">Selecione...</option>
                                {doctors.filter(d => !d.presente).map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.nome} (CRM {d.crm})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {doctors.filter(d => !d.presente).length > 0 && (
                            <button
                              type="submit"
                              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors text-[10px] uppercase tracking-widest cursor-pointer shadow-3xs"
                            >
                              Confirmar Entrada
                            </button>
                          )}
                        </form>
                      ) : (
                        <form onSubmit={handleAddNewDoctor} className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">Nome:</label>
                              <input
                                type="text"
                                placeholder="Dr(a). Nome..."
                                value={newDocNome}
                                onChange={(e) => setNewDocNome(e.target.value)}
                                className="w-full text-xs px-2 py-1 border border-slate-250 bg-white rounded focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">CRM:</label>
                              <input
                                type="text"
                                placeholder="123456-SP"
                                value={newDocCrm}
                                onChange={(e) => setNewDocCrm(e.target.value)}
                                className="w-full text-xs px-2 py-1 border border-slate-250 bg-white rounded focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">Celular:</label>
                              <input
                                type="text"
                                placeholder="(11) 99999-9999"
                                value={newDocCelular}
                                onChange={(e) => setNewDocCelular(e.target.value)}
                                className="w-full text-xs px-2 py-1 border border-slate-250 bg-white rounded focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">Afinidade (Opcional):</label>
                              <input
                                type="text"
                                placeholder="Neuro, Ginecologia..."
                                value={newDocAfinidade}
                                onChange={(e) => setNewDocAfinidade(e.target.value)}
                                className="w-full text-xs px-2 py-1 border border-slate-250 bg-white rounded focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors text-[10px] uppercase tracking-widest cursor-pointer shadow-3xs"
                          >
                            Registrar & Adicionar
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* List of present doctors */}
                  {present.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 italic text-center">Nenhum médico presente.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {present.map(doc => {
                        const activeEsc = escalations.find(e => e.ativa && e.doctorID === doc.id);
                        return (
                          <div key={doc.id} className="py-2.5 flex justify-between items-center transition-colors">
                            <div>
                              <div className="text-xs font-bold text-slate-800">{doc.nome}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{doc.crm} • {doc.celular}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-extrabold uppercase ${
                                activeEsc ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}>
                                {activeEsc ? 'Escalado' : 'Disponível'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const textWarn = activeEsc 
                                    ? `\n\nATENÇÃO: Este médico possui uma escalação ATIVA na sala ${activeEsc.salaNome}. Retirá-lo do plantão irá automaticamente desocupar esta sala e encerrar o seu tempo de permanência.` 
                                    : '';
                                  if (confirm(`Excluir Dr(a). ${doc.nome} da lista dos plantonistas do dia?${textWarn}`)) {
                                    handleRemoveDoctorFromShift(doc.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition-all cursor-pointer"
                                title="Excluir o nome da lista dos plantonistas do dia"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeCardModal === 'available' && (
                available.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 italic text-center">Todos médicos escala ativa.</p>
                ) : (
                  available.map(doc => {
                    const isIdle60 = doc.isIdle;
                    return (
                      <div 
                        key={doc.id} 
                        className={`py-3 px-4 flex justify-between items-center my-1 rounded-lg border transition-colors ${
                          isIdle60 
                            ? 'bg-amber-50 border-amber-200 text-amber-950 shadow-xs' 
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          {/* Highlights available ones idle for > 60m with an exclamation mark! */}
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className={isIdle60 ? "text-amber-950 font-extrabold" : "text-slate-800"}>
                              {doc.nome}
                            </span>
                            {isIdle60 && (
                              <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black font-mono flex items-center gap-0.5 uppercase tracking-wider animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5" /> Ocioso &gt; 60m
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] font-mono mt-0.5 ${isIdle60 ? "text-amber-800 font-medium" : "text-slate-550 text-slate-500"}`}>
                            CRM {doc.crm} • Aguardando há <strong className={isIdle60 ? "font-extrabold text-amber-900" : ""}>{doc.durationText} minutos</strong>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                          isIdle60 ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {isIdle60 ? "Prioridade" : "Disponível"}
                        </span>
                      </div>
                    );
                  })
                )
              )}

              {activeCardModal === 'escalated' && (
                escalated.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 italic text-center">Nenhum anestesista escalado ativo.</p>
                ) : (
                  escalated.map(doc => (
                    <div key={doc.id} className="py-3">
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-slate-800">{doc.nome}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-1.5 rounded font-mono">
                          {doc.durationText}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        Setor: {doc.escalation.setorNome} - {doc.escalation.salaNome}
                        {doc.escalation.atendimento && ` (Atendimento: #${doc.escalation.atendimento})`}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveCardModal('none')}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
