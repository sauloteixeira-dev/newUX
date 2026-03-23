import React from 'react';
import './Sidebar.css';

const Sidebar = ({ cursos, activeCourseId, onSelectCourse, user }) => {
  return (
    <aside className="lms-sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">UN</div>
          <h2>Portal ADS Express</h2>
        </div>
      </div>
      
      <nav className="cursos-nav">
        <span className="nav-title">Minhas Disciplinas ({cursos.length})</span>
        <ul>
          {cursos.map(curso => (
            <li 
              key={curso.id} 
              className={`nav-item ${curso.id === activeCourseId ? 'active' : ''}`}
              onClick={() => onSelectCourse(curso.id)}
            >
              <div className="curso-bullet"></div>
              <div className="curso-info">
                <span className="curso-nome" title={curso.name}>{curso.name}</span>
                <div className="curso-progresso-mini-bg">
                  <div 
                    className="barra-mini" 
                    style={{ 
                      width: curso.progresso || '0%',
                      backgroundColor: curso.progresso === '100% completo' ? '#22c55e' : '#0056b3'
                    }}
                  ></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-mini">
          <div className="avatar-mini">{user?.nome ? user.nome.substring(0, 2).toUpperCase() : 'AL'}</div>
          <div className="user-details">
            <span className="user-name">{user?.nome || 'Aluno UNIFENAS'}</span>
            <span className="user-matricula">{user?.matricula ? `Matrícula: ${user.matricula}` : 'Portal do Aluno'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
