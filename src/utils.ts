import { Doctor, SectorRoom, Escalation, AuditLog, UserSession } from './types';

/**
 * Calculates current status duration formatted in integer minutes.
 * - Absolutely NO units like "h" or "min".
 */
export function formatDurationPure(fromISO: string, endISO?: string | null): string {
  if (!fromISO) return '0';
  const start = new Date(fromISO).getTime();
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  
  const diffMs = end - start;
  const diffMins = Math.max(0, Math.floor(diffMs / (60 * 1000)));

  return String(diffMins);
}

/**
 * Checks if a doctor has been idle for more than 60 mins.
 * Doctors available with no active escalations are considered idle.
 */
export function isDoctorIdleTooLong(availableSinceISO: string): boolean {
  if (!availableSinceISO) return false;
  const start = new Date(availableSinceISO).getTime();
  const diffMs = Date.now() - start;
  const diffMins = diffMs / (60 * 1000);
  return diffMins > 60;
}

/**
 * Helper to determine current status of all doctors
 */
export function getDoctorsStatuses(
  doctors: Doctor[],
  escalations: Escalation[]
): {
  present: Doctor[];
  available: (Doctor & { durationText: string; isIdle: boolean })[];
  escalated: (Doctor & { escalation: Escalation; durationText: string })[];
} {
  const activeEscalations = escalations.filter(e => e.ativa);

  const present = doctors.filter(d => d.presente);

  const available = present
    .filter(d => !activeEscalations.some(e => e.doctorID === d.id))
    .map(d => {
      const isIdle = isDoctorIdleTooLong(d.disponivelDesde);
      const durationText = formatDurationPure(d.disponivelDesde);
      return { ...d, durationText, isIdle };
    })
    // Sorted descending by duration (who has been idle the longest first)
    .sort((a, b) => {
      const timeDiffA = Date.now() - new Date(a.disponivelDesde).getTime();
      const timeDiffB = Date.now() - new Date(b.disponivelDesde).getTime();
      return timeDiffB - timeDiffA;
    });

  const escalated = present
    .filter(d => activeEscalations.some(e => e.doctorID === d.id))
    .map(d => {
      const esc = activeEscalations.find(e => e.doctorID === d.id)!;
      const durationText = formatDurationPure(esc.entrada);
      return { ...d, escalation: esc, durationText };
    });

  return { present, available, escalated };
}

/**
 * Checks if a room has an active escalation
 */
export function getRoomOccupancy(
  roomId: string,
  escalations: Escalation[]
): Escalation | null {
  return escalations.find(e => e.ativa && e.roomId === roomId) || null;
}

/**
 * Prevent task overlaps for the same doctor.
 * Returns true if there's any active escalation for this doctor OR if there is an
 * overlap between the proposed times of past completed escalations.
 */
export function checkOverlap(
  doctorID: string,
  entradaISO: string,
  saidaISO: string | undefined,
  escalations: Escalation[],
  ignoreEscalationId?: string
): boolean {
  const doctorEscalations = escalations.filter(
    e => e.doctorID === doctorID && e.id !== ignoreEscalationId
  );

  const newStart = new Date(entradaISO).getTime();
  const newEnd = saidaISO ? new Date(saidaISO).getTime() : Infinity;

  for (const esc of doctorEscalations) {
    const escStart = new Date(esc.entrada).getTime();
    const escEnd = esc.saida ? new Date(esc.saida).getTime() : Infinity;

    // Overlap conditions
    if (newStart < escEnd && newEnd > escStart) {
      return true;
    }
  }

  return false;
}

/**
 * Log helper for storing system actions in auditoria (localStorage)
 */
export function logSystemEvent(
  usuario: string,
  perfil: 'administrador' | 'coordenador',
  acao: AuditLog['acao'],
  resumo: string,
  justificativa?: string,
  statusAnterior?: string,
  statusNovo?: string
) {
  const logs: AuditLog[] = JSON.parse(localStorage.getItem('unita_audit') || '[]');
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    usuario,
    perfil,
    timestamp: new Date().toISOString(),
    acao,
    resumo,
    justificativa,
    statusAnterior,
    statusNovo
  };
  localStorage.setItem('unita_audit', JSON.stringify([newLog, ...logs]));
}
