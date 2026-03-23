import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import CourseView from './components/CourseView';
import Login from './components/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  React.useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleLoginSuccess = (cursosRaspados, userInfo) => {
    // Calculando progresso fictício para manter a UI agradável (ou lendo progresso da API)
    const processedCursos = cursosRaspados.map(curso => ({
      ...curso,
      progresso: curso.progresso || 0
    }));

    setCursos(processedCursos);
    setUser(userInfo);
    if (processedCursos.length > 0) {
      setActiveCourseId(processedCursos[0].id);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setCursos([]);
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
