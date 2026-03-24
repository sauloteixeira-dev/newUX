import React, { useState, useEffect } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [logMsg, setLogMsg] = useState('Iniciando...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'waking'

  // Pre-warm: acorda o servidor do Render ao carregar a página
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const ping = () => {
      fetch(`${apiUrl}/ping`)
        .then(r => r.json())
        .then(() => {
          console.log('[FRONT] Servidor acordado e pronto!');
          setServerStatus('online');
        })
        .catch(() => {
          console.log('[FRONT] Servidor ainda acordando...');
          setServerStatus('waking');
          // Tenta novamente em 5s
          setTimeout(ping, 5000);
        });
    };
    ping();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!matricula || !senha) return;

    setLoading(true);
    setError('');
    setLogMsg('Conectando ao Portal...');
    setProgress(2);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      console.log(`[FRONT] Enviando POST para: ${apiUrl}/api/login`);
      
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha })
      });

      console.log(`[FRONT] Resposta recebida. Status: ${response.status}`);

      if (!response.body) throw new Error('Servidor não suporta streaming.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = null;

      // Mapa de progresso por etapa
      const progressMap = {
        '1/5': 15,
        '2/5': 35,
        '3/5': 50,
        '4/5': 65,
        '5/5': 75,
        'Acessando:': 80,
        'Raspando:': 87,
        'atividades processadas': 93,
        'concluída': 96,
        'Raspagem concluída': 99,
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
            console.log(`[FRONT] Stream finalizado pelo servidor.`);
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // guarda linha incompleta

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            console.log(`[FRONT] Chunk processado:`, chunk);
            if (chunk.type === 'log') {
              setLogMsg(chunk.message);
              // Atualizar progresso com base em palavras-chave
              for (const [key, val] of Object.entries(progressMap)) {
                if (chunk.message.includes(key)) {
                  setProgress(val);
                  break;
                }
              }
            } else if (chunk.type === 'success') {
              finalData = chunk;
              setProgress(100);
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
          } catch (parseErr) {
            if (parseErr.message.includes('JSON')) continue; // chunk parcial
            throw parseErr;
          }
        }
      }

      if (finalData) {
        const coursesArray = finalData.data || [];
        const userNameInfo = finalData.nome || 'Aluno UNIFENAS';
        setTimeout(() => {
          onLoginSuccess(coursesArray, { matricula, senha, nome: userNameInfo });
        }, 400);
      } else {
        throw new Error('Resposta incompleta do servidor.');
      }

    } catch (err) {
      setError(err.message || 'Erro ao comunicar com o servidor. O backend está rodando?');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo-icon-large">UN</div>
          <h1>Ambiente Virtual</h1>
          <p>Faça login com seus dados do site da unifenas.aluno</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Matrícula (Não use e-mail)</label>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={matricula} 
              onChange={(e) => setMatricula(e.target.value.replace(/\D/g, ''))} 
              placeholder="Digite apenas os números. Ex: 200859251"
              required 
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Senha</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                required 
                disabled={loading}
                style={{ width: '100%', paddingRight: '45px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: 'absolute', right: '10px', background: 'transparent', border: 'none',
                  fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex'
                }}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? (
              <span className="loading-state">
                <svg className="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle></svg>
                Conectando ao Moodle...
              </span>
            ) : (
              "Entrar na Plataforma"
            )}
          </button>
        </form>
        
        {loading && (
          <div className="loading-container" style={{ marginTop: '20px', textAlign: 'center' }}>
            <p className="loading-log-msg" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{logMsg}</p>
          </div>
        )}

        {/* Indicador de status do servidor */}
        {!loading && serverStatus !== 'online' && (
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <svg className="spinner" viewBox="0 0 50 50" style={{ width: '14px', height: '14px' }}><circle cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle></svg>
            {serverStatus === 'checking' ? 'Verificando servidor...' : '⚡ Servidor acordando, aguarde...'}
          </div>
        )}
        {!loading && serverStatus === 'online' && (
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.78rem', color: '#4ade80' }}>
            ✅ Servidor pronto!
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
