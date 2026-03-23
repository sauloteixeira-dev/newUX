import React, { useState, useEffect } from 'react';
import './CourseView.css';

const ICONS = {
  'Fórum': '💬',
  'Tarefa': '📝',
  'Quiz/Avaliação': '❓',
  'Arquivo': '📄',
  'Ferramenta externa': '🖥️',
  'Página': '🌐',
  'Link Externo': '🔗',
  'Pasta': '📁',
  'Material': '📌',
};

const tipoIcon = (tipo = '') => ICONS[tipo] || '📌';

const CourseView = ({ curso }) => {
  // Quais seções estão expandidas
  const [expandidas, setExpandidas] = useState({});

  // Ao trocar de matéria, expandir automaticamente a primeira seção desbloqueada
  useEffect(() => {
    const primeiraDesbloqueada = curso.secoes?.findIndex(s => !s.locked);
    if (primeiraDesbloqueada !== undefined && primeiraDesbloqueada >= 0) {
      setExpandidas({ [primeiraDesbloqueada]: true });
    } else {
      setExpandidas({});
    }
  }, [curso.id]);

  const toggle = (idx) => {
    setExpandidas(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const secoes = curso.secoes || [];

  return (
    <div className="course-view">
      {/* Header */}
      <div className="course-header">
        <div className="course-header-info">
          <h2>{curso.name}</h2>
          {curso.progresso ? <span className="progresso-badge">{curso.progresso}</span> : null}
          {curso.professor ? (
            <a href={curso.professor.link || '#'} target="_blank" rel="noopener noreferrer" className="professor-badge">
              👨‍🏫 {curso.professor.nome}
            </a>
          ) : null}
        </div>
        <a href={curso.url} target="_blank" rel="noopener noreferrer" className="btn-moodle">
          Acessar no Moodle ↗
        </a>
      </div>

      <div className="course-content">
        {secoes.length > 0 ? (
          secoes.map((secao, idx) => {
            const aberta = !!expandidas[idx];
            const temAtividades = secao.atividades?.length > 0;

            return (
              <div key={idx} className={`secao-card ${secao.locked ? 'locked' : ''} ${aberta ? 'aberta' : ''}`}>
                {/* Cabeçalho clicável da seção */}
                <button
                  className="secao-toggle"
                  onClick={() => !secao.locked && toggle(idx)}
                  disabled={secao.locked}
                  aria-expanded={aberta}
                >
                  <div className="secao-toggle-left">
                    <span className="secao-chevron">{secao.locked ? '🔒' : (aberta ? '▼' : '▶')}</span>
                    <span className="secao-nome">{secao.nome}</span>
                  </div>
                  <div className="secao-toggle-right">
                    {secao.progressoTexto && !secao.locked && (
                      <span className="progresso-secao">{secao.progressoTexto}</span>
                    )}
                    {temAtividades && (
                      <span className="badge-qtd">{secao.atividades.length} itens</span>
                    )}
                  </div>
                </button>

                {/* Disponibilidade se bloqueada */}
                {secao.locked && secao.disponibilidade && (
                  <p className="disponibilidade-info">{secao.disponibilidade}</p>
                )}

                {/* Lista de atividades (expandida) */}
                {aberta && (
                  <div className="atividades-lista">
                    {temAtividades ? (
                      secao.atividades.map((item, itemIdx) => (
                        <a
                          key={itemIdx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="atividade-item"
                          onClick={() => {
                            const recentes = JSON.parse(localStorage.getItem('lms_recent_links') || '[]');
                            if (!recentes.includes(item.url)) {
                              recentes.push(item.url);
                              localStorage.setItem('lms_recent_links', JSON.stringify(recentes));
                            }
                          }}
                        >
                          <div className="atividade-emoji">{tipoIcon(item.tipo)}</div>
                          <div className="atividade-content">
                            <span className="atividade-nome">{item.nome}</span>
                            <div className="atividade-badges">
                              <span className="atividade-tipo">{item.tipo}</span>
                              {item.notaStr && item.notaStr !== '-' && (
                                <span className="atividade-nota">{item.notaStr}</span>
                              )}
                            </div>
                          </div>
                        </a>
                      ))
                    ) : (
                      <div className="sem-atividades">
                        <span>Nenhuma atividade encontrada nesta seção.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="empty-aulas">
            <span>📭</span>
            <p>Nenhuma seção encontrada para esta matéria.</p>
            <a href={curso.url} target="_blank" rel="noopener noreferrer" className="btn-moodle">
              Abrir no Moodle
            </a>
          </div>
        )}

        {/* Resumo das Notas */}
        {curso.notasResult && (curso.notasResult.somaModulos.length > 0 || curso.notasResult.totalCurso !== '-') && (
          <div className="secao-card aberta" style={{marginTop: 30, border: '2px solid #3b82f6'}}>
             <div className="secao-toggle" style={{cursor: 'default'}}>
               <div className="secao-toggle-left">
                 <span className="secao-chevron">📊</span>
                 <span className="secao-nome" style={{color: '#3b82f6'}}>Resumo de Notas do Curso</span>
               </div>
             </div>
             <div className="atividades-lista" style={{padding: '15px 20px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {curso.notasResult.somaModulos.map((mod, mi) => (
                  <div key={mi} style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 5}}>
                    <strong style={{opacity: 0.9}}>{mod.nome}</strong>
                    <span style={{fontWeight: 'bold', color: '#60a5fa'}}>{mod.nota} pts</span>
                  </div>
                ))}
                <div style={{display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: '1.2rem', fontWeight: 'bold'}}>
                  <strong style={{color: '#10b981'}}>Total do Curso</strong>
                  <span style={{color: '#10b981'}}>{curso.notasResult.totalCurso} pts</span>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseView;
