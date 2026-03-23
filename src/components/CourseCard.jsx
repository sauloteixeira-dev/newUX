import React from 'react';
import './CourseCard.css';

const CourseCard = ({ curso, onToggleMaterial }) => {
  return (
    <div className={`card-curso ${curso.status === 'completed' ? 'completed' : ''}`}>
      <div className="card-header">
        <div>
          <h3>{curso.nome}</h3>
          <span className="badge-codigo">{curso.codigo}</span>
        </div>
      </div>
      
      <div className="card-body">
        <div className="progresso-container">
          <div className="progresso-info">
            <span className="progresso-label">Progresso do Curso</span>
            <span className="progresso-porcentagem">{Math.round(curso.progresso)}%</span>
          </div>
          <div className="barra-fundo">
            <div className="barra" style={{ width: `${curso.progresso}%` }}></div>
          </div>
        </div>

        <div className="secao-aula">
          <h4>
            <span className="unidade-badge">Unidade {curso.unidade_atual.numero}</span> 
            {curso.unidade_atual.titulo}
          </h4>
          
          <div className="links-rapidos">
            {curso.unidade_atual.video_aula && (
              <a href={curso.unidade_atual.video_aula} target="_blank" rel="noopener noreferrer" className="btn-link video">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10zm-2 0a8 8 0 11-16 0 8 8 0 0116 0z" fill="currentColor"/></svg>
                Vídeo-aula
              </a>
            )}
            {curso.unidade_atual.pdf_resumo && (
              <a href={curso.unidade_atual.pdf_resumo} target="_blank" rel="noopener noreferrer" className="btn-link doc">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M6 3C4.34315 3 3 4.34315 3 6V18C3 19.6569 4.34315 21 6 21H18C19.6569 21 21 19.6569 21 18V6C21 4.34315 19.6569 3 18 3H6ZM5 6C5 5.44772 5.44772 5 6 5H18C18.5523 5 19 5.44772 19 6V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M7 8C7 7.44772 7.44772 7 8 7H16C16.5523 7 17 7.44772 17 8C17 8.55228 16.5523 9 16 9H8C7.44772 9 7 8.55228 7 8ZM7 12C7 11.4477 7.44772 11 8 11H16C16.5523 11 17 11.4477 17 12C17 12.5523 16.5523 13 16 13H8C7.44772 13 7 12.5523 7 12ZM8 15C7.44772 15 7 15.4477 7 16C7 16.5523 7.44772 17 8 17H12C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15H8Z" fill="currentColor"/></svg>
                Ler PDF
              </a>
            )}
          </div>
        </div>

        <div className="materiais-subtemas">
          <div className="materiais-header">
            <h5>Materiais Didáticos</h5>
            <span className="materiais-counter">
              {curso.unidade_atual.materiais_didaticos.filter(m => m.concluido).length} / {curso.unidade_atual.materiais_didaticos.length}
            </span>
          </div>
          <div className="materiais-lista">
            {curso.unidade_atual.materiais_didaticos.map((item) => (
              <div 
                key={item.id} 
                className={`material-item ${item.concluido ? 'concluido' : ''}`}
              >
                <div 
                  className="checkbox-customizado"
                  onClick={() => onToggleMaterial(curso.id, item.id)}
                  title="Marcar como concluído"
                >
                  {item.concluido && (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="material-label">
                  {item.label}
                  <svg className="external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginLeft: '6px', opacity: 0.5}}><path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-footer">
        <button className="btn-acesso-direto">
          Abrir no Moodle
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
