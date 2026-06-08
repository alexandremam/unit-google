import React, { useState, useMemo, useEffect } from 'react';
import { Doctor, SectorRoom, Escalation, UserSession, DailyPresence } from '../types';
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
  Timer,
  AlertCircle,
  Repeat
} from 'lucide-react';
import {
  getDoctorsStatuses,
  getRoomOccupancy,
  checkOverlap,
  logSystemEvent,
  formatDurationPure,
  formatMinutesToHoursAndMins
} from '../utils';
import { HOSPITAL_ROOMS } from '../data';

interface AgoraTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  escalations: Escalation[];
  setEscalations: React.Dispatch<React.SetStateAction<Escalation[]>>;
  session: UserSession;
  dailyPresences: DailyPresence[];
  setDailyPresences: React.Dispatch<React.SetStateAction<DailyPresence[]>>;
}

export default function AgoraTab({
  doctors,
  setDoctors,
  escalations,
  setEscalations,
  session,
  dailyPresences,
  setDailyPresences
}: AgoraTabProps) {
  // Navigation filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  // Modals for click cards
  const [activeCardModal, setActiveCardModal] = useState<'none' | 'present' | 'available' | 'escalated' | 'unplanned_icu'>('none');

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
  const [repeatType, setRepeatType] = useState<'none' | 'indefinitely' | 'defined'>('none');
  const [repeatWeeks, setRepeatWeeks] = useState('4');

  // Editing state
  const [editingEscalation, setEditingEscalation] = useState<Escalation | null>(null);
  const [editJustification, setEditJustification] = useState('');
  const [editRequestHours, setEditRequestHours] = useState('');

  // Deletion state
  const [deletingEscalation, setDeletingEscalation] = useState<Escalation | null>(null);
  const [deleteJustification, setDeleteJustification] = useState('');

  // Real-time room click finalization popup
  const [roomToFinalize, setRoomToFinalize] = useState<Escalation | null>(null);
  const [finalizeExitTime, setFinalizeExitTime] = useState('');
  const [finalizeAtendimento, setFinalizeAtendimento] = useState('');
  const [finalizeUtiNaoProgramada, setFinalizeUtiNaoProgramada] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

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
  const [tick, setTick] = useState(0);
  const [timeString, setTimeString] = useState(() => new Date().toLocaleTimeString('pt-BR'));
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      setTimeString(new Date().toLocaleTimeString('pt-BR'));
    }, 1000); // refresh every second
    return () => clearInterval(timer);
  }, []);

  // Dynamic doctor status computer based on active date presences & shift ranges
  const doctorsForAgora = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentHour = new Date().getHours();

    // Filter presences for today
    const todaysPresences = dailyPresences.filter(p => p.date === todayStr);

    return doctors.map(doc => {
      const presence = todaysPresences.find(p => p.doctorID === doc.id);
      if (!presence) {
        return { ...doc, presente: false };
      }

      const shift = presence.shiftType;
      let isWithinShift = true;

      // Restrict only if within standard shift bounds (07:00 to 19:00)
      if (currentHour >= 7 && currentHour < 19) {
        if (shift === '6h-manha') {
          isWithinShift = currentHour >= 7 && currentHour < 13;
        } else if (shift === '6h-tarde') {
          isWithinShift = currentHour >= 13 && currentHour < 19;
        } else {
          isWithinShift = true; // 12h
        }
      } else {
        isWithinShift = true; // Outside standard, make available for testing/off-hours
      }

      return {
        ...doc,
        presente: isWithinShift
      };
    });
  }, [doctors, dailyPresences, tick]);

  // Compute stats
  const { present, available, escalated } = useMemo(() => {
    return getDoctorsStatuses(doctorsForAgora, escalations);
  }, [doctorsForAgora, escalations]);

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

  useEffect(() => {
    if (roomToFinalize) {
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, '0');
      const MM = String(now.getMinutes()).padStart(2, '0');
      setFinalizeExitTime(`${HH}:${MM}`);
      setFinalizeAtendimento(roomToFinalize.atendimento || '');
      setFinalizeUtiNaoProgramada(!!roomToFinalize.utiNaoProgramada);
      setFinalizeError('');
    } else {
      setFinalizeExitTime('');
      setFinalizeAtendimento('');
      setFinalizeUtiNaoProgramada(false);
      setFinalizeError('');
    }
  }, [roomToFinalize]);

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
    setRepeatType('none');
    setRepeatWeeks('4');
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

    // Convert operational entry HH:mm to full ISO on escalationDate
    const [yr, mo, dy] = escalationDate.split('-').map(Number);
    const [entH, entM] = entryTime.split(':').map(Number);
    const entDate = new Date();
    entDate.setFullYear(yr, mo - 1, dy);
    entDate.setHours(entH, entM, 0, 0);

    let parsedSaidaISO: string | undefined = undefined;
    if (exitTime) {
      const [exH, exM] = exitTime.split(':').map(Number);
      const exDate = new Date();
      exDate.setFullYear(yr, mo - 1, dy);
      exDate.setHours(exH, exM, 0, 0);
      parsedSaidaISO = exDate.toISOString();
    }

    // Check overlap for the doctor on current date
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

    if (ticketNum.trim() !== '' && !/^\d{8}$/.test(ticketNum.trim())) {
      setOverlapError('O número de atendimento deve conter exatamente 8 dígitos numéricos.');
      return;
    }

    // Set up weekly replications if requested
    let numReplications = 0;
    if (repeatType === 'indefinitely') {
      numReplications = 24; // Default to 24 weeks (~6 months)
    } else if (repeatType === 'defined') {
      const parsedWeeks = parseInt(repeatWeeks);
      numReplications = isNaN(parsedWeeks) ? 0 : parsedWeeks;
    }

    const baseTimeMs = entDate.getTime();
    const futureEscalations: Escalation[] = [];
    const overlapDates: string[] = [];

    for (let w = 1; w <= numReplications; w++) {
      const shiftMs = w * 7 * 24 * 60 * 60 * 1000;
      const repEntDate = new Date(baseTimeMs + shiftMs);
      
      let repExitISO: string | undefined = undefined;
      if (parsedSaidaISO) {
        repExitISO = new Date(new Date(parsedSaidaISO).getTime() + shiftMs).toISOString();
      }

      const repDateStr = repEntDate.toISOString().split('T')[0];

      // Check overlap for this doctor on this future date
      const overlapOnReplica = checkOverlap(
        selectedDoctorId,
        repEntDate.toISOString(),
        repExitISO,
        [...escalations, ...futureEscalations]
      );

      if (overlapOnReplica) {
        overlapDates.push(repEntDate.toLocaleDateString('pt-BR'));
      } else {
        futureEscalations.push({
          id: `esc-${Date.now()}-rep-${w}`,
          doctorID: selectedDoctorId,
          doctorName: doc.nome,
          roomId: selectedRoomId,
          setorNome: room.setor,
          salaNome: room.sala,
          atendimento: ticketNum.trim(),
          data: repDateStr,
          entrada: repEntDate.toISOString(),
          saida: repExitISO,
          horasManual: customHours ? parseFloat(customHours) : undefined,
          atosRealizados: repExitISO ? 1 : 0,
          ativa: !repExitISO
        });
      }
    }

    if (overlapDates.length > 0) {
      setOverlapError(
        `O(A) ${doc.nome} já possui escalas que conflitam nos seguintes dias de repetição: ${overlapDates.join(', ')}. Remova os conflitos ou desative a repetição.`
      );
      return;
    }

    // Create current escalation object
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
      atosRealizados: parsedSaidaISO ? 1 : 0, // automatic: 1 if entered exit time immediately, else 0 when still active
      ativa: !parsedSaidaISO // active if no end time
    };

    const updatedEscalations = [...escalations, newEsc, ...futureEscalations];
    setEscalations(updatedEscalations);
    localStorage.setItem('unita_escalations', JSON.stringify(updatedEscalations));

    // Audit action
    let repeatDescription = '';
    if (repeatType === 'indefinitely') {
      repeatDescription = ` (replicada semanalmente por período indeterminado: +${numReplications} semanas agendadas)`;
    } else if (repeatType === 'defined') {
      repeatDescription = ` (replicada semanalmente por período determinado de ${numReplications} semanas)`;
    }

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Nova escala',
      `Agendou escala para ${doc.nome} em ${room.setor} - ${room.sala}. Atendimento: ${newEsc.atendimento || 'Sem ID'}.${repeatDescription}`,
    );

    setIsEscalateModalOpen(false);
  };

  // Finalize (Check out) scale manually
  const handleFinalizeEscalation = (escId: string, customExitTime?: string, atendimentoValue?: string, utiValue?: boolean) => {
    let now = new Date();

    if (customExitTime) {
      const [exH, exM] = customExitTime.split(':').map(Number);
      const targetEsc = escalations.find(e => e.id === escId);
      if (targetEsc) {
        const baseDate = targetEsc.data ? new Date(targetEsc.data + 'T00:00:00') : new Date();
        baseDate.setHours(exH, exM, 0, 0);
        now = baseDate;
      } else {
        now.setHours(exH, exM, 0, 0);
      }
    }

    const updated = escalations.map(e => {
      if (e.id === escId) {
        // Calculate default hours if no manual credit
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
          horasManual: e.horasManual || cred, // preserve if manual else calculate
          atosRealizados: e.atosRealizados || 1, // automatic acts counter set to 1 when procedure is completed/finalized!
          atendimento: atendimentoValue !== undefined ? atendimentoValue.trim() : e.atendimento,
          utiNaoProgramada: utiValue !== undefined ? utiValue : e.utiNaoProgramada,
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
      `Finalizou escala do Dr(a). ${targetEsc.doctorName} no setor ${targetEsc.setorNome} ${targetEsc.salaNome}.` +
      ((atendimentoValue && atendimentoValue.trim()) ? ` Atendimento: ${atendimentoValue.trim()}.` : '') +
      (utiValue ? ' [UTI não programada]' : '')
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
            atosRealizados: 1, // automatic acts counter set to 1 when procedure is completed/finalized!
            ativa: false
          };
        }
        return e;
      });
      setEscalations(updatedEscalations);
      localStorage.setItem('unita_escalations', JSON.stringify(updatedEscalations));
    }

    // 2. Set doctor as not present
    const todayStr = new Date().toLocaleDateString('en-CA');
    const updatedPresences = dailyPresences.filter(p => !(p.doctorID === doctorId && p.date === todayStr));
    setDailyPresences(updatedPresences);
    localStorage.setItem('unita_daily_presences', JSON.stringify(updatedPresences));

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
    const todayStr = new Date().toLocaleDateString('en-CA');
    const newPres: DailyPresence = {
      id: `pres-${selectedExistingId}-${todayStr}-${Date.now()}`,
      date: todayStr,
      doctorID: selectedExistingId,
      shiftType: '12h'
    };
    const updatedPresences = [...dailyPresences, newPres];
    setDailyPresences(updatedPresences);
    localStorage.setItem('unita_daily_presences', JSON.stringify(updatedPresences));

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
      afinidade: '',
      presente: true,
      disponivelDesde: new Date().toISOString()
    };

    const todayStr = new Date().toLocaleDateString('en-CA');
    const newPres: DailyPresence = {
      id: `pres-${uniqueId}-${todayStr}-${Date.now()}`,
      date: todayStr,
      doctorID: uniqueId,
      shiftType: '12h'
    };
    const updatedPresences = [...dailyPresences, newPres];
    setDailyPresences(updatedPresences);
    localStorage.setItem('unita_daily_presences', JSON.stringify(updatedPresences));

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

    if (editingEscalation.utiNaoProgramada && !editingEscalation.atendimento.trim()) {
      alert('O número de atendimento é obrigatório quando a opção "UTI não programada?" está marcada.');
      return;
    }

    if (editingEscalation.atendimento.trim() !== '' && !/^\d{8}$/.test(editingEscalation.atendimento.trim())) {
      alert('O número de atendimento deve ser composto por exatamente 8 dígitos numéricos.');
      return;
    }

    const updated = escalations.map(esc => {
      if (esc.id === editingEscalation.id) {
        // Find if timings changed or if hours custom
        return {
          ...esc,
          atendimento: editingEscalation.atendimento,
          utiNaoProgramada: editingEscalation.utiNaoProgramada,
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

  // Calculate daytime shift progress (from 07:00 to 19:00 - 12 hours)
  const shiftProgress = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const currentMins = hour * 60 + min;
    const startMins = 7 * 60; // 07:00
    const endMins = 19 * 60; // 19:00

    if (currentMins < startMins) return 0;
    if (currentMins > endMins) return 100;
    return Math.round(((currentMins - startMins) / (endMins - startMins)) * 100);
  }, [tick]);

  // Reusable lightweight SVG Donut Chart with animated stroke and optional floating icon badge
  const renderDonut = (
    value: number,
    max: number,
    colorClass: string,
    bgClass: string,
    centerText: string,
    icon?: React.ReactNode
  ) => {
    const safeMax = max || 1;
    const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));
    const radius = 20;
    const strokeWidth = 4.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative w-15 h-15 flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className={`${bgClass} fill-transparent`}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className={`${colorClass} fill-transparent transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-xs font-black text-slate-800 font-mono tracking-tighter">
            {centerText}
          </span>
          {icon && (
            <div className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full shadow-2xs flex items-center justify-center border scale-90 bg-white border-slate-100">
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  };

  const presentPercentageStr = `${Math.round((present.length / 22) * 100)}%`;
  const availablePercentageStr = `${present.length ? Math.round((available.length / present.length) * 100) : 0}%`;
  const escalatedPercentageStr = `${present.length ? Math.round((escalated.length / present.length) * 100) : 0}%`;

  const todayString = new Date().toISOString().split('T')[0];
  const todayUnplannedIcuEscalations = escalations.filter(e => e.utiNaoProgramada && e.data === todayString);
  const totalTodayEscalationsCount = escalations.filter(e => e.data === todayString).length || 1;

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. SMALL CLICKABLE RESUME CARDS WITH BEAUTIFUL CIRCULAR CHARTS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="resume-cards-section">
        {/* Realtime Hour Hand (Typographic Widget with analog micro elements - No graph) */}
        <div className="bg-slate-950 rounded-xl p-4 flex items-center gap-4 border border-slate-800 shadow-md text-white">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-blue-400 shadow-inner">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Horário Tempo Real</p>
            </div>
            <h3 className="text-2xl font-mono font-black text-white leading-none mt-2 tracking-wider">
              {timeString}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                Plantão Diurno
              </span>
              <span className="text-slate-705 text-xs">•</span>
              <span className="text-[9px] text-slate-500 font-mono font-bold">
                07h às 19h
              </span>
            </div>
          </div>
        </div>

        {/* Presente / No Plantão Card */}
        <div
          id="card-present"
          onClick={() => setActiveCardModal('present')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 hover:shadow-sm transition-all group"
        >
          {renderDonut(
            present.length,
            22,
            'stroke-blue-600',
            'stroke-blue-100',
            presentPercentageStr,
            <Users className="h-2.5 w-2.5 text-blue-500" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">No Plantão</p>
            <h3 className="text-xl font-black text-slate-800 leading-tight mt-1 font-display">
              {present.length} <span className="text-xs font-bold text-slate-400 font-sans">/ 22</span>
            </h3>
            <p className="text-[9px] text-slate-500 font-semibold font-sans mt-0.5 truncate bg-blue-50/50 rounded px-1.5 py-0.5 border border-blue-100/30 w-fit">
              vagas preenchidas
            </p>
          </div>
        </div>

        {/* Disponíveis Card */}
        <div
          id="card-available"
          onClick={() => setActiveCardModal('available')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-200 hover:shadow-sm transition-all group relative"
        >
          {renderDonut(
            available.length,
            present.length || 1,
            'stroke-emerald-600',
            'stroke-emerald-100',
            availablePercentageStr,
            <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Disponíveis</p>
            <h3 className="text-xl font-black text-slate-800 leading-tight mt-1 font-display">
              {available.length} <span className="text-xs font-bold text-slate-400 font-sans">/ {present.length}</span>
            </h3>
            {available.some(a => a.isIdle) ? (
              <div className="mt-1 text-[9px] text-amber-700 font-sans font-bold flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit leading-none">
                <AlertTriangle className="h-2 w-2" /> {available.filter(a => a.isIdle).length} ociosos
              </div>
            ) : (
              <p className="text-[9px] text-emerald-700 font-semibold font-sans mt-0.5 truncate bg-emerald-50/50 rounded px-1.5 py-0.5 border border-emerald-100/30 w-fit">
                prontos para sala
              </p>
            )}
          </div>
        </div>

        {/* Escalados Card */}
        <div
          id="card-escalated"
          onClick={() => setActiveCardModal('escalated')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-amber-50/50 hover:border-amber-200 hover:shadow-sm transition-all group"
        >
          {renderDonut(
            escalated.length,
            present.length || 1,
            'stroke-amber-500',
            'stroke-amber-100',
            escalatedPercentageStr,
            <Clock className="h-2.5 w-2.5 text-amber-600" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Escalados</p>
            <h3 className="text-xl font-black text-slate-800 leading-tight mt-1 font-display">
              {escalated.length} <span className="text-xs font-bold text-slate-400 font-sans">/ {present.length}</span>
            </h3>
            <p className="text-[9px] text-amber-700 font-semibold font-sans mt-0.5 truncate bg-amber-50/50 rounded px-1.5 py-0.5 border border-amber-100/30 w-fit">
              ativos em cirurgia
            </p>
          </div>
        </div>

        {/* Unplanned ICU Card */}
        <div
          id="card-unplanned-icu"
          onClick={() => setActiveCardModal('unplanned_icu')}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:bg-rose-50/50 hover:border-rose-200 hover:shadow-sm transition-all group"
        >
          {renderDonut(
            todayUnplannedIcuEscalations.length,
            totalTodayEscalationsCount,
            'stroke-rose-600',
            'stroke-rose-100',
            String(todayUnplannedIcuEscalations.length),
            <AlertCircle className="h-2.5 w-2.5 text-rose-600" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-rose-500 font-extrabold uppercase tracking-widest leading-none">UTI s/ Progr.</p>
            <h3 className="text-xl font-black text-slate-800 leading-tight mt-1 font-display">
              {todayUnplannedIcuEscalations.length} <span className="text-xs font-bold text-slate-400 font-sans">reg.</span>
            </h3>
            <p className="text-[9px] text-rose-700 font-semibold font-sans mt-0.5 truncate bg-rose-50 rounded px-1.5 py-0.5 border border-rose-100 w-fit">
              hoje
            </p>
          </div>
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
                              <span className="bg-blue-200/60 text-blue-950 font-extrabold px-1.5 py-0.2 rounded font-mono text-[9px] select-none shrink-0" title="Tempo de Permanência">
                                {formatMinutesToHoursAndMins(parseInt(formatDurationPure(activeEsc.entrada)))}
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
                              {formatMinutesToHoursAndMins(parseInt(formatDurationPure(esc.entrada, esc.saida)))}
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
                <p className="text-[11px] text-slate-400">
                  {activeRoom ? `Destino: ${activeRoom.setor} - ${activeRoom.sala}` : 'Inserir parâmetros do ato anestésico'}
                </p>
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
                      ? `(Disponível - ${formatMinutesToHoursAndMins(parseInt(waitMins))} ocioso)` 
                      : `(🚫 Escalado na ${activeEsc.salaNome})`;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.nome} CRM {d.crm} {labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Patient code (Atendimento) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Nº Atendimento <span className="text-slate-400 text-[10px] font-normal">(8 dígitos, Opcional)</span>
                </label>
                <input
                  id="form-input-ticket"
                  type="text"
                  placeholder="Ex: 12345678"
                  maxLength={8}
                  value={ticketNum}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setTicketNum(onlyNums);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50 font-mono"
                />
              </div>

              {/* Timing parameters */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Horário Entrada</label>
                <input
                  id="form-input-entry-time"
                  type="time"
                  required
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50 animate-fade-in font-mono"
                />
              </div>

              {/* Recurrence Pattern Configuration Group */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3" id="recurrence-configuration-block">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 rounded bg-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-wider">Novo</span>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-blue-600" /> Replicar Escalação
                  </label>
                </div>
                
                <p className="text-[11px] text-slate-500 leading-normal">
                  Optar por repetir esta escala semanalmente no mesmo dia da semana e horário.
                </p>

                {/* Selection Radios dressed as micro pills/cards */}
                <div className="grid grid-cols-3 gap-1.5" id="recurrence-type-selector">
                  <button
                    type="button"
                    onClick={() => setRepeatType('none')}
                    className={`py-1.5 px-2 text-[10px] font-black rounded-lg border text-center transition-all cursor-pointer ${
                      repeatType === 'none'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    Não Repetir
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType('indefinitely')}
                    className={`py-1.5 px-2 text-[10px] font-black rounded-lg border text-center transition-all cursor-pointer ${
                      repeatType === 'indefinitely'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                    title="Repete semanalmente por período indeterminado (~6 meses de salvaguarda)"
                  >
                    Indeterminado
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType('defined')}
                    className={`py-1.5 px-2 text-[10px] font-black rounded-lg border text-center transition-all cursor-pointer ${
                      repeatType === 'defined'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    Determinado
                  </button>
                </div>

                {/* Sub-inputs dependent on selection */}
                {repeatType === 'indefinitely' && (
                  <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-[10px] text-blue-900 leading-normal font-medium animate-fade-in">
                    ℹ️ A escala se repetirá semanalmente pelos próximos **6 meses (24 semanas)** como limite de conformidade operacional.
                  </div>
                )}

                {repeatType === 'defined' && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-755 text-slate-700 uppercase">
                      Quantidade de semanas a repetir
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={52}
                        required={repeatType === 'defined'}
                        value={repeatWeeks}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(52, parseInt(e.target.value) || 1));
                          setRepeatWeeks(String(val));
                        }}
                        className="w-16 text-xs px-2 py-1 border border-slate-200 rounded focus:ring-2 focus:ring-blue-600 text-slate-800 font-mono font-bold bg-slate-50"
                      />
                      <span className="text-xs text-slate-500 font-medium leading-none">
                        semanas consecutivas (+ {repeatWeeks ? parseInt(repeatWeeks) * 7 : 0} dias)
                      </span>
                    </div>
                  </div>
                )}
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
                  Escalar
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
                type="button"
                onClick={() => setEditingEscalation(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEscalation} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Nº Atendimento (8 dígitos)</label>
                <input
                  type="text"
                  placeholder="Ex: 12345678"
                  maxLength={8}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                  value={editingEscalation.atendimento}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setEditingEscalation({ ...editingEscalation, atendimento: onlyNums });
                  }}
                />
              </div>

              {/* Unplanned ICU for Edit Modal */}
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="edit-unplanned-icu"
                  checked={!!editingEscalation.utiNaoProgramada}
                  onChange={(e) => {
                    setEditingEscalation({ ...editingEscalation, utiNaoProgramada: e.target.checked });
                  }}
                  className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="edit-unplanned-icu" className="text-xs font-bold text-slate-700" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  UTI não programada?
                </label>
              </div>

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
                <h3 className="text-sm font-bold font-display">Finalizar procedimento</h3>
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
                    <p className="font-mono text-rose-600 font-bold">{formatMinutesToHoursAndMins(parseInt(formatDurationPure(roomToFinalize.entrada)))}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Horário de Saída (Fim):
                  </label>
                  <input
                    type="time"
                    required
                    value={finalizeExitTime}
                    onChange={(e) => setFinalizeExitTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 text-slate-800 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Nº Atendimento (8 dígitos):
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Ex: 12345678"
                    value={finalizeAtendimento}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/\D/g, '');
                      setFinalizeAtendimento(onlyNums);
                      setFinalizeError('');
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 text-slate-800 bg-white font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="finalize-unplanned-icu"
                    checked={finalizeUtiNaoProgramada}
                    onChange={(e) => {
                      setFinalizeUtiNaoProgramada(e.target.checked);
                      setFinalizeError('');
                    }}
                    className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer animate-fade-in"
                  />
                  <label htmlFor="finalize-unplanned-icu" className="font-bold text-slate-700 uppercase cursor-pointer select-none">
                    UTI não programada?
                  </label>
                </div>
              </div>

              {finalizeError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-850 rounded-lg p-3 text-xs font-semibold animate-fade-in">
                  ⚠️ {finalizeError}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Ao clicar em confirmar, a ocupação desta sala será finalizada com o horário de saída selecionado acima, e o anestesista retornará automaticamente para a lista de <strong>médicos disponíveis</strong>.
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
                    const amtClean = finalizeAtendimento.trim();
                    if (finalizeUtiNaoProgramada && !amtClean) {
                      setFinalizeError('O número de atendimento é obrigatório para casos de UTI não programada.');
                      return;
                    }
                    if (amtClean !== '' && !/^\d{8}$/.test(amtClean)) {
                      setFinalizeError('O número de atendimento médico deve conter exatamente 8 dígitos numéricos.');
                      return;
                    }
                    handleFinalizeEscalation(roomToFinalize.id, finalizeExitTime, amtClean, finalizeUtiNaoProgramada);
                    setRoomToFinalize(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  <Check className="h-4 w-4" /> Finalizar
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
                  {activeCardModal === 'unplanned_icu' && 'Detalhamento de UTIs Não Programadas (Hoje)'}
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
              {activeCardModal === 'unplanned_icu' && (
                todayUnplannedIcuEscalations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 italic text-center">Nenhuma UTI não programada registrada hoje.</p>
                ) : (
                  todayUnplannedIcuEscalations.map(esc => (
                    <div key={esc.id} className="py-3 flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold text-slate-800">{esc.doctorName}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">
                          Setor: {esc.setorNome} - {esc.salaNome}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          Atendimento: <strong className="text-rose-600">#{esc.atendimento}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] bg-rose-100 text-rose-900 font-bold px-1.5 py-0.5 rounded font-mono uppercase">
                          Saída: {esc.saida ? new Date(esc.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Ativo'}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeCardModal === 'present' && (
                <div className="space-y-4 pt-1">
                  
                  {/* Toggle header inside modal */}
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-sidebar-divider">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Médicos Presentes ({present.length})</span>
                  </div>

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
                                activeEsc ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {activeEsc ? 'Escalado' : 'Disponível'}
                              </span>
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
                            CRM {doc.crm} • Aguardando há <strong className={isIdle60 ? "font-extrabold text-amber-900" : ""}>{formatMinutesToHoursAndMins(parseInt(doc.durationText || '0'))}</strong>
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
                          {formatMinutesToHoursAndMins(parseInt(doc.durationText || '0'))}
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
