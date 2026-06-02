import React, { useState } from 'react';
import { UserSession } from '../types';
import { Shield, Key, Mail, ArrowLeft, Activity } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // Checking exact credentials matching the MVP spec
    if (username === 'Admin' && password === 'admin') {
      const session: UserSession = { usuario: 'Admin', perfil: 'administrador' };
      localStorage.setItem('unita_session', JSON.stringify(session));
      onLoginSuccess(session);
    } else if (username === 'coord' && password === 'coord') {
      const session: UserSession = { usuario: 'coord', perfil: 'coordenador' };
      localStorage.setItem('unita_session', JSON.stringify(session));
      onLoginSuccess(session);
    } else {
      setError('Credenciais incorretas. Tente "Admin / admin" ou "coord / coord".');
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      return;
    }
    setRecoverySent(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="login-container">
      {/* Decorative medical background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Activity className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white font-display tracking-tight leading-none">Unitá</h2>
            <p className="text-xs text-blue-400 font-mono tracking-widest mt-1 uppercase">Anestesia - Escala</p>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl border border-slate-100 sm:px-10">
          {!isRecovering ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 font-display">Acesso ao Plantão</h3>
                <p className="text-sm text-slate-500 mt-1">Insira suas credenciais corporativas</p>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-700 text-xs px-3.5 py-2.5 rounded-lg border border-rose-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Usuário
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: Admin ou coord"
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Senha
                  </label>
                </div>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white text-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  id="forgot-password-trigger"
                  type="button"
                  onClick={() => {
                    setIsRecovering(true);
                    setRecoverySent(false);
                    setRecoveryEmail('');
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-all"
                >
                  Esqueci minha senha
                </button>
                <div className="text-xs text-slate-400 font-mono">MVP v1.0.0</div>
              </div>

              <div>
                <button
                  id="login-submit-button"
                  type="submit"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer active:scale-98 transition-all"
                >
                  Entrar no Painel
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100/80">
                <p className="text-[11px] text-slate-500 font-medium">Credenciais de simulação públicas:</p>
                <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono text-[10px] text-slate-600">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="font-semibold text-blue-700">Admin</span>: admin
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="font-semibold text-blue-700">Coord</span>: coord
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <button
                  id="back-to-login"
                  type="button"
                  onClick={() => setIsRecovering(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-all mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
                </button>
                <h3 className="text-xl font-semibold text-slate-800 font-display">Recuperar Senha</h3>
                <p className="text-sm text-slate-500 mt-1">Forneça seu endereço de e-mail institucional cadastrado</p>
              </div>

              {recoverySent ? (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-4 rounded-xl border border-emerald-100 space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    Link Enviado!
                  </div>
                  <p className="leading-relaxed">
                    Um link seguro de redefinição de credenciais de acesso foi enviado para <strong className="break-all">{recoveryEmail}</strong>. Verifique sua caixa de entrada.
                  </p>
                  <button
                    id="recovery-confirmed-back"
                    onClick={() => setIsRecovering(false)}
                    className="mt-2 text-xs font-bold text-emerald-900 hover:underline inline-block"
                  >
                    Ir para login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecoverySubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      E-mail Institucional
                    </label>
                    <div className="relative rounded-lg shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="recovery-email-input"
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="nome@unita.com.br"
                        className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white text-sm transition-all"
                      />
                    </div>
                  </div>

                  <button
                    id="recovery-submit-button"
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-all"
                  >
                    Enviar Link de Redefinição
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
