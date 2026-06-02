import { useState, useMemo } from 'react';
import { AuditLog, UserSession } from '../types';
import { Fingerprint, Search, Calendar, BadgeAlert, AlertCircle, RefreshCw } from 'lucide-react';

interface AuditoriaTabProps {
  session: UserSession;
}

export default function AuditoriaTab({ session }: AuditoriaTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    return JSON.parse(localStorage.getItem('unita_audit') || '[]');
  });

  const [search, setSearch] = useState('');
  const [actionCategory, setActionCategory] = useState('');

  const refreshLogs = () => {
    setLogs(JSON.parse(localStorage.getItem('unita_audit') || '[]'));
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.resumo.toLowerCase().includes(search.toLowerCase()) || 
                          log.usuario.toLowerCase().includes(search.toLowerCase()) || 
                          (log.justificativa?.toLowerCase() || '').includes(search.toLowerCase());
      
      const matchCat = actionCategory === '' || log.acao === actionCategory;
      return matchSearch && matchCat;
    });
  }, [logs, search, actionCategory]);

  const uniqueActions = [
    'Nova escala',
    'Edição de escala',
    'Finalização',
    'Exclusão de escala',
    'Cadastro de plantonista',
    'Exclusão de plantonista',
    'Entrada no plantão',
    'Saída do plantão',
    'Alteração de coordenador'
  ];

  return (
    <div className="space-y-6" id="auditoria-tab-container">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display flex items-center gap-2">
            <Fingerprint className="h-5.5 w-5.5 text-slate-500" />
            Trilha de Auditoria Geral
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registro oficial de manipulações operacionais de escala, cadastros e cancelamentos
          </p>
        </div>

        <button
          onClick={refreshLogs}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" /> Atualizar Logs
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-4 rounded-xl border border-slate-200 no-print">
        <div className="sm:col-span-8 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="audit-search-input"
            type="text"
            className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            placeholder="Filtrar por usuário, ação, justificativa ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sm:col-span-4">
          <select
            id="audit-category-select"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value)}
          >
            <option value="">Todas as Ações</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Registro Cronológico</h3>
          <span className="text-[10px] text-slate-400 font-mono">{filteredLogs.length} eventos listados</span>
        </div>

        <div className="divide-y divide-slate-150 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">
              Nenhum evento registrado correspondente aos critérios de busca.
            </div>
          ) : (
            filteredLogs.map(log => {
              // Custom colors depending on action type
              let tagStyle = 'bg-slate-100 text-slate-700 border-slate-200';
              if (log.acao.startsWith('Nova')) {
                tagStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';
              } else if (log.acao.startsWith('Edição')) {
                tagStyle = 'bg-amber-50 text-amber-700 border-amber-100';
              } else if (log.acao.startsWith('Exclusão')) {
                tagStyle = 'bg-rose-50 text-rose-700 border-rose-100';
              } else if (log.acao.startsWith('Finalização')) {
                tagStyle = 'bg-blue-50 text-blue-700 border-blue-100';
              }

              return (
                <div key={log.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/50 transition-all">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagStyle}`}>
                        {log.acao}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs text-slate-600 font-mono">
                        ID: {log.id}
                      </span>
                    </div>

                    <p className="text-xs text-slate-900 font-medium leading-relaxed">
                      {log.resumo}
                    </p>

                    {/* Show Justification comment if present */}
                    {log.justificativa && (
                      <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 flex items-start gap-2 text-[11px] text-amber-800 leading-normal">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold block uppercase tracking-wider text-[9px] text-amber-900 mb-0.5">Justificativa Declarada:</strong>
                          {log.justificativa}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata: Actor, Timestamp */}
                  <div className="sm:text-right shrink-0 space-y-1 font-mono text-[10px]">
                    <div className="text-slate-800 font-semibold flex items-center gap-1 sm:justify-end">
                      <span>Operador:</span>
                      <span className="bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded font-mono font-bold">{log.usuario}</span>
                    </div>
                    <div className="text-slate-400 uppercase tracking-wide">
                      {log.perfil === 'administrador' ? 'Perfil: ADMIN' : 'Perfil: COORD'}
                    </div>
                    <div className="text-slate-400 flex items-center gap-1 sm:justify-end">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
