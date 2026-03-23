import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(150);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!matricula || !senha) return;

    setLoading(true);
    setError('');
    setTimeLeft(150);

    const timerInterval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha })
      });

      if (!response.ok) {
        clearInterval(timerInterval);
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao autenticar.');
      }

      const data = await response.json();
      
      clearInterval(timerInterval);
      
      setTimeout(() => {
        const coursesArray = data.data || data; // Extraindo a lista final
        const userNameInfo = data.nome || "Aluno UNIFENAS";
        onLoginSuccess(coursesArray, { matricula, senha, nome: userNameInfo });
      }, 500);
    } catch (err) {
      clearInterval(timerInterval);
      setError(err.message || 'Erro ao comunicar com o servidor. O backend está rodando?');
      setLoading(false);
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
            <input 
              type="password" 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              required 
              disabled={loading}
            />
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
          <div className="loading-container" style={{ marginTop: '20px' }}>
            <p className="loading-info" style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Nosso robô está nos bastidores mapeando as disciplinas...
            </p>
            <div style={{ width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '8px', height: '14px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ 
                width: `${Math.min(100, ((150 - timeLeft) / 150) * 100)}%`, 
                backgroundColor: 'var(--primary)', 
                height: '100%', 
                transition: 'width 1s linear' 
              }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--primary)' }}>
                ⏱️ Tempo estimado: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Raspando o Moodle...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
