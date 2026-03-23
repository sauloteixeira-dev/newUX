import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import CourseView from './components/CourseView';
import Login from './components/Login';

function App() {
  // Inicializar com LocalStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = localStorage.getItem('lms_session');
    return saved ? JSON.parse(saved).isAuthenticated : false;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lms_session');
    return saved ? JSON.parse(saved).user : null;
  });
  const [cursos, setCursos] = useState(() => {
    const saved = localStorage.getItem('lms_session');
    return saved ? JSON.parse(saved).cursos : [];
  });
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('lms_theme') || 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasSynced = React.useRef(false);

  React.useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('lms_theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (isAuthenticated && user && user.senha && !hasSynced.current) {
      const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
      const lastSync = parseInt(localStorage.getItem('lms_last_sync') || '0', 10);
      const agora = Date.now();

      if (agora - lastSync >= SYNC_INTERVAL_MS) {
        hasSynced.current = true;
        localStorage.setItem('lms_last_sync', String(agora));
        performBackgroundSync(user.matricula, user.senha);
      } else {
        const restante = Math.round((SYNC_INTERVAL_MS - (agora - lastSync)) / 60000);
        console.log(`[Sync] Próxima atualização em ~${restante} min(s). Usando cache.`);
      }
    }
  }, [isAuthenticated, user]);

  const performBackgroundSync = async (mat, sen) => {
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: mat, senha: sen })
      });
      if (response.ok) {
        const data = await response.json();
        const coursesArray = data.data || data;
        const processedCursos = coursesArray.map(curso => ({
          ...curso,
          progresso: curso.progresso || 0
        }));
        setCursos(processedCursos);
        
        // Atualiza a info do storage no background silenciosamente
        localStorage.setItem('lms_session', JSON.stringify({
          isAuthenticated: true,
          user: user,
          cursos: processedCursos
        }));
      }
    } catch (err) {
      console.error('Falha no sync em background:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleLoginSuccess = (cursosRaspados, userInfo) => {
    // Calculando progresso fictício (ou lendo progresso da API)
    const processedCursos = cursosRaspados.map(curso => ({
      ...curso,
      progresso: curso.progresso || 0
    }));

    setCursos(processedCursos);
    setUser(userInfo);
    setIsAuthenticated(true);
    
    if (processedCursos.length > 0) {
      setActiveCourseId(processedCursos[0].id);
    }
    
    // Salvar no storage
    localStorage.setItem('lms_session', JSON.stringify({
      isAuthenticated: true,
      user: userInfo,
      cursos: processedCursos
    }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setCursos([]);
    setActiveCourseId(null);
    localStorage.removeItem('lms_session');
    localStorage.removeItem('lms_last_sync'); // reinicia o contador de sync
    hasSynced.current = false;
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const activeCourse = cursos.find(c => c.id === activeCourseId);

  return (
    <div className="lms-app">
      <Sidebar 
        cursos={cursos} 
        activeCourseId={activeCourseId} 
        onSelectCourse={(id) => { setActiveCourseId(id); setSidebarOpen(false); }} 
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="lms-main-content">
        <header className="auth-header">
           <button className="btn-mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
           </button>
           <div className="header-spacer"></div>
           {isSyncing && <span className="sync-badge" title="Atualizando robô pelo Moodle ocultamente">🔄 Att. em tempo real</span>}
           <button onClick={toggleTheme} className="btn-theme" title="Alternar Tema">
             {theme === 'dark' ? '☀️' : '🌙'}
           </button>
           <span className="user-greeting">Bem-vindo, {user?.nome || 'Aluno'}</span>
           <button onClick={handleLogout} className="btn-logout">Sair do Moodle</button>
        </header>

        {activeCourse ? (
          <CourseView 
            key={activeCourse.id} 
            curso={activeCourse} 
          />
        ) : (
          <div className="empty-state">Nenhum curso carregado do Moodle.</div>
        )}
      </main>
    </div>
  );
}

export default App;
