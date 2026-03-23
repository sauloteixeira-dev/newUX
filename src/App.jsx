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
        onSelectCourse={setActiveCourseId} 
      />
      <main className="lms-main-content">
        <header className="auth-header">
           <span>Bem-vindo, {user?.nome || 'Aluno'}</span>
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
