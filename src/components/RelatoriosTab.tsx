import { useState, useMemo } from 'react';
import { Doctor, Escalation, UserSession } from '../types';
import { Printer, CalendarDays, BarChart2, Table, Award, Hourglass, HelpCircle } from 'lucide-react';
import { formatDurationPure } from '../utils';

interface RelatoriosTabProps {
  doctors: Doctor[];
  escalations: Escalation[];
  session: UserSession;
}

type FilterRange = 'dia' | 'semana' | 'mes';

interface DoctorRate {
  id: string;
  nome: string;
  crm: string;
  horasTrabalhadas: number;
  atosRealizados: number;
  tempoDisponivelMin: number; // minutes
}

export default function RelatoriosTab({ doctors, escalations, session }: RelatoriosTabProps) {
  const [range, setRange] = useState<FilterRange>('dia');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter escalations according to the selected range
  const filteredEscalations = useMemo(() => {
    const now = new Date();
    return escalations.filter(esc => {
      if (range === 'dia') {
        return esc.data === todayStr;
      } else if (range === 'semana') {
        // Last 7 days
        const escDate = new Date(esc.data);
        const diffTime = Math.abs(now.getTime() - escDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      } else {
        // Last 30 days
        const escDate = new Date(esc.data);
        const diffTime = Math.abs(now.getTime() - escDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
    });
  }, [escalations, range, todayStr]);

  // Aggregate metrics per doctor
  const aggregatedReport = useMemo(() => {
    const report: Record<string, DoctorRate> = {};

    // Prep with all active doctors
    doctors.forEach(doc => {
      report[doc.id] = {
        id: doc.id,
        nome: doc.nome,
        crm: doc.crm,
        horasTrabalhadas: 0,
        atosRealizados: 0,
        tempoDisponivelMin: 0
      };

      // Realtime available wait time: if they are currently available, we look at their availableSince timestamp
      const isActiveScale = escalations.some(e => e.ativa && e.doctorID === doc.id);
      if (!isActiveScale && doc.presente && doc.disponivelDesde) {
        const availableSince = new Date(doc.disponivelDesde).getTime();
        const diffMins = Math.max(0, Math.floor((Date.now() - availableSince) / 60000));
        report[doc.id].tempoDisponivelMin += diffMins;
      }
    });

    // Add hours & acts from filtered escalations
    filteredEscalations.forEach(esc => {
      if (!report[esc.doctorID]) return; // handle deleted doctors anomalies

      // Calculate hours
      let durationHours = esc.horasManual;
      if (durationHours === undefined) {
        const entry = new Date(esc.entrada).getTime();
        const exit = esc.saida ? new Date(esc.saida).getTime() : Date.now();
        const durationMins = Math.max(0, Math.floor((exit - entry) / 60000));
        durationHours = parseFloat((durationMins / 60).toFixed(1));
      }

      report[esc.doctorID].horasTrabalhadas += durationHours;
      report[esc.doctorID].atosRealizados += esc.atosRealizados;
    });

    // Sort according to the strict requested specification:
    // 1. Principal: maior número de horas trabalhadas (descendente)
    // 2. Desempate: maior quantidade de atos/blocos realizados (descendente)
    // 3. Se empatar ainda: ordem alfabética (ascendente)
    return Object.values(report).sort((a, b) => {
      if (b.horasTrabalhadas !== a.horasTrabalhadas) {
        return b.horasTrabalhadas - a.horasTrabalhadas;
      }
      if (b.atosRealizados !== a.atosRealizados) {
        return b.atosRealizados - a.atosRealizados;
      }
      return a.nome.localeCompare(b.nome);
    });
  }, [doctors, filteredEscalations, escalations]);

  // Max value to calibrate bar chart width dynamically
  const maxHours = useMemo(() => {
    return Math.max(...aggregatedReport.map(r => r.horasTrabalhadas), 1);
  }, [aggregatedReport]);

  const handlePrint = () => {
    window.print();
  };

  // Safe formatting helpers for Brazilian standards
  const formatHourString = (hours: number): string => {
    return hours.toFixed(1).replace('.', ',');
  };

  const formatMinString = (totalMins: number): string => {
    if (totalMins < 60) return `${totalMins}min`;
    const hours = totalMins / 60;
    return `${hours.toFixed(1).replace('.', ',')}h`;
  };

  return (
    <div className="space-y-6" id="relatorios-tab-container">
      
      {/* Filters HUD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            Relatório de Produtividade Médica
          </h2>
          <p className="text-xs text-slate-500">Métricas consolidadas de horas e atos de anestesiologia</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRange('dia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              range === 'dia' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hoje / Diário
          </button>
          <button
            onClick={() => setRange('semana')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              range === 'semana' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Esta Semana (7D)
          </button>
          <button
            onClick={() => setRange('mes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              range === 'mes' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Este Mês (30D)
          </button>

          <span className="text-slate-300 mx-1">|</span>

          {/* PDF Browser print action */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* PRINT-ONLY HEADER FOR REFRESHING PAPERS */}
      <div className="hidden print-only text-slate-900 space-y-2 pb-4 border-b border-slate-350 bg-white">
        <h1 className="text-2xl font-bold">Relatório Operacional - Unitá Anestesia</h1>
        <p className="text-xs font-mono">
          Período: {range === 'dia' ? 'Plantão Diurno de Hoje' : range === 'semana' ? 'Últimos 7 Dias' : 'Último Mês (30 Dias)'}
        </p>
        <p className="text-[10px] text-slate-400 font-mono">Exportado em: {new Date().toLocaleString('pt-BR')}</p>
      </div>

      {/* 1. VISUAL RANKING / BAR CHART */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 page-break-after">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="h-4 w-4 text-slate-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 font-display">Ranking de Produtividade (Horas Trabalhadas)</h3>
        </div>

        <div className="space-y-4 max-w-3xl">
          {aggregatedReport.slice(0, 8).map((rate, idx) => {
            const percentage = (rate.horasTrabalhadas / maxHours) * 100;
            return (
              <div key={rate.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 font-mono flex items-center justify-center border border-slate-200 shrink-0 select-none">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 font-display">{rate.nome}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{rate.crm}</span>
                  </div>
                  <div className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded leading-none">
                    {formatHourString(rate.horasTrabalhadas)} horas
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                    <div
                      style={{ width: `${Math.max(2, percentage)}%` }}
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                    {rate.atosRealizados} atos
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. TABLE DE CONFERÊNCIA (VERIFICATION WORKSHEET) */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between no-print">
          <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
            <Table className="h-4 w-4 text-slate-400" />
            Tabela de Conferência Oficial
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">Ordenação: Horas Trabalhadas &rarr; Atos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] font-mono border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Posição</th>
                <th className="py-3.5 px-4">Anestesiologista</th>
                <th className="py-3.5 px-4 text-center">Horas de Escala</th>
                <th className="py-3.5 px-4 text-center">Atos / Blocos</th>
                <th className="py-3.5 px-4 text-center">Tempo Disponível (Hoje)</th>
                <th className="py-3.5 px-6 text-right">Eficiência Atos/H</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {aggregatedReport.map((rate, idx) => {
                const efficiency = rate.horasTrabalhadas > 0 
                  ? (rate.atosRealizados / rate.horasTrabalhadas).toFixed(2).replace('.', ',') 
                  : '0,00';

                return (
                  <tr key={rate.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="py-3 px-6 font-mono font-bold text-slate-500">{idx + 1}º</td>
                    <td className="py-3 px-4 font-semibold text-slate-950">
                      <div>{rate.nome}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">{rate.crm}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-800">
                      {formatHourString(rate.horasTrabalhadas)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {rate.atosRealizados}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {formatMinString(rate.tempoDisponivelMin)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-slate-600 font-medium">
                      {efficiency}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
