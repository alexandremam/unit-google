import { Doctor, SectorRoom, Escalation, AuditLog, ShiftConfig } from './types';

// Let's create the 22 hospital rooms
export const HOSPITAL_ROOMS: SectorRoom[] = [
  // 1. Centro cirúrgico
  { id: 'cc-s1', setor: 'Centro cirúrgico', sala: 'Sala 1', especial: false },
  { id: 'cc-s2', setor: 'Centro cirúrgico', sala: 'Sala 2', especial: false },
  { id: 'cc-s3', setor: 'Centro cirúrgico', sala: 'Sala 3', especial: false },
  { id: 'cc-s4', setor: 'Centro cirúrgico', sala: 'Sala 4', especial: false },
  { id: 'cc-s5', setor: 'Centro cirúrgico', sala: 'Sala 5', especial: false },
  { id: 'cc-s6', setor: 'Centro cirúrgico', sala: 'Sala 6', especial: false },
  { id: 'cc-s7', setor: 'Centro cirúrgico', sala: 'Sala 7', especial: false },
  { id: 'cc-s8', setor: 'Centro cirúrgico', sala: 'Sala 8', especial: false },
  { id: 'cc-s9', setor: 'Centro cirúrgico', sala: 'Sala 9', especial: false },

  // 2. Centro obstétrico
  { id: 'co-s1', setor: 'Centro obstétrico', sala: 'Sala 1', especial: false },
  { id: 'co-s2', setor: 'Centro obstétrico', sala: 'Sala 2', especial: false },
  { id: 'co-s3', setor: 'Centro obstétrico', sala: 'Sala 3', especial: false },

  // 3. Delivery
  { id: 'del-su', setor: 'Delivery', sala: 'Sala única', especial: false },

  // 4. Day clinic
  { id: 'dc-s1', setor: 'Day clinic', sala: 'Sala 1', especial: false },
  { id: 'dc-s2', setor: 'Day clinic', sala: 'Sala 2', especial: false },
  { id: 'dc-s3', setor: 'Day clinic', sala: 'Sala 3', especial: false },

  // 5. Endoscopia
  { id: 'end-s1', setor: 'Endoscopia', sala: 'Sala 1', especial: true },
  { id: 'end-s2', setor: 'Endoscopia', sala: 'Sala 2', especial: true },
  { id: 'end-s3', setor: 'Endoscopia', sala: 'Sala 3', especial: true },

  // 6. Hemodinâmica
  { id: 'hem-su', setor: 'Hemodinâmica', sala: 'Sala única', especial: false },

  // 7. SADT
  { id: 'sadt-b6', setor: 'SADT', sala: 'Bloco 6h', especial: true },

  // 8. Avaliação Pré-anestésica/RPA
  { id: 'pre-b6', setor: 'Avaliação Pré-anestésica/RPA', sala: 'Bloco 6h', especial: true }
];

export const INITIAL_DOCTORS: Doctor[] = [
  { id: 'd1', nome: 'Dra. Marina Costa', crm: 'CRM 12345-SP', celular: '(11) 98765-4321', afinidade: 'Anestesia Pediátrica', presente: true, disponivelDesde: '' },
  { id: 'd2', nome: 'Dr. André Lima', crm: 'CRM 23456-SP', celular: '(11) 98765-4322', afinidade: 'Cardiovascular', presente: true, disponivelDesde: '' },
  { id: 'd3', nome: 'Dra. Camila Nunes', crm: 'CRM 34567-SP', celular: '(11) 98765-4323', afinidade: 'Obstetrícia', presente: true, disponivelDesde: '' },
  { id: 'd4', nome: 'Dr. Rafael Torres', crm: 'CRM 45678-SP', celular: '(11) 98765-4324', afinidade: 'Neuroanestesia', presente: true, disponivelDesde: '' },
  { id: 'd5', nome: 'Dra. Beatriz Rocha', crm: 'CRM 56789-SP', celular: '(11) 98765-4325', afinidade: 'Anestesia Geral / Pacientes Graves', presente: true, disponivelDesde: '' },
  { id: 'd6', nome: 'Dr. Lucas Ferreira', crm: 'CRM 67890-SP', celular: '(11) 98765-4326', afinidade: 'Ortopedia', presente: true, disponivelDesde: '' },
  { id: 'd7', nome: 'Dra. Helena Martins', crm: 'CRM 78901-SP', celular: '(11) 98765-4327', afinidade: 'Via Aérea Difícil', presente: true, disponivelDesde: '' },
  { id: 'd8', nome: 'Dr. Felipe Moraes', crm: 'CRM 89012-SP', celular: '(11) 98765-4328', afinidade: 'Anestesia Regional / Dor', presente: true, disponivelDesde: '' },
  { id: 'd9', nome: 'Dra. Juliana Prado', crm: 'CRM 90123-SP', celular: '(11) 91234-5671', afinidade: 'Urologia e Geral', presente: true, disponivelDesde: '' },
  { id: 'd10', nome: 'Dr. Gustavo Almeida', crm: 'CRM 01234-SP', celular: '(11) 91234-5672', afinidade: 'Gastroenterologia', presente: true, disponivelDesde: '' },
  { id: 'd11', nome: 'Dra. Renata Vieira', crm: 'CRM 11223-SP', celular: '(11) 91234-5673', afinidade: 'Pediatria e RPA', presente: true, disponivelDesde: '' },
  { id: 'd12', nome: 'Dr. Marcelo Barros', crm: 'CRM 22334-SP', celular: '(11) 91234-5674', afinidade: 'Ginecologia', presente: true, disponivelDesde: '' },
  { id: 'd13', nome: 'Dra. Sofia Cardoso', crm: 'CRM 33445-SP', celular: '(11) 91234-5675', afinidade: 'Cirurgia Plástica', presente: true, disponivelDesde: '' },
  { id: 'd14', nome: 'Dr. Thiago Ramos', crm: 'CRM 44556-SP', celular: '(11) 91234-5676', afinidade: 'Oftalmologia e SADT', presente: true, disponivelDesde: '' },
  { id: 'd15', nome: 'Dra. Patrícia Lopes', crm: 'CRM 55667-SP', celular: '(11) 91234-5677', afinidade: 'Cirurgia Cabeça e Pescoço', presente: true, disponivelDesde: '' },
  { id: 'd16', nome: 'Dr. Eduardo Farias', crm: 'CRM 66778-SP', celular: '(11) 91234-5678', afinidade: 'Torácica', presente: true, disponivelDesde: '' },
  { id: 'd17', nome: 'Dra. Laura Mendes', crm: 'CRM 77889-SP', celular: '(11) 91234-5679', afinidade: 'Anestesia Geral / Endoscopia', presente: true, disponivelDesde: '' },
  { id: 'd18', nome: 'Dr. Henrique Castro', crm: 'CRM 88990-SP', celular: '(11) 91234-5680', afinidade: 'Ortopedia de Alta Complexidade', presente: true, disponivelDesde: '' },
  { id: 'd19', nome: 'Dra. Natália Freitas', crm: 'CRM 99001-SP', celular: '(11) 91234-5681', afinidade: 'Geriatria', presente: true, disponivelDesde: '' },
  { id: 'd20', nome: 'Dr. Paulo Teixeira', crm: 'CRM 10101-SP', celular: '(11) 91234-5682', afinidade: 'Cirurgia Robótica / Geral', presente: true, disponivelDesde: '' }
];

export function initializeDatabase() {
  const now = new Date();

  // If local storage has keys, don't override them except to set defaults
  if (!localStorage.getItem('unita_doctors')) {
    // Generate customizable disponivelDesde times to simulate realistic initial periods
    const doctorsWithTimes = INITIAL_DOCTORS.map((doc, idx) => {
      // stagger times so some are ocioso (>60 mins available)
      // d1: idle for 75 minutes
      // d5: idle for 120 minutes (who is active initially? let's see)
      // We will set different minute offsets
      const offsetMinutes = [75, 40, 95, 30, 130, 25, 110, 15, 80, 45, 90, 5, 65, 50, 85, 35, 105, 20, 115, 10][idx];
      const d = new Date(now.getTime() - offsetMinutes * 60 * 1000);
      return {
        ...doc,
        disponivelDesde: d.toISOString()
      };
    });
    localStorage.setItem('unita_doctors', JSON.stringify(doctorsWithTimes));
  }

  if (!localStorage.getItem('unita_shift')) {
    const shift: ShiftConfig = {
      // Dr. Paulo Teixeira is the default coordinator
      coordenadores: ['d20'],
      inicio: '07:00',
      fim: '19:00'
    };
    localStorage.setItem('unita_shift', JSON.stringify(shift));
  }

  if (!localStorage.getItem('unita_escalations')) {
    // Let's create some demo active escalations
    // We will allocate a few doctors and transition their statuses to "Escalado"
    const doctors = JSON.parse(localStorage.getItem('unita_doctors') || '[]') as Doctor[];
    
    // Find d1, d2, d3, d4
    const d1 = doctors.find(d => d.id === 'd1');
    const d2 = doctors.find(d => d.id === 'd2');
    const d3 = doctors.find(d => d.id === 'd3');
    const d4 = doctors.find(d => d.id === 'd4');

    const escalations: Escalation[] = [];

    if (d1) {
      escalations.push({
        id: 'esc-1',
        doctorID: 'd1',
        doctorName: d1.nome,
        roomId: 'cc-s1',
        setorNome: 'Centro cirúrgico',
        salaNome: 'Sala 1',
        atendimento: 'AT-90812',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 45 * 60 * 1000).toISOString(), // 45 mins ago
        ativa: true,
        atosRealizados: 1
      });
    }

    if (d2) {
      escalations.push({
        id: 'esc-2',
        doctorID: 'd2',
        doctorName: d2.nome,
        roomId: 'cc-s5',
        setorNome: 'Centro cirúrgico',
        salaNome: 'Sala 5',
        atendimento: 'AT-90815',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 95 * 60 * 1000).toISOString(), // 1.58 hours ago
        ativa: true,
        atosRealizados: 1
      });
    }

    if (d3) {
      escalations.push({
        id: 'esc-3',
        doctorID: 'd3',
        doctorName: d3.nome,
        roomId: 'del-su',
        setorNome: 'Delivery',
        salaNome: 'Sala única',
        atendimento: 'AT-90816',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 150 * 60 * 1000).toISOString(), // 2.5 hours ago
        ativa: true,
        atosRealizados: 1
      });
    }

    if (d4) {
      escalations.push({
        id: 'esc-4',
        doctorID: 'd4',
        doctorName: d4.nome,
        roomId: 'end-s1', // Special (Endoscopy)
        setorNome: 'Endoscopia',
        salaNome: 'Sala 1',
        atendimento: 'AT-90819',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 210 * 60 * 1000).toISOString(), // 3.5 hours ago
        ativa: true,
        atosRealizados: 1
      });
    }

    // Let's add 2 completed escalations from earlier today to enrich reports
    const d10 = doctors.find(d => d.id === 'd10');
    const d11 = doctors.find(d => d.id === 'd11');

    if (d10) {
      escalations.push({
        id: 'esc-5',
        doctorID: 'd10',
        doctorName: d10.nome,
        roomId: 'cc-s2',
        setorNome: 'Centro cirúrgico',
        salaNome: 'Sala 2',
        atendimento: 'AT-90220',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(), // started 8h ago
        saida: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // finished 5h ago
        horasManual: 3, // 3 hours
        ativa: false,
        atosRealizados: 1
      });
    }

    if (d11) {
      escalations.push({
        id: 'esc-6',
        doctorID: 'd11',
        doctorName: d11.nome,
        roomId: 'sadt-b6', // Special SADT
        setorNome: 'SADT',
        salaNome: 'Bloco 6h',
        atendimento: 'AT-90230',
        data: now.toISOString().split('T')[0],
        entrada: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // started 10h ago
        saida: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // finished 4h ago
        horasManual: 6, // 6 hours special sector
        ativa: false,
        atosRealizados: 1
      });
    }

    localStorage.setItem('unita_escalations', JSON.stringify(escalations));
  }

  if (!localStorage.getItem('unita_audit')) {
    const logs: AuditLog[] = [
      {
        id: 'log-1',
        usuario: 'Admin',
        perfil: 'administrador',
        timestamp: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
        acao: 'Nova escala',
        resumo: 'Nova escala do plantonista Dr. Rafael Torres no setor Endoscopia - Sala 1.'
      },
      {
        id: 'log-2',
        usuario: 'Admin',
        perfil: 'administrador',
        timestamp: new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString(),
        acao: 'Nova escala',
        resumo: 'Nova escala do plantonista Dra. Camila Nunes no setor Delivery - Sala única.'
      },
      {
        id: 'log-3',
        usuario: 'coord',
        perfil: 'coordenador',
        timestamp: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString(),
        acao: 'Alteração de coordenador',
        resumo: 'Atribuição de coordenador do dia para Dr. Paulo Teixeira.'
      }
    ];
    localStorage.setItem('unita_audit', JSON.stringify(logs));
  }
}

export function helperGetDoctors(): Doctor[] {
  return JSON.parse(localStorage.getItem('unita_doctors') || '[]');
}

export function helperSaveDoctors(docs: Doctor[]) {
  localStorage.setItem('unita_doctors', JSON.stringify(docs));
}

export function helperGetEscalations(): Escalation[] {
  return JSON.parse(localStorage.getItem('unita_escalations') || '[]');
}

export function helperSaveEscalations(esc: Escalation[]) {
  localStorage.setItem('unita_escalations', JSON.stringify(esc));
}

export function helperGetAudit(): AuditLog[] {
  return JSON.parse(localStorage.getItem('unita_audit') || '[]');
}

export function helperSaveAudit(logs: AuditLog[]) {
  localStorage.setItem('unita_audit', JSON.stringify(logs));
}

export function helperGetShift(): ShiftConfig {
  return JSON.parse(localStorage.getItem('unita_shift') || '{"coordenadores":["d20"],"inicio":"07:00","fim":"19:00"}');
}

export function helperSaveShift(shift: ShiftConfig) {
  localStorage.setItem('unita_shift', JSON.stringify(shift));
}
