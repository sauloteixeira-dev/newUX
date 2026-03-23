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
  const [activeCourseId, setActiveCourseId] = useState(() => {
    const saved = localStorage.getItem('lms_session');
    if (!saved) return null;
    const { cursos } = JSON.parse(saved);
    return cursos && cursos.length > 0 ? cursos[0].id : null;
  });
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
        console.log(`[Sync] Próxima atualização completa em ~${restante} min(s).`);
      }
    }
  }, [isAuthenticated, user]);

  React.useEffect(() => {
    let intervalId;
    if (isAuthenticated && user && user.senha) {
      intervalId = setInterval(() => {
        const recentes = JSON.parse(localStorage.getItem('lms_recent_links') || '[]');
        if (recentes.length > 0 && !isSyncing) {
          performRecentSync(user.matricula, user.senha, recentes);
        }
      }, 60000); // Checa a cada 1 minuto se há links recentes para rodar
    }
    return () => clearInterval(intervalId);
  }, [isAuthenticated, user, isSyncing]);

  const performRecentSync = async (mat, sen, urls) => {
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:3001/api/sync-recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: mat, senha: sen, urls })
      });
      if (response.ok) {
        // Se concluiu com sucesso, limpa os links do storage
        console.log('[Sync-Recent] Atualização de aulas recentes concluída.');
        // Pode haver novos itens clicados no meio do processo, filtramos os apenas processados
        const atuais = JSON.parse(localStorage.getItem('lms_recent_links') || '[]');
        const novos = atuais.filter(url => !urls.includes(url));
        localStorage.setItem('lms_recent_links', JSON.stringify(novos));
      }
    } catch (err) {
      console.error('Falha no sync de recentes em background:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const performBackgroundSync = async (mat, sen) => {
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: mat, senha: sen })
      });

      if (!response.body) throw new Error('Sem streaming');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === 'success') finalData = chunk;
          } catch (_) {}
        }
      }

      if (finalData) {
        const coursesArray = finalData.data || finalData;
        const processedCursos = coursesArray.map(curso => ({
          ...curso,
          progresso: curso.progresso || 0
        }));
        setCursos(processedCursos);
        localStorage.setItem('lms_session', JSON.stringify({
          isAuthenticated: true,
          user: user,
          cursos: processedCursos
        }));
        localStorage.setItem('lms_last_sync', String(Date.now()));
        console.log('[Sync] Background sync com notas concluído!');
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
