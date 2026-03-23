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
                        >
                          <span className="atividade-emoji">{tipoIcon(item.tipo)}</span>
                          <span className="atividade-nome">{item.nome}</span>
                          <span className="atividade-tipo">{item.tipo}</span>
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
      </div>
    </div>
  );
};

export default CourseView;
