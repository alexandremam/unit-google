import { useState, useMemo, useEffect } from 'react';
import { Doctor, Escalation, UserSession, AuditLog } from '../types';
import {
  Printer,
  CalendarDays,
  BarChart2,
  Table,
  Award,
  Hourglass,
  HelpCircle,
  Fingerprint,
  Search,
  Calendar,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Clock,
  Shield,
  ListFilter,
  CheckCircle2,
  Info,
  Sparkles,
  ChevronDown,
  ArrowUpDown,
  History,
  Activity,
  User
} from 'lucide-react';
import { formatDurationPure } from '../utils';
import UnitaLogo from './UnitaLogo';

interface RelatoriosTabProps {
  doctors: Doctor[];
  escalations: Escalation[];
  session: UserSession;
  defaultSubTab?: SubTabType;
  onChangeSubTab?: (subTab: SubTabType) => void;
}

type FilterRange = 'dia' | 'mes';
type SubTabType = 'desempenho' | 'auditoria' | 'uti';

interface DoctorRate {
  id: string;
  nome: string;
  crm: string;
  horasTrabalhadas: number;
  atosRealizados: number;
  tempoDisponivelMin: number; // minutes
  cirurgiasConcluidas: number;
}

export default function RelatoriosTab({ doctors, escalations, session, defaultSubTab = 'desempenho', onChangeSubTab }: RelatoriosTabProps) {
  // Main view segment sub-tab selector
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>(defaultSubTab);

  // Sync active sub-tab when defaultSubTab changes at the parent level
  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const handleSubTabChange = (tab: SubTabType) => {
    setActiveSubTab(tab);
    if (onChangeSubTab) {
      onChangeSubTab(tab);
    }
  };
  const [range, setRange] = useState<FilterRange>('dia');

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchLog, setSearchLog] = useState('');
  const [logCategory, setLogCategory] = useState('');
  
  // Doctors performance filters & search
  const [searchDocName, setSearchDocName] = useState('');
  const [docSortField, setDocSortField] = useState<'name' | 'hours' | 'acts' | 'efficiency'>('hours');
  const [docSortAsc, setDocSortAsc] = useState(false);

  // UTI não programada report filters state
  const [utiFilterType, setUtiFilterType] = useState<'diario' | 'mensal'>('diario');
  const [utiSelectedDate, setUtiSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [utiSelectedMonth, setUtiSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Initialize and load Audit logs
  const loadLogs = () => {
    try {
      const storedLogs = JSON.parse(localStorage.getItem('unita_audit') || '[]');
      setLogs(storedLogs);
    } catch (e) {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeSubTab]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter scales according to selected range
  const filteredEscalations = useMemo(() => {
    const now = new Date();
    return escalations.filter(esc => {
      if (range === 'dia') {
        return esc.data === todayStr;
      } else {
        const escDate = new Date(esc.data);
        const diffTime = Math.abs(now.getTime() - escDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
    });
  }, [escalations, range, todayStr]);

  // Aggregate stats per doctor
  const aggregatedReport = useMemo(() => {
    const report: Record<string, DoctorRate> = {};

    doctors.forEach(doc => {
      report[doc.id] = {
        id: doc.id,
        nome: doc.nome,
        crm: doc.crm,
        horasTrabalhadas: 0,
        atosRealizados: 0,
        tempoDisponivelMin: 0,
        cirurgiasConcluidas: 0
      };

      // Realtime wait duration calculation 
      const isActiveScale = escalations.some(e => e.ativa && e.doctorID === doc.id);
      if (!isActiveScale && doc.presente && doc.disponivelDesde) {
        const availableSince = new Date(doc.disponivelDesde).getTime();
        const diffMins = Math.max(0, Math.floor((Date.now() - availableSince) / 60000));
        report[doc.id].tempoDisponivelMin += diffMins;
      }
    });

    // Populate active and archived schedules
    filteredEscalations.forEach(esc => {
      if (!report[esc.doctorID]) return; // handle deleted anomalies safely

      let durationHours = esc.horasManual;
      if (durationHours === undefined) {
        const entry = new Date(esc.entrada).getTime();
        const exit = esc.saida ? new Date(esc.saida).getTime() : Date.now();
        const durationMins = Math.max(0, Math.floor((exit - entry) / 60000));
        durationHours = parseFloat((durationMins / 60).toFixed(1));
      }

      report[esc.doctorID].horasTrabalhadas += durationHours;
      report[esc.doctorID].atosRealizados += esc.atosRealizados;
      if (!esc.ativa) {
        report[esc.doctorID].cirurgiasConcluidas += 1;
      }
    });

    // Build lists and perform flexible table sort conversions
    let list = Object.values(report);

    // Apply Search Box filtering
    if (searchDocName.trim()) {
      const term = searchDocName.toLowerCase();
      list = list.filter(r => r.nome.toLowerCase().includes(term) || r.crm.toLowerCase().includes(term));
    }

    return list.sort((a, b) => {
      let comparison = 0;
      if (docSortField === 'name') {
        comparison = a.nome.localeCompare(b.nome);
      } else if (docSortField === 'hours') {
        comparison = a.horasTrabalhadas - b.horasTrabalhadas;
      } else if (docSortField === 'acts') {
        comparison = a.cirurgiasConcluidas - b.cirurgiasConcluidas;
      } else {
        const effA = a.horasTrabalhadas > 0 ? a.cirurgiasConcluidas / a.horasTrabalhadas : 0;
        const effB = b.horasTrabalhadas > 0 ? b.cirurgiasConcluidas / b.horasTrabalhadas : 0;
        comparison = effA - effB;
      }
      return docSortAsc ? comparison : -comparison;
    });
  }, [doctors, filteredEscalations, escalations, searchDocName, docSortField, docSortAsc]);

  // Max value to scale bar width dynamically
  const maxHours = useMemo(() => {
    return Math.max(...aggregatedReport.map(r => r.horasTrabalhadas), 1);
  }, [aggregatedReport]);

  // Compute stats card HUD values
  const totalWorkedHours = useMemo(() => {
    return aggregatedReport.reduce((acc, curr) => acc + curr.horasTrabalhadas, 0);
  }, [aggregatedReport]);

  const totalCirurgiasConcluidas = useMemo(() => {
    return aggregatedReport.reduce((acc, curr) => acc + curr.cirurgiasConcluidas, 0);
  }, [aggregatedReport]);

  const totalActs = useMemo(() => {
    return aggregatedReport.reduce((acc, curr) => acc + curr.atosRealizados, 0);
  }, [aggregatedReport]);

  const totalStandbyMins = useMemo(() => {
    return aggregatedReport.reduce((acc, curr) => acc + curr.tempoDisponivelMin, 0);
  }, [aggregatedReport]);

  const activeDoctorsCount = useMemo(() => {
    return aggregatedReport.filter(r => r.horasTrabalhadas > 0).length;
  }, [aggregatedReport]);

  const activationRate = useMemo(() => {
    return doctors.length > 0 ? Math.round((activeDoctorsCount / doctors.length) * 100) : 0;
  }, [activeDoctorsCount, doctors.length]);

  const averageActsPerActiveDoc = useMemo(() => {
    return activeDoctorsCount > 0 ? (totalActs / activeDoctorsCount).toFixed(1).replace('.', ',') : '0,0';
  }, [totalActs, activeDoctorsCount]);

  // Load date-coordinators data to calculate supervisor counts
  const coordinatorStats = useMemo(() => {
    const counts: Record<string, number> = {};
    try {
      const data = JSON.parse(localStorage.getItem('unita_date_coordinators') || '{}');
      Object.keys(data).forEach(date => {
        const ids = data[date];
        if (Array.isArray(ids)) {
          ids.forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
          });
        }
      });
    } catch (e) {
      console.error(e);
    }

    return doctors.map(doc => ({
      id: doc.id,
      nome: doc.nome,
      crm: doc.crm,
      count: counts[doc.id] || 0
    })).filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [doctors]);

  // Future scheduled presence density counts (Upcoming dates)
  const presenceTimelineData = useMemo(() => {
    const datesList: string[] = [];
    for (let i = -1; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      datesList.push(d.toLocaleDateString('en-CA'));
    }

    try {
      const dailyPres = JSON.parse(localStorage.getItem('unita_daily_presences') || '[]');
      return datesList.map(dateStr => {
        const scheduledCount = dailyPres.filter((p: any) => p.date === dateStr).length;
        const coordsCount = (JSON.parse(localStorage.getItem('unita_date_coordinators') || '{}')[dateStr] || []).length;
        
        // Human label
        const [y, m, d] = dateStr.split('-');
        const smallLabel = `${d}/${m}`;
        let alias = '';
        const todayStrLocal = new Date().toLocaleDateString('en-CA');
        if (dateStr === todayStrLocal) alias = 'Hoje';
        
        return {
          date: dateStr,
          label: smallLabel,
          alias,
          scheduledCount,
          coordsCount
        };
      });
    } catch (e) {
      return datesList.map(dateStr => ({ date: dateStr, label: dateStr, alias: '', scheduledCount: 0, coordsCount: 0 }));
    }
  }, [doctors]);

  // Equity track metrics per coordinator instructions
  const equityKPIs = useMemo(() => {
    // Only analyze doctors who worked hours or performed acts
    const activeDocs = aggregatedReport.filter(d => d.horasTrabalhadas > 0 || d.atosRealizados > 0);
    if (activeDocs.length <= 1) {
      return {
        hoursEquity: 100,
        actsEquity: 100,
        averageEquity: 100,
        gloriousReport: "Escala Com Equidade Máxima",
        gloriousColor: "text-emerald-700 bg-emerald-50 border-emerald-100",
        recommendation: "Equipe com distribuição perfeita de carga de trabalho e horários."
      };
    }

    // 1. Calculate hours equity
    const hours = activeDocs.map(d => d.horasTrabalhadas);
    const sumHours = hours.reduce((s, x) => s + x, 0);
    const meanHours = sumHours / hours.length;
    let stdevHours = 0;
    if (meanHours > 0) {
      const varianceHours = hours.reduce((s, x) => s + Math.pow(x - meanHours, 2), 0) / hours.length;
      stdevHours = Math.sqrt(varianceHours);
    }
    const cvHours = meanHours > 0 ? (stdevHours / meanHours) : 0;
    const hoursEquity = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, cvHours)) * 100)));

    // 2. Calculate acts equity
    const acts = activeDocs.map(d => d.atosRealizados);
    const sumActs = acts.reduce((s, x) => s + x, 0);
    const meanActs = sumActs / acts.length;
    let stdevActs = 0;
    if (meanActs > 0) {
      const varianceActs = acts.reduce((s, x) => s + Math.pow(x - meanActs, 2), 0) / acts.length;
      stdevActs = Math.sqrt(varianceActs);
    }
    const cvActs = meanActs > 0 ? (stdevActs / meanActs) : 0;
    const actsEquity = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, cvActs)) * 100)));

    const averageEquity = Math.round((hoursEquity + actsEquity) / 2);

    let gloriousReport = "Excelente Equidade";
    let gloriousColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
    let recommendation = "Parabéns! A escala está com excelente equilíbrio, garantindo distribuição saudável e isonômica de procedimentos anestésicos e tempo operacional.";

    if (averageEquity < 50) {
      gloriousReport = "Alta Desigualdade (Sugere Atenção)";
      gloriousColor = "text-rose-700 bg-rose-50 border-rose-200";
      recommendation = "Aviso de Sobrecarga Localizada: Verifique a distribuição. Certos anestesistas estão acumulando mais de 60% das escalas do centro cirúrgico.";
    } else if (averageEquity < 80) {
      gloriousReport = "Distribuição Moderadamente Balanceada";
      gloriousColor = "text-amber-700 bg-amber-50 border-amber-200";
      recommendation = "Escala Aceitável. É recomendável rotacionar postos e procedimentos nas próximas escalas para manter o engajamento e a justiça de honorários.";
    }

    return {
      hoursEquity,
      actsEquity,
      averageEquity,
      gloriousReport,
      gloriousColor,
      recommendation
    };
  }, [aggregatedReport]);

  // Audit list filtering logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const terms = searchLog.toLowerCase();
      const matchSearch =
        log.resumo.toLowerCase().includes(terms) ||
        log.usuario.toLowerCase().includes(terms) ||
        (log.justificativa?.toLowerCase() || '').includes(terms) ||
        log.acao.toLowerCase().includes(terms);

      const matchCat = logCategory === '' || log.acao === logCategory;
      return matchSearch && matchCat;
    });
  }, [logs, searchLog, logCategory]);

  // Memoized query filter for unplanned ICU transfers
  const filteredUtiEscalations = useMemo(() => {
    return escalations.filter(esc => {
      if (!esc.utiNaoProgramada) return false;
      
      if (utiFilterType === 'diario') {
        return esc.data === utiSelectedDate;
      } else {
        return esc.data && esc.data.startsWith(utiSelectedMonth);
      }
    });
  }, [escalations, utiFilterType, utiSelectedDate, utiSelectedMonth]);

  // Audit Logs Statistics for the panel side widget
  const auditStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let principalOperator = 'Nenhum';
    let operatorCount = 0;
    const operatorMap: Record<string, number> = {};

    logs.forEach(log => {
      counts[log.acao] = (counts[log.acao] || 0) + 1;
      operatorMap[log.usuario] = (operatorMap[log.usuario] || 0) + 1;
      if (operatorMap[log.usuario] > operatorCount) {
        operatorCount = operatorMap[log.usuario];
        principalOperator = log.usuario;
      }
    });

    return {
      categoryCounts: counts,
      mostActiveUser: `${principalOperator} (${operatorCount} ações)`,
      totalLogs: logs.length
    };
  }, [logs]);

  const uniqueActionsList = [
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

  const handlePrint = () => {
    window.print();
  };

  const handleSortToggle = (field: 'name' | 'hours' | 'acts' | 'efficiency') => {
    if (docSortField === field) {
      setDocSortAsc(!docSortAsc);
    } else {
      setDocSortField(field);
      setDocSortAsc(false); // default desc for numeric/metrics
    }
  };

  // Safe formatting helpers 
  const formatHourString = (hours: number): string => {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const formatMinString = (totalMins: number): string => {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  return (
    <div className="space-y-6" id="dashboard-integrated-root">
      
      {/* ======================================================== */}
      {/* SECTION 1: CLINICAL PERFORMANCE & TABLE (TAB 1)          */}
      {/* ======================================================== */}
      {activeSubTab === 'desempenho' && (
        <div className="space-y-6 animate-fade-in" id="performance-view-tab">
          
          {/* Dedicated Page Header for Desempenho Clínico */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-5 no-print">
            <div className="flex items-center gap-3.5">
              <UnitaLogo size={36} className="p-1 rounded-xl bg-slate-50 border border-slate-150 shadow-3xs" />
              <div>
                <h2 className="text-xl font-black text-slate-950 font-display flex items-center gap-2 tracking-tight">
                  Desempenho Clínico
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Métricas de produtividade individualizada, volume de procedimentos anestésicos e presença operacional.
                </p>
              </div>
            </div>
          </div>

          {/* QUICK STATS HUB ROW - Maintained exclusively on performance page */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print" id="anesthesiology-kpi-grid">
            {/* 1. Scale Hours Logged */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs flex items-start gap-3.5 hover:border-slate-300 transition-all">
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-blue-600 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Horas Trabalhadas</span>
                <span className="text-lg font-black text-slate-850 font-mono tracking-tight leading-none block">
                  {formatHourString(totalWorkedHours)}
                </span>
                <span className="block text-[9px] text-slate-450 leading-tight">Total de horas em tempo real no plantão</span>
              </div>
            </div>

            {/* 2. Total Anesthesia Procedures (Renamed to Cirurgias do Dia) */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs flex items-start gap-3.5 hover:border-slate-300 transition-all">
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-110 text-emerald-600 shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Cirurgias do Dia</span>
                <span className="text-lg font-black text-slate-850 font-mono tracking-tight leading-none block">
                  {totalCirurgiasConcluidas} <span className="text-[10px] font-bold text-slate-405 font-sans">finalizadas</span>
                </span>
                <span className="block text-[9px] text-slate-450 leading-tight">Somatório de cirurgias em tempo real</span>
              </div>
            </div>

            {/* 3. Standby / Readiness hours reservation */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs flex items-start gap-3.5 hover:border-slate-300 transition-all">
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100/80 text-amber-600 shrink-0">
                <Hourglass className="h-5 w-5" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Reserva de Prontidão</span>
                <span className="text-lg font-black text-slate-850 font-mono tracking-tight leading-none block text-amber-700">
                  {totalStandbyMins < 60 ? `${totalStandbyMins}min` : `${(totalStandbyMins / 60).toFixed(1).replace('.', ',')}h`}
                </span>
                <span className="block text-[9px] text-slate-450 leading-tight">Tempo em prontidão ociosa no hospital</span>
              </div>
            </div>

            {/* 4. Team Activation Rate */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs flex items-start gap-3.5 hover:border-slate-300 transition-all">
              <div className="p-3 rounded-xl bg-slate-100/85 border border-slate-200 text-slate-650 shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Engajamento Clínico</span>
                <span className="text-lg font-black text-slate-850 font-mono tracking-tight leading-none block">
                  {activationRate}%
                </span>
                <span className="block text-[9px] text-slate-450 leading-tight leading-none truncate">
                  {activeDoctorsCount} de {doctors.length} médicos atuando
                </span>
              </div>
            </div>
          </div>

          {/* KPI DE EQUIDADE E DISTRIBUIÇÃO JUSTA OPERACIONAL */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs no-print" id="equilibrium-kpi-block">
            {/* Meter */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-3.5 border-r border-slate-100 lg:pr-6">
              <div className="relative flex items-center justify-center">
                {/* Visual circle trail */}
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="42" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke={equityKPIs.averageEquity > 75 ? "#10b981" : equityKPIs.averageEquity > 45 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - equityKPIs.averageEquity / 100)}
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center select-none">
                  <span className="text-2xl font-black text-slate-800 font-mono tracking-tight">{equityKPIs.averageEquity}%</span>
                  <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-wider">Índice Isonômico</span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Equidade Clinica Operacional</h4>
                <div className={`text-[10px] p-1 px-2.5 rounded-full font-black border uppercase tracking-wide inline-block ${equityKPIs.gloriousColor}`}>
                  {equityKPIs.gloriousReport}
                </div>
              </div>
            </div>

            {/* Explanations & Bars */}
            <div className="md:col-span-7 flex flex-col justify-between p-1 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-blue-700 tracking-widest flex items-center gap-1.5 font-sans">
                  <Sparkles className="h-3.5 w-3.5 text-blue-605 animate-pulse" /> Governança de Equidade & Distribuição Justa
                </span>
                <h3 className="text-sm font-black text-slate-850 tracking-tight leading-snug">Metodologia Científica com Desvio Padrão</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  O sistema avalia a isonomia da escala cruzando o Coefficient of Variation (CV) de horas faturadas com a contagem de procedimentos anestésicos concluídos. Valores próximos a 100% indicam divisão perfeita e justa do esforço operacional.
                </p>
              </div>

              {/* Progress bars indicator */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-700">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> Distribuição de Horas no Turno</span>
                    <span className="font-mono text-slate-900 font-black">{equityKPIs.hoursEquity}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${equityKPIs.hoursEquity}%` }} 
                      className="bg-blue-600 h-full rounded-full transition-all duration-700" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-700">
                    <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-slate-400" /> Freqüência de Atos Anestésicos</span>
                    <span className="font-mono text-slate-900 font-black">{equityKPIs.actsEquity}%</span>
                  </div>
                  <div className="w-full bg-slate-105 h-2 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${equityKPIs.actsEquity}%` }} 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-700" 
                    />
                  </div>
                </div>
              </div>

              {/* Recommendation message block */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[10.5px] leading-relaxed text-slate-600 font-medium">
                <strong className="text-slate-800">Diretriz Governamental de Escala:</strong> {equityKPIs.recommendation}
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                placeholder="Pesquisar anestesista por CRM ou nome..."
                value={searchDocName}
                onChange={(e) => setSearchDocName(e.target.value)}
              />
            </div>

            {/* Filter buttons and Print Action */}
            <div className="flex items-center gap-2.5 flex-wrap text-xs font-semibold">
              <div className="bg-slate-100/80 p-0.5 rounded-lg border border-slate-150 flex gap-0.5">
                <button
                  onClick={() => setRange('dia')}
                  className={`px-3 py-1 font-bold rounded-md cursor-pointer transition-all ${
                    range === 'dia' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Conferência Diária
                </button>
                <button
                  onClick={() => setRange('mes')}
                  className={`px-3 py-1 font-bold rounded-md cursor-pointer transition-all ${
                    range === 'mes' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Conferência Mensal
                </button>
              </div>

              <span className="text-slate-300">|</span>

              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-black uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Printer className="h-3.5 w-3.5" /> PDF do Relatório
              </button>
            </div>
          </div>

          {/* PRINT-ONLY HEADER STICKY FOR PHYSICAL COPY EXPORT */}
          <div className="hidden print-only text-slate-900 space-y-4 pb-4 border-b border-slate-300 bg-white">
            <div className="flex justify-between items-start">
              <UnitaLogo size={32} variant="horizontal" className="text-slate-900 animate-fade-in" />
              <div className="text-right text-[10px] text-slate-450 font-mono space-y-0.5">
                <p>Emissão em: {new Date().toLocaleString('pt-BR')}</p>
                <p>Período: {range === 'dia' ? 'CONFERÊNCIA DIÁRIA' : 'CONFERÊNCIA MENSAL'}</p>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black font-display text-slate-950 uppercase tracking-wide">Relatório Consolidado de Produtividade</h1>
              <p className="text-xs font-semibold text-slate-600">Unitá Anestesiologia - Controle e Auditoria Clínica</p>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                Total de Horas registradas: {formatHourString(totalWorkedHours)} | Total de procedimentos anestésicos: {totalActs} atos
              </p>
            </div>
          </div>

          {/* Visual Bar graph row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs">
            {/* Visual ranking panel */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-850 font-display uppercase tracking-tight flex items-center gap-1.5">
                  <BarChart2 className="h-4.5 w-4.5 text-blue-600" />
                  Visualização de Produtividade (Top 6)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Representatividade em volume total de horas laborais computadas.</p>
              </div>

              <div className="space-y-3 pt-2">
                {aggregatedReport.length === 0 ? (
                  <p className="text-center py-12 text-xs italic text-slate-450">Nenhuma hora faturada no período de busca.</p>
                ) : (
                  aggregatedReport.slice(0, 6).map((rate, idx) => {
                    const percentage = maxHours > 0 ? (rate.horasTrabalhadas / maxHours) * 100 : 0;
                    return (
                      <div key={rate.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 font-mono flex items-center justify-center border border-slate-200">
                              {idx + 1}
                            </span>
                            <span className="font-extrabold text-slate-800 tracking-tight leading-none">{rate.nome}</span>
                          </div>
                          <span className="font-mono text-[11px] font-black text-blue-700 bg-blue-50/70 border border-blue-100/50 px-2 py-0.5 rounded shadow-3xs leading-none">
                            {formatHourString(rate.horasTrabalhadas)}h
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/40">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(2, percentage)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-455 font-mono font-extrabold pb-0.5">
                            {rate.cirurgiasConcluidas} cirurgias
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Context Summary Panel */}
            <div className="lg:col-span-7 bg-slate-50/50 rounded-xl p-5 border border-slate-200/70 flex flex-col justify-between">
              <div className="space-y-3.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-blue-50 text-blue-800 text-[10px] font-black uppercase tracking-wider border border-blue-105">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Inteligência Clínica
                </span>
                
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Avaliacao do Ciclo Operacional</h4>
                
                <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                  A relação de eficiência e permanência demonstra a densidade do volume clínico no hospital. O anestesista responsável pelas maiores horas acumuladas fornece sustentação ao expediente operacional, enquanto os atos realizados refletem o fluxo cirúrgico nas dependências dos setores e salas cobertas.
                </p>

                <div className="grid grid-cols-2 gap-4 text-xs font-medium pt-2">
                  <div className="p-3 bg-white border border-slate-150 rounded-lg shadow-3xs">
                    <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Líder Operacional</span>
                    <span className="text-slate-800 font-black block mt-1">
                      {aggregatedReport[0]?.nome || 'Nenhum'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold block">
                      {aggregatedReport[0] ? `${formatHourString(aggregatedReport[0].horasTrabalhadas)}h trabalhadas` : ''}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-150 rounded-lg shadow-3xs">
                    <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Maior Volume de Cirurgias</span>
                    <span className="text-slate-800 font-black block mt-1">
                      {[...aggregatedReport].sort((a,b) => b.cirurgiasConcluidas - a.cirurgiasConcluidas)[0]?.nome || 'Nenhum'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold block">
                      {[...aggregatedReport].sort((a,b) => b.cirurgiasConcluidas - a.cirurgiasConcluidas)[0]?.cirurgiasConcluidas || 0} cirurgias finalizadas
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-150 mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Os dados acima são retroalimentados em tempo real pela finalização de roteiros anestésicos na aba "Agora" ou escalas.</span>
              </div>
            </div>
          </div>

          {/* TABLE DE CONFERÊNCIA OFICIAL */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
              <div>
                <h3 className="font-black text-slate-950 font-display">Relação e Auditoria de Produtividade Médica</h3>
                <p className="text-[10px] text-slate-450 mt-0.5">Use o teclado para pesquisar e os cabeçalhos para alternar a ordenação de modo instantâneo.</p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold bg-white border border-slate-200 rounded-md px-2 py-1">
                {aggregatedReport.length} médicos exibidos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] font-mono border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortToggle('name')}>
                      <div className="flex items-center gap-1.5">
                        Médico / CRM <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortToggle('hours')}>
                      <div className="flex items-center justify-center gap-1.5">
                        Horas de Escala <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortToggle('acts')}>
                      <div className="flex items-center justify-center gap-1.5">
                        Cirurgias Concluídas <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Tempo Disponível</th>
                    <th className="py-3 px-6 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortToggle('efficiency')}>
                      <div className="flex items-center justify-end gap-1.5">
                        Eficiência Cirurgias/H <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {aggregatedReport.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                        Nenhum anestesista correspondente aos critérios de busca ou filtros de data.
                      </td>
                    </tr>
                  ) : (
                    aggregatedReport.map((rate, idx) => {
                      const efficiency = rate.horasTrabalhadas > 0
                        ? (rate.cirurgiasConcluidas / rate.horasTrabalhadas).toFixed(2).replace('.', ',')
                        : '0,00';
                      return (
                        <tr key={rate.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                            {idx + 1}º
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-extrabold text-slate-800 font-display">{rate.nome}</p>
                            <p className="text-[10px] text-slate-450 font-mono mt-0.5">{rate.crm}</p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-extrabold text-blue-700 bg-blue-50/20">
                            {formatHourString(rate.horasTrabalhadas)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                            {rate.cirurgiasConcluidas}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">
                            {formatMinString(rate.tempoDisponivelMin)}
                          </td>
                          <td className="py-3 px-6 text-right font-mono text-slate-700 font-black">
                            {efficiency}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: SECURITY & SYSTEM AUDIT FEED (TAB 2)         */}
      {/* ======================================================== */}
      {activeSubTab === 'auditoria' && (
        <div className="space-y-6 animate-fade-in" id="security-audit-view-tab-wrapper">
          
          {/* Dedicated Page Header for Segurança & Auditoria */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-5 no-print">
            <div className="flex items-center gap-3.5">
              <UnitaLogo size={36} className="p-1 rounded-xl bg-slate-50 border border-slate-150 shadow-3xs" />
              <div>
                <h2 className="text-xl font-black text-slate-950 font-display flex items-center gap-2 tracking-tight">
                  Segurança & Auditoria
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Trilha de auditoria cronológica e registros de governança da plataforma Unitá.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="security-audit-view-tab">
          
          {/* Main Logs Feed (8 Columns) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* Searching Filters Bar */}
            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-3xs flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="Pesquisar por operador, resumo, descrição ou justificativa..."
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                />
              </div>

              {/* Category Dropdown */}
              <div className="sm:w-60">
                <select
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold cursor-pointer focus:outline-hidden"
                  value={logCategory}
                  onChange={(e) => setLogCategory(e.target.value)}
                >
                  <option value="">Todas as Categoria de Ações</option>
                  {uniqueActionsList.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              {/* Refresh Logs button */}
              <button
                onClick={loadLogs}
                className="px-3.5 py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Sincronizar Histórico"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            {/* Event Chronology Container */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
                <span className="font-black text-slate-500 uppercase tracking-widest font-mono">Registro Cronológico de Governança</span>
                <span className="text-[10px] text-slate-450 font-mono font-extrabold">{filteredLogs.length} eventos filtrados</span>
              </div>

              <div className="divide-y divide-slate-150 max-h-[550px] overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <div className="py-16 text-center text-xs italic text-slate-400 max-w-sm mx-auto">
                    <Info className="h-8 w-8 text-slate-350 mx-auto mb-2.5" />
                    Nenhum lançamento no registro confere com os filtros adotados. Tente alterar sua pesquisa de termos correspondentes.
                  </div>
                ) : (
                  filteredLogs.map(log => {
                    // Styles depending on action gravity/category
                    let actionTagStyle = 'bg-slate-100 border-slate-200/80 text-slate-700';
                    if (log.acao.startsWith('Nova') || log.acao.startsWith('Entrada') || log.acao === 'Cadastro de plantonista') {
                      actionTagStyle = 'bg-emerald-50 border-emerald-150 text-emerald-800';
                    } else if (log.acao.startsWith('Edição') || log.acao.startsWith('Alteração')) {
                      actionTagStyle = 'bg-indigo-50 border-indigo-150 text-indigo-800';
                    } else if (log.acao.startsWith('Exclusão')) {
                      actionTagStyle = 'bg-rose-50 border-rose-150 text-rose-850';
                    } else if (log.acao.startsWith('Saída') || log.acao.startsWith('Finalização')) {
                      actionTagStyle = 'bg-amber-50 border-amber-150 text-amber-800';
                    }

                    return (
                      <div key={log.id} className="p-4.5 hover:bg-slate-50/40 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start text-xs">
                        {/* Event summary content */}
                        <div className="space-y-2 flex-1 md:max-w-[70%]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border ${actionTagStyle}`}>
                              {log.acao}
                            </span>
                            <span className="text-slate-300 font-mono font-black">•</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {log.id}</span>
                          </div>

                          <p className="text-slate-900 font-extrabold font-display leading-relaxed">{log.resumo}</p>

                          {/* Justifications if supplied */}
                          {log.justificativa && (
                            <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-205 flex items-start gap-2 text-[10px] text-amber-900 leading-normal font-medium">
                              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-amber-950 uppercase tracking-widest text-[9px] block mb-0.5">Motivo Técnico Declarado:</span>
                                {log.justificativa}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Event Metadata */}
                        <div className="shrink-0 md:text-right text-[10px] font-mono font-semibold text-slate-500 space-y-1">
                          <div className="flex items-center md:justify-end gap-1 text-slate-800">
                            <span>Sessão:</span>
                            <span className="bg-slate-100 text-slate-800 font-bold font-mono px-1.5 py-0.2 rounded mt-0.5">{log.usuario}</span>
                          </div>
                          
                          <div className="text-slate-450 uppercase text-[9px] tracking-wider uppercase font-black">
                            {log.perfil === 'administrador' ? 'Regime: Admin' : 'Regime: Coordenador'}
                          </div>

                          <div className="text-slate-400 flex items-center md:justify-end gap-1 select-none">
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

          {/* Realtime Safety Analytics Widget (4 Columns) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Event Distribution stats */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-850 font-display uppercase tracking-widest">Resumo Operacional</h3>
                <p className="text-[10px] text-slate-500 font-medium">Métricas do banco de trilha de segurança.</p>
              </div>

              {/* Overall stat summaries */}
              <div className="space-y-3.5 text-xs">
                
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg font-medium">
                  <span className="text-[9px] text-slate-400 block font-extrabold uppercase">Gerente mais ativo</span>
                  <span className="text-slate-800 font-black block mt-0.5">
                    {auditStats.mostActiveUser}
                  </span>
                </div>

                {/* Audit Distribution progress metrics */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Log de Atividades por Tipo:</span>
                  
                  {uniqueActionsList.map(action => {
                    const count = auditStats.categoryCounts[action] || 0;
                    const logPercentage = logs.length > 0 ? (count / logs.length) * 100 : 0;
                    if (count === 0) return null; // hide zero counters for compactness

                    return (
                      <div key={action} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-650">
                          <span className="truncate max-w-[80%]">{action}</span>
                          <span className="font-mono font-black">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-205/50">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${logPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* Protocol Security Information Callout */}
            <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl shadow-3xs space-y-3.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950 text-indigo-200 text-[10px] font-black uppercase tracking-wider border border-indigo-900">
                <Shield className="h-3.5 w-3.5" /> Segurança da Informação
              </span>

              <h4 className="text-xs font-black text-white font-display uppercase tracking-wider">Homologacao e Compliance</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                Esta trilha de auditoria e conformidade guarda os registros persistentes da plataforma Unitá. As correções manuais de horas, liberação de acesso de coordenador simulado e o cancelamento de escalas contam com preenchimento obrigatório de justificativa em observância ao compliance de gestão clínica em regime de urgência.
              </p>
            </div>

          </div>

        </div>
      </div>
    )}



      {/* ======================================================== */}
      {/* SECTION 4: UNPLANNED ICU REPORT PANEL (TAB 4)           */}
      {/* ======================================================== */}
      {activeSubTab === 'uti' && (
        <div className="space-y-6 animate-fade-in" id="uti-unplanned-report-tab">
          
          {/* Dedicated Page Header for UTI Não Programada */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-5 no-print">
            <div className="flex items-center gap-3.5">
              <UnitaLogo size={36} className="p-1 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shadow-3xs animate-pulse" />
              <div>
                <h2 className="text-xl font-black text-rose-700 font-display flex items-center gap-2 tracking-tight">
                  Relatório UTI não Programada
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Acompanhamento e emissão da ficha cronológica de transferências emergenciais cirúrgicas pós-operatórias.
                </p>
              </div>
            </div>
          </div>
          
          {/* Controls Bar */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
                <AlertCircle className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Filtros de Período</h3>
                <p className="text-[11px] text-slate-500 font-medium">Selecione o filtro diário ou mensal para emissão do relatório.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              {/* Daily / Monthly selector */}
              <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setUtiFilterType('diario')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-all cursor-pointer ${
                    utiFilterType === 'diario'
                      ? 'bg-white text-slate-900 shadow-3xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Filtro Diário
                </button>
                <button
                  type="button"
                  onClick={() => setUtiFilterType('mensal')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-all cursor-pointer ${
                    utiFilterType === 'mensal'
                      ? 'bg-white text-slate-900 shadow-3xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Filtro Mensal
                </button>
              </div>

              {/* Day picker */}
              {utiFilterType === 'diario' ? (
                <input
                  type="date"
                  value={utiSelectedDate}
                  onChange={(e) => setUtiSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-slate-50 text-slate-800"
                />
              ) : (
                <input
                  type="month"
                  value={utiSelectedMonth}
                  onChange={(e) => setUtiSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-slate-50 text-slate-800"
                />
              )}

              {/* Export PDF Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Exportar em PDF
              </button>
            </div>
          </div>

          {/* Quick HUD Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Ocorrências Solicitadas</span>
                <span className="text-xl font-black text-slate-850 font-mono leading-none block mt-0.5">
                  {filteredUtiEscalations.length}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Setor Mais Afetado</span>
                <span className="text-sm font-black text-slate-800 truncate block mt-0.5">
                  {filteredUtiEscalations.length > 0
                    ? (() => {
                        const counts: Record<string, number> = {};
                        filteredUtiEscalations.forEach(e => {
                          counts[e.setorNome] = (counts[e.setorNome] || 0) + 1;
                        });
                        return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
                      })()
                    : 'Nenhum'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-650">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Anestesistas Envolvidos</span>
                <span className="text-xl font-black text-slate-850 font-mono leading-none block mt-0.5">
                  {new Set(filteredUtiEscalations.map(e => e.doctorID)).size}
                </span>
              </div>
            </div>
          </div>

          {/* DOCUMENT BODY - TARGET PRINT FORMAT */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 space-y-6 printable-report">
            
            {/* Print Only Header (Visible on print, hidden or styled on screen) */}
            <div className="border-b border-slate-200 pb-5 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <UnitaLogo size={32} variant="horizontal" className="text-slate-900" />
                <h2 className="text-[17px] font-black text-slate-900 font-display uppercase tracking-wider pt-2">
                  Relatório de Transferência - UTI não Programada
                </h2>
                <div className="text-xs text-slate-500 font-medium">
                  Atendimentos cirúrgicos com indicação emergencial de terapia intensiva pós-operatória.
                </div>
              </div>

              <div className="text-right text-xs font-mono text-slate-500 space-y-1 shrink-0">
                <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                <p><strong>Filtro:</strong> {utiFilterType === 'diario' ? 'DIÁRIO' : 'MENSAL'}</p>
                <p><strong>Período:</strong> {utiFilterType === 'diario' 
                    ? utiSelectedDate.split('-').reverse().join('/') 
                    : (() => {
                        const [y, m] = utiSelectedMonth.split('-');
                        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                        return `${monthNames[parseInt(m) - 1]} / ${y}`;
                      })()
                    }
                </p>
              </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-4">Anestesista / CRM</th>
                    <th className="py-2.5 px-4">Setor da Ocorrência</th>
                    <th className="py-2.5 px-4 font-mono">Nº Atendimento</th>
                    <th className="py-2.5 px-4">Horários (Entrada / Saída)</th>
                    <th className="py-2.5 px-4 text-right">Ação Emitida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                  {filteredUtiEscalations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic font-medium bg-slate-50/10">
                        Nenhuma transferência de UTI não programada foi encontrada para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredUtiEscalations.map(esc => {
                      const entryStr = new Date(esc.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const exitStr = esc.saida 
                        ? new Date(esc.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                        : 'Em andamento';
                      
                      return (
                        <tr key={esc.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{esc.doctorName}</div>
                            <div className="text-[10px] text-slate-450 font-mono">CRM {doctors.find(d => d.id === esc.doctorID)?.crm || 'Sem CRM'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">{esc.setorNome}</span>
                            <span className="text-slate-400"> • </span>
                            <span className="text-slate-500 font-normal">{esc.salaNome}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-extrabold text-rose-600 text-[13px]">
                            {esc.atendimento || 'N/A'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono">{esc.data.split('-').reverse().join('/')}</div>
                            <div className="text-[10px] text-slate-450 font-mono mt-0.5">{entryStr} às {exitStr}</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex px-2 py-0.5 text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-100 rounded-sm leading-none uppercase">
                              UTI Emergencial
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Document Signature block & print footer (Specifically structured for official PDF export) */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-[11px] font-medium text-slate-450 text-center no-screen print:flex print:justify-between print:gap-16">
              <div className="border-t border-slate-300 pt-3 max-w-xs mx-auto w-full">
                <p className="font-bold text-slate-800">Coordenação Médica de Plantão</p>
                <p className="text-[10px] font-bold">Unidade de Terapia de Urgência Unitá</p>
              </div>

              <div className="border-t border-slate-300 pt-3 max-w-xs mx-auto w-full">
                <p className="font-bold text-slate-800">Diretoria Clínica / Compliance</p>
                <p className="text-[10px] font-bold">Relatório de Governança Auxiliar</p>
              </div>
            </div>

            {/* Compliance reference note */}
            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-medium leading-relaxed italic">
              * Este documento é gerado informaticamente com base na sincronização voluntária dos registros de escalas no posto operacional Unitá. O número de atendimento do paciente é de preenchimento compulsório nos casos de transferência à terapia intensiva neonatal ou de adultos pós-operatória não programada.
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
