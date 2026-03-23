import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!matricula || !senha) return;

    setLoading(true);
    setError('');
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return 92;
        return prev + Math.floor(Math.random() * 5) + 1;
      });
    }, 1000);

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha })
      });

      if (!response.ok) {
        clearInterval(progressInterval);
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao autenticar.');
      }

      const data = await response.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        const coursesArray = data.data || data; // Extraindo a lista final
        const userNameInfo = data.nome || "Aluno UNIFENAS";
        onLoginSuccess(coursesArray, { matricula, nome: userNameInfo });
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || 'Erro ao comunicar com o servidor. O backend está rodando?');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo-icon-large">UN</div>
          <h1>Portal ADS Express</h1>
          <p>Faça login com os seus dados do Moodle</p>
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
            <p className="loading-info" style={{ marginBottom: '8px' }}>Nosso robô está nos bastidores puxando as disciplinas...</p>
            <div style={{ width: '100%', backgroundColor: '#edf2f7', borderRadius: '8px', height: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, backgroundColor: '#4fd1c5', height: '100%', transition: 'width 0.5s ease-out' }}></div>
            </div>
            <span style={{ fontSize: '13px', color: '#718096', display: 'block', textAlign: 'center', marginTop: '8px', fontWeight: 'bold' }}>{progress}% Scraped</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
