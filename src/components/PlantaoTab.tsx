import React, { useState, useEffect } from 'react';
import { Doctor, ShiftConfig, UserSession } from '../types';
import { Clock, UserCheck, ShieldAlert, Save, Award, Hourglass, ToggleLeft, ToggleRight } from 'lucide-react';
import { logSystemEvent } from '../utils';

interface PlantaoTabProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  session: UserSession;
}

export default function PlantaoTab({ doctors, setDoctors, session }: PlantaoTabProps) {
  const [shiftStart, setShiftStart] = useState('07:00');
  const [shiftEnd, setShiftEnd] = useState('19:00');
  const [selectedCoords, setSelectedCoords] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const shift: ShiftConfig = JSON.parse(
      localStorage.getItem('unita_shift') || '{"coordenadores":["d20"],"inicio":"07:00","fim":"19:00"}'
    );
    setShiftStart(shift.inicio);
    setShiftEnd(shift.fim);
    setSelectedCoords(shift.coordenadores);
  }, []);

  const handleApplyPreset = (start: string, end: string) => {
    if (session.perfil !== 'administrador') {
      alert('Somente Administradores podem redefinir o período ou presets do plantão.');
      return;
    }
    setShiftStart(start);
    setShiftEnd(end);
  };

  const handleCoordinatorToggle = (docId: string) => {
    if (session.perfil !== 'administrador') {
      alert('Somente Administradores podem definir os coordenadores do plantão do dia.');
      return;
    }

    if (selectedCoords.includes(docId)) {
      setSelectedCoords(selectedCoords.filter(id => id !== docId));
    } else {
      if (selectedCoords.length >= 2) {
        alert('O expediente operacional permite no máximo 2 Coordenadores ativos em paralelo.');
        return;
      }
      setSelectedCoords([...selectedCoords, docId]);
    }
  };

  const handleSaveConfig = () => {
    if (session.perfil !== 'administrador') {
      alert('Apenas Administradores têm permissão para gravar mudanças de escala geral.');
      return;
    }

    const newConf: ShiftConfig = {
      coordenadores: selectedCoords,
      inicio: shiftStart,
      fim: shiftEnd
    };

    localStorage.setItem('unita_shift', JSON.stringify(newConf));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    // Grab coordinator names to log
    const coordNames = doctors
      .filter(d => selectedCoords.includes(d.id))
      .map(d => d.nome)
      .join(', ') || 'Nenhum';

    logSystemEvent(
      session.usuario,
      session.perfil,
      'Alteração de coordenador',
      `Configuração salva. Horário: ${shiftStart} às ${shiftEnd}. Coordenadores: ${coordNames}`
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="plantao-tab-container">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 font-display">Parâmetros Operacionais do Plantão</h2>
        <p className="text-xs text-slate-500 mt-1">
          Ajuste as janelas de escala do dia e a liderança médica coordenadora responsável
        </p>
      </div>

      {session.perfil !== 'administrador' && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/80 flex items-start gap-3 text-xs leading-relaxed text-amber-800">
          <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Modo de Apenas Leitura:</span> Você está logado como Coordenador do Plantão diurno. Apenas Administradores podem redefinir o time coordenador do dia ou alterar os limites formais de horários da escala.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Timing parameters (5 cols) */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 md:col-span-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" /> Horários do Plantão do Dia
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase">Abertura</label>
                <input
                  id="shift-start-input"
                  type="time"
                  disabled={session.perfil !== 'administrador'}
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-blue-600 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase font-mono">Encerramento</label>
                <input
                  id="shift-end-input"
                  type="time"
                  disabled={session.perfil !== 'administrador'}
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-blue-600 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Atalhos Operacionais Rápidos</span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  id="preset-diurno-completo"
                  onClick={() => handleApplyPreset('07:00', '19:00')}
                  disabled={session.perfil !== 'administrador'}
                  className="text-left px-3 py-2 border border-slate-100 rounded-lg text-xs hover:bg-slate-50 transition-all font-medium text-slate-700 flex justify-between items-center bg-slate-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <span className="font-semibold">Plantão Diurno Completo</span>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">12h (07h-19h)</span>
                </button>

                <button
                  type="button"
                  id="preset-diurno-manha"
                  onClick={() => handleApplyPreset('07:00', '13:00')}
                  disabled={session.perfil !== 'administrador'}
                  className="text-left px-3 py-2 border border-slate-100 rounded-lg text-xs hover:bg-slate-50 transition-all font-medium text-slate-700 flex justify-between items-center bg-slate-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <span className="font-semibold">Plantão Parcial - Manhã</span>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">6h (07h-13h)</span>
                </button>

                <button
                  type="button"
                  id="preset-diurno-tarde"
                  onClick={() => handleApplyPreset('13:00', '19:00')}
                  disabled={session.perfil !== 'administrador'}
                  className="text-left px-3 py-2 border border-slate-100 rounded-lg text-xs hover:bg-slate-50 transition-all font-medium text-slate-700 flex justify-between items-center bg-slate-50/50 disabled:opacity-50 cursor-pointer"
                >
                  <span className="font-semibold">Plantão Parcial - Tarde</span>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">6h (13h-19h)</span>
                </button>
              </div>
            </div>
          </div>

          {session.perfil === 'administrador' && (
            <div className="pt-4 border-t border-slate-100/80 mt-auto">
              <button
                type="button"
                id="save-shift-settings-btn"
                onClick={handleSaveConfig}
                className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Configuração</span>
              </button>
              {saveSuccess && (
                <p className="text-[10px] text-emerald-600 text-center font-mono font-medium mt-2">
                  ✓ Configurações de escala gravadas com sucesso!
                </p>
              )}
            </div>
          )}
        </section>

        {/* Coordenadores Configuration (7 cols) */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 md:col-span-7 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
              <Award className="h-4 w-4 text-slate-400" /> Coordenadores do Dia (Máximo 2)
            </h3>
            <p className="text-xs text-slate-500">
              Coordenadores selecionados possuem autonomia administrativa local, mas também são médicos anestesiologistas escaláveis e integráveis às salas de cirurgia normalmente.
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {doctors.map(doc => {
                const isSelected = selectedCoords.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleCoordinatorToggle(doc.id)}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-200 font-semibold'
                        : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                    } ${session.perfil === 'administrador' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div>
                      <div className="text-slate-800">{doc.nome}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{doc.crm}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <span className="text-[10px] text-blue-700 font-mono bg-blue-100/80 px-2 py-0.5 rounded font-semibold flex items-center gap-1 shrink-0">
                          <UserCheck className="h-3 w-3" /> Coordenador
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Escalável normal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
