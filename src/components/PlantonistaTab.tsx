import React, { useState, useMemo } from 'react';
import { Doctor, UserSession, DailyPresence } from '../types';
import { UserPlus, ToggleLeft, ToggleRight, Trash2, Mail, ShieldAlert, BadgeCheck, Phone, FileText, X, Sparkles, Check } from 'lucide-react';
import { logSystemEvent } from '../utils';
import UnitaLogo from './UnitaLogo';

interface PlantonistaTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  session: UserSession;
  dailyPresences: DailyPresence[];
  setDailyPresences: React.Dispatch<React.SetStateAction<DailyPresence[]>>;
}

export default function PlantonistaTab({
  doctors,
  setDoctors,
  session,
  dailyPresences,
  setDailyPresences
}: PlantonistaTabProps) {
  const [nome, setNome] = useState('');
  const [crm, setCrm] = useState('');
  const [celular, setCelular] = useState('');
  const [autoScale, setAutoScale] = useState(true);
  const [isAdminGrant, setIsAdminGrant] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

  // Doctor delete dialog state
  const [deletingDoc, setDeletingDoc] = useState<Doctor | null>(null);
  const [reason, setReason] = useState('');

  // If coordinator somehow bypasses sidebar, show unauthorized page
  if (session.perfil !== 'administrador') {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-rose-100 max-w-lg mx-auto space-y-4">
        <ShieldAlert className="h-12 w-12 text-rose-600 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 font-display">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sua licença atual de <strong>Coordenador</strong> não permite cadastrar ou remover plantonistas no sistema Hospitalar. Por favor, contate o administrador central.
        </p>
      </div>
    );
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSuccessMsg('');

    if (!nome.trim() || !crm.trim() || !celular.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios do cadastro.');
      return;
    }

    const uniqueId = `d-${Date.now()}`;
    const newDoc: Doctor = {
      id: uniqueId,
      nome: nome.trim(),
      crm: crm.trim().toUpperCase(),
      celular: celular.trim(),
      afinidade: '', // Removido afinidade conforme solicitação
      presente: autoScale, // immediately present if autoScale is active
      disponivelDesde: new Date().toISOString()
    };

    const updatedDoctors = [...doctors, newDoc];
    setDoctors(updatedDoctors);
    localStorage.setItem('unita_doctors', JSON.stringify(updatedDoctors));

    // Automatically list / schedule on Plantão for Today and Tomorrow if autoScale is active
    if (autoScale && setDailyPresences && dailyPresences) {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

      const p1: DailyPresence = {
        id: `pres-${uniqueId}-${todayStr}`,
        date: todayStr,
        doctorID: uniqueId,
        shiftType: '12h'
      };

      const p2: DailyPresence = {
        id: `pres-${uniqueId}-${tomorrowStr}`,
        date: tomorrowStr,
        doctorID: uniqueId,
        shiftType: '12h'
      };

      const updatedPres = [...dailyPresences, p1, p2];
      setDailyPresences(updatedPres);
      localStorage.setItem('unita_daily_presences', JSON.stringify(updatedPres));
    }

    // Audit action
    logSystemEvent(
      session.usuario,
      session.perfil,
      'Cadastro de plantonista',
      `Cadastrou plantonista ${newDoc.nome} (${newDoc.crm}). ${autoScale ? 'Auto-escalado nos plantões (Hoje e Amanhã).' : 'Disponibilizado de imediato.'}`
    );

    // Simulate Admin invite email status response
    if (isAdminGrant && inviteEmail) {
      setInviteSuccessMsg(`Link de convite de conta de administrador enviado sob sigilo com sucesso para ${inviteEmail}!`);
    }

    // Reset Form Fields
    setNome('');
    setCrm('');
    setCelular('');
    setIsAdminGrant(false);
    setInviteEmail('');
  };

  const openDeleteDialog = (doc: Doctor) => {
    setDeletingDoc(doc);
    setReason('');
  };

  const handleDeleteDoctorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingDoc) return;

    if (!reason.trim()) {
      alert('Justificativa para descredenciar médico é obrigatória.');
      return;
    }

    // Filter array
    const filtered = doctors.filter(d => d.id !== deletingDoc.id);
    setDoctors(filtered);
    localStorage.setItem('unita_doctors', JSON.stringify(filtered));

    // Log deletion event
    logSystemEvent(
      session.usuario,
      session.perfil,
      'Exclusão de plantonista',
      `Excluiu cadastro do plantonista ${deletingDoc.nome} (${deletingDoc.crm}).`,
      reason
    );

    setDeletingDoc(null);
  };

  return (
    <div className="space-y-8" id="plantonistas-tab-container">
      {/* Title */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
        <UnitaLogo size={36} className="p-1 rounded-lg bg-slate-50 border border-slate-100 shadow-3xs" />
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Novo Cadastro</h2>
          <p className="text-xs text-slate-500 mt-1">
            Painel confidencial para inclusão de novos anestesiologistas na base geral e escala de plantão
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form panel (5 cols) */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 md:col-span-5 self-start shadow-3xs">
          <h3 className="text-sm font-bold text-slate-800 font-display mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-slate-400" /> Formulário de Novo Cadastro
          </h3>

          <form onSubmit={handleRegister} className="space-y-4">
            
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Nome Completo</label>
              <input
                id="doc-name-input"
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:ring-1 focus:ring-blue-600"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Dra. Juliana Siqueira"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">CRM Nacional</label>
              <input
                id="doc-crm-input"
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:ring-1 focus:ring-blue-600"
                value={crm}
                onChange={(e) => setCrm(e.target.value)}
                placeholder="Ex: CRM 120934-SP"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Celular de Contato</label>
              <input
                id="doc-phone-input"
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:ring-1 focus:ring-blue-600"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="Ex: (11) 98765-1100"
              />
            </div>

            {/* Auto-scaler mechanism option */}
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex flex-col gap-1.5 shadow-3xs">
              <button
                type="button"
                id="doc-autoscale-toggle"
                onClick={() => setAutoScale(!autoScale)}
                className="flex items-center justify-between text-xs font-extrabold text-blue-900 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                  Auto-escalar nos Plantões
                </span>
                {autoScale ? (
                  <ToggleRight className="h-6 w-6 text-blue-600" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-slate-400" />
                )}
              </button>
              <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                Ao marcar esta opção, o médico constará no banco de dados geral e será adicionado <strong>automaticamente</strong> para escalabilidade direta nos plantões (Hoje e Amanhã).
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                id="doc-admin-grant-toggle"
                onClick={() => setIsAdminGrant(!isAdminGrant)}
                className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer"
              >
                <span>Conceder privilégios de admin</span>
                {isAdminGrant ? (
                  <ToggleRight className="h-6 w-6 text-blue-600" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-slate-400" />
                )}
              </button>

              {isAdminGrant && (
                <div className="space-y-1 pt-1.5 border-t border-slate-200/60 animate-in fade-in duration-150">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">E-mail para convite de admin</span>
                  <div className="relative rounded-lg shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <input
                      id="doc-admin-email-input"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@unita.com.br"
                      className="block w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded text-[11px] bg-white text-slate-800 shadow-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {inviteSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[10px]">
                {inviteSuccessMsg}
              </div>
            )}

            <button
              id="doc-submit-btn"
              type="submit"
              className="w-full inline-flex justify-center items-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Criar Novo Cadastro
            </button>
          </form>
        </section>

        {/* List panel (7 cols) */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 md:col-span-7 flex flex-col h-full justify-between shadow-3xs">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-display mb-4">Anestesiologistas Credenciados ({doctors.length})</h3>

            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              {doctors.map(doc => (
                <div key={doc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-150 flex items-center justify-between hover:border-slate-300 transition-all">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 font-display">
                        {doc.nome}
                      </span>
                      {doc.disponivelDesde === '' && (
                        <span className="bg-slate-200 text-slate-700 px-1 rounded text-[9px] font-mono">Simulação</span>
                      )}
                    </div>
                    
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3">
                      <span>{doc.crm}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{doc.celular}</span>
                    </div>
                  </div>

                  {/* Deletions available to Admin */}
                  <button
                    onClick={() => openDeleteDialog(doc)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                    title="Excluir Plantonista"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      {deletingDoc && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-rose-900 text-white flex justify-between items-center animate-in slide-in-from-top-4 duration-150">
              <div>
                <h3 className="text-sm font-bold font-display">Descredenciar Profissional</h3>
                <p className="text-[11px] text-rose-300">Ação permanente de auditoria</p>
              </div>
              <button
                onClick={() => setDeletingDoc(null)}
                className="p-1 hover:bg-rose-850 text-rose-300 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteDoctorSubmit} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800 leading-relaxed">
                Está prestes a expurgar o prontuário de <strong className="text-rose-950">{deletingDoc.nome}</strong>. Esta ação remove a habilidade de agendar escalas imediatamente.
              </div>

              {/* Reason / Justification is required */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Motivo da Desvinculação <span className="text-rose-500 font-bold">*</span>
                </label>
                <textarea
                  id="doctor-delete-reason-input"
                  required
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-600 bg-slate-50 text-slate-800"
                  placeholder="Justifique o credenciamento de baixa ou demissão..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDeletingDoc(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white font-semibold bg-rose-600 hover:bg-rose-700 rounded transition-all shadow-sm cursor-pointer"
                >
                  Descredenciar e Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
