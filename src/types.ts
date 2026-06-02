/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Doctor {
  id: string;
  nome: string;
  crm: string;
  celular: string;
  afinidade: string;
  presente: boolean; // if present in current shift
  disponivelDesde: string; // ISO string representing when they became available
}

export interface SectorRoom {
  id: string;
  setor: string;
  sala: string;
  especial: boolean; // Endoscopia, SADT, Avaliação Pré-anestésica/RPA
}

export interface Escalation {
  id: string;
  doctorID: string;
  doctorName: string;
  roomId: string;
  setorNome: string;
  salaNome: string;
  atendimento: string; // "número do atendimento"
  data: string; // YYYY-MM-DD
  entrada: string; // ISO String or HH:mm, let's store as ISO string for math operations, but editable
  saida?: string; // ISO String when finished
  horasManual?: number; // optionally overridden hours
  atosRealizados: number; // default is 1, specially 1 for normal, or custom for count
  justificativaEdicao?: string;
  justificativaExclusao?: string;
  ativa: boolean;
}

export interface AuditLog {
  id: string;
  usuario: string;
  perfil: 'administrador' | 'coordenador';
  timestamp: string; // ISO String
  acao: 'Nova escala' | 'Edição de escala' | 'Finalização' | 'Exclusão de escala' | 'Cadastro de plantonista' | 'Exclusão de plantonista' | 'Entrada no plantão' | 'Saída do plantão' | 'Alteração de coordenador';
  resumo: string;
  justificativa?: string;
  statusAnterior?: string;
  statusNovo?: string;
}

export interface UserSession {
  usuario: string;
  perfil: 'administrador' | 'coordenador';
}

export interface ShiftConfig {
  coordenadores: string[]; // up to 2 doctor IDs as coordinator
  inicio: string; // e.g., "07:00"
  fim: string; // e.g., "19:00"
}
