import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Utilitário: sleep
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Utilitário: Bloquear assets inúteis (Imagens, CSS, Fonts) para performance extrema
const blockAssets = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
            req.abort();
        } else {
            req.continue();
        }
    });
};

app.post('/api/login', async (req, res) => {
    const { matricula, senha } = req.body;

    if (!matricula || !senha) {
        return res.status(400).json({ success: false, error: 'Matrícula e Senha são obrigatórios' });
    }

    let browser;
    try {
        console.log(`\n[🚀] Iniciando robô para a matrícula: ${matricula}`);

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await blockAssets(page); // 🚀 Ativa modo turbo

        // ─── ETAPA 1: Login no Portal do Aluno ───────────────────────────────────
        console.log('[1/5] 🌐 Abrindo o Portal do Aluno...');
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Preenche matrícula
        await page.waitForSelector('#username', { timeout: 15000 });
        await page.click('#username', { clickCount: 3 });
        await page.type('#username', matricula, { delay: 50 });

        // Preenche senha
        await page.waitForSelector('#password', { timeout: 10000 });
        await page.click('#password', { clickCount: 3 });
        await page.type('#password', senha, { delay: 50 });

        console.log('[1/5] 🔑 Credenciais preenchidas. Clicando em Entrar...');

        // Clica no botão Entrar e aguarda SEM esperar navigation (é SPA)
        const btnEntrar = await page.$('button[type="submit"]');
        if (btnEntrar) {
            await btnEntrar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        // Portal EAD usa SPA/Vue — aguardamos URL mudar ou o painel aparecer
        console.log('[1/5] ⏳ Aguardando autenticação do Portal (até 15s)...');
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            sleep(15000)
        ]).catch(() => {});
        await sleep(4000); // extra para cookies SSO

        const urlAposLogin = page.url();
        console.log(`[1/5] ✓ URL após login: ${urlAposLogin}`);

        // Verificar se ainda está na tela de login (falha)
        const aindaNoLogin = urlAposLogin.includes('/login') || urlAposLogin === 'https://aluno.unifenas.br/';
        const campoAindaVisivel = await page.$('#username');
        if (aindaNoLogin && campoAindaVisivel) {
            // Verifica se tem mensagem de erro
            const errMsg = await page.evaluate(() => {
                const e = document.querySelector('.alert, .error, .invalid-feedback, [class*="error"]');
                return e ? e.textContent.trim() : '';
            });
            throw new Error(`Login no Portal falhou. ${errMsg || 'Verifique matrícula e senha.'}`);
        }

        // ─── ETAPA 2: Navegar para auto-login-moodle ────────────────────────────
        console.log('[2/5] 🔄 Navegando para auto-login-moodle...');
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(5000); // espera SSO configurar cookies do Moodle

        const urlAposMoodle = page.url();
        console.log(`[2/5] ✓ URL após auto-login-moodle: ${urlAposMoodle}`);

        // ─── ETAPA 3: Acessar Meus Cursos diretamente ──────────────────────────
        console.log('[3/5] 📚 Acessando Meus Cursos no AVA Moodle...');
        await page.goto('https://ava.unifenas.br/my/courses.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);

        const urlMoodle = page.url();
        console.log(`[3/5] URL do Moodle: ${urlMoodle}`);

        // Se redirecionou para login do Moodle, o SSO falhou
        if (urlMoodle.includes('/login/index.php')) {
            throw new Error('O SSO falhou — o Moodle não reconheceu a sessão do Portal. Tente novamente.');
        }

        // ─── ETAPA 4: Raspar lista de cursos e Nome do Aluno ────────────────────
        console.log('[4/5] 🎓 Extraindo informações de usuário e matérias...');

        // Tentar pegar o nome de usuário do Moodle
        const nomeAluno = await page.evaluate(() => {
            const nameEl = document.querySelector('.usertext, .logininfo a, .userbutton .usertext');
            if (nameEl) return nameEl.textContent.replace(/\s+/g, ' ').trim();
            
            const loginInfo = document.querySelector('.logininfo');
            if (loginInfo) {
                const text = loginInfo.textContent.replace(/\s+/g, ' ');
                const match = text.match(/Você acessou como\s+(.+?)\s*\(/i);
                if (match) return match[1].trim();
            }
            return '';
        });
        
        console.log(`[4/5] 👤 Aluno identificado: ${nomeAluno || 'Nome não encontrado no header'}`);

        // Aguarda cards carregarem (são renderizados via JS)
        await page.waitForSelector('[data-region="course-content"], .course-summaryitem, .course-listitem', {
            timeout: 20000
        }).catch(() => console.log('  ⚠️ Timeout aguardando cards, tentando extrair mesmo assim...'));
        await sleep(2000);

        const courses = await page.evaluate(() => {
            // Seletor principal dos items de curso na página my/courses.php
            const items = Array.from(document.querySelectorAll(
                '[data-region="course-content"][data-course-id], .course-summaryitem[data-region="course-content"]'
            ));

            return items.map(item => {
                const courseId = item.getAttribute('data-course-id');
                // Link com nome do curso — classe aalink e coursename
                const linkEl = item.querySelector('a.coursename, a.aalink.coursename');
                let name = '';
                if (linkEl) {
                    // Filtra textos ocultos visually-hidden
                    name = Array.from(linkEl.childNodes)
                        .filter(n => {
                            if (n.nodeType === 3) return n.textContent.trim().length > 0;
                            if (n.nodeType === 1) return !n.classList.contains('visually-hidden') && !n.classList.contains('hidden');
                            return false;
                        })
                        .map(n => n.textContent.trim())
                        .join(' ')
                        .trim();
                    if (!name) name = linkEl.textContent.replace(/\s+/g, ' ').trim();
                    // Limpa prefixos de acessibilidade do Moodle
                    name = name.replace(/^Curso é favorito\s*/i, '').trim();
                }

                const url = linkEl ? linkEl.href : `https://ava.unifenas.br/course/view.php?id=${courseId}`;

                // Progresso
                const progressEl = item.querySelector('.progress-bar');
                const progresso = progressEl ? (progressEl.getAttribute('aria-valuenow') || '').trim() : '';
                const progressoTexto = progressEl ? `${progresso}% completo` : '';

                return { id: courseId, name: name.replace(/\s+/g, ' ').trim(), url, progresso: progressoTexto, secoes: [] };
            }).filter(c => c.name && c.name.length > 2);
        });

        if (courses.length === 0) {
            throw new Error('Nenhuma matéria encontrada em "Meus Cursos". O login pode ter falhado silenciosamente.');
        }

        console.log(`[4/5] ✅ ${courses.length} matérias encontradas!`);

        // ─── ETAPA 5: Para cada curso, raspar as seções ──────────────────────────
        console.log('[5/5] 📖 Entrando em cada matéria para raspar as seções...');

        for (const curso of courses) {
            console.log(`  → ${curso.name}`);
            try {
                await page.goto(curso.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                await sleep(2000);

                const secoes = await page.evaluate(() => {
                    const resultado = [];
                    const sectionItems = document.querySelectorAll('li.section.main[data-sectionid]');

                    sectionItems.forEach(section => {
                        const sectionNum = section.getAttribute('data-number');
                        const nameEl = section.querySelector('h2.sectionname');
                        const nome = nameEl ? nameEl.textContent.trim() : `Seção ${sectionNum}`;
                        const linkEl = section.querySelector('.section-header a');
                        const url = linkEl ? linkEl.href : '';
                        const locked = !!section.querySelector('.fa-lock');

                        let disponibilidade = '';
                        const availEl = section.querySelector('.availabilityinfo');
                        if (availEl) disponibilidade = availEl.textContent.replace(/\s+/g, ' ').trim().substring(0, 200);

                        const progressEl = section.querySelector('.progress-bar');
                        const progressText = section.querySelector('.progress-text span');
                        const progressoTexto = progressText ? progressText.textContent.trim() : (progressEl ? progressEl.style.width : '');

                        resultado.push({ nome, url, locked, disponibilidade, progressoTexto, atividades: [] });
                    });
                    return resultado;
                });

                // Para cada seção desbloqueada com URL, buscar as atividades internas
                for (const secao of secoes) {
                    if (secao.locked || !secao.url) continue;

                    try {
                        console.log(`       📖 Raspando atividades de: ${secao.nome}...`);
                        await page.goto(secao.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await sleep(1500);

                        const atividades = await page.evaluate(() => {
                            const lista = [];
                            document.querySelectorAll('li.activity[id^="module-"]').forEach(act => {
                                if (act.classList.contains('modtype_label')) return;

                                const actLink = act.querySelector('a[href*="mod/"], a[href*="course/"]');
                                if (!actLink) return;

                                let nome = '';
                                const instanceNode = act.querySelector('.instancename');
                                if (instanceNode) {
                                    nome = Array.from(instanceNode.childNodes)
                                        .filter(n => n.nodeType === 3)
                                        .map(n => n.textContent)
                                        .join('').trim();
                                    if (!nome) nome = instanceNode.textContent.replace(/\s+/g, ' ').trim();
                                }
                                if (!nome) nome = actLink.textContent.replace(/\s+/g, ' ').trim();

                                let tipo = 'Material';
                                if (act.classList.contains('modtype_forum')) tipo = 'Fórum';
                                else if (act.classList.contains('modtype_assign')) tipo = 'Tarefa';
                                else if (act.classList.contains('modtype_quiz')) tipo = 'Quiz/Avaliação';
                                else if (act.classList.contains('modtype_resource')) tipo = 'Arquivo';
                                else if (act.classList.contains('modtype_lti')) tipo = 'Ferramenta externa';
                                else if (act.classList.contains('modtype_page')) tipo = 'Página';
                                else if (act.classList.contains('modtype_url')) tipo = 'Link Externo';
                                else if (act.classList.contains('modtype_folder')) tipo = 'Pasta';

                                if (nome) lista.push({ nome, url: actLink.href, tipo });
                            });
                            return lista;
                        });

                        // ─── BYPASS (Paralelizado com limites) ───
                        const processBypass = async (atv) => {
                            if (atv.tipo !== 'Ferramenta externa' && atv.tipo !== 'Arquivo' && atv.tipo !== 'Link Externo') return;
                            let actPage = null;
                            try {
                                console.log(`           🔍 Buscando link de: ${atv.nome}`);
                                actPage = await browser.newPage();
                                await blockAssets(actPage); // 🚀
                                await actPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                                
                                await actPage.goto(atv.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                                
                                const formBtnSelector = 'form[action] button[type="submit"], input[type="submit"]';
                                const hasForm = await actPage.$(formBtnSelector);
                                let hasLink = false;
                                
                                if (!hasForm) {
                                     hasLink = await actPage.evaluate(() => {
                                        const links = Array.from(document.querySelectorAll('a'));
                                        return links.some(a => a.textContent.toLowerCase().includes('abrir em uma nova janela') || a.classList.contains('urlworkaround'));
                                     });
                                }

                                if (hasForm || hasLink) {
                                    const newPagePromise = new Promise(resolve => {
                                        browser.once('targetcreated', async target => {
                                            if (target.type() === 'page') {
                                                const novaAba = await target.page();
                                                resolve(novaAba);
                                            }
                                        });
                                    });

                                    if (hasForm) {
                                        await actPage.click(formBtnSelector);
                                    } else {
                                        await actPage.evaluate(() => {
                                            const links = Array.from(document.querySelectorAll('a'));
                                            const targetLink = links.find(a => a.textContent.toLowerCase().includes('abrir em uma nova janela') || a.parentElement.classList.contains('urlworkaround') || a.parentElement.classList.contains('resourceworkaround'));
                                            if (targetLink) targetLink.click();
                                        });
                                    }

                                    const result = await Promise.race([
                                        newPagePromise,
                                        actPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).then(() => actPage),
                                        sleep(4000).then(() => null)
                                    ]);

                                    if (result && result.url() !== 'about:blank') {
                                        atv.url = result.url();
                                        if (result !== actPage) await result.close();
                                    } else {
                                        const embedUrl = await actPage.evaluate(() => {
                                            const embed = document.querySelector('iframe#resourceobject, object#resourceobject');
                                            return embed ? (embed.src || embed.data) : null;
                                        });
                                        if (embedUrl) {
                                            atv.url = embedUrl;
                                        } else if (actPage.url() !== atv.url) {
                                            atv.url = actPage.url();
                                        }
                                    }
                                } else {
                                     const embedUrl = await actPage.evaluate(() => {
                                        const embed = document.querySelector('iframe#resourceobject, object#resourceobject');
                                        return embed ? (embed.src || embed.data) : null;
                                    });
                                    if (embedUrl) atv.url = embedUrl;
                                }
                                
                                if(actPage && !actPage.isClosed()) await actPage.close();
                            } catch (e) {
                                if(actPage && !actPage.isClosed()) await actPage.close();
                            }
                        };

                        // Executar bypass em lotes de 3 para não travar o node/puppeteer
                        const bypassBatchSize = 3;
                        for (let i = 0; i < atividades.length; i += bypassBatchSize) {
                            const batch = atividades.slice(i, i + bypassBatchSize);
                            await Promise.all(batch.map(processBypass));
                        }

                        secao.atividades = atividades;
                        console.log(`         ✓ ${atividades.length} atividades processadas`);
                    } catch (e) {
                        console.log(`         ✗ Erro ao raspar seção "${secao.nome}": ${e.message}`);
                    }
                }

                curso.secoes = secoes;
                console.log(`     ✓ ${secoes.length} seções com atividades raspadas`);

            } catch (err) {
                console.log(`     ✗ Erro ao raspar "${curso.name}": ${err.message}`);
                curso.secoes = [];
                curso.erro = err.message;
            }
        }

        await browser.close();
        console.log(`\n[🎉] Raspagem concluída! ${courses.length} matérias enviadas ao frontend.\n`);

        res.json({ success: true, matricula, nome: nomeAluno || 'Aluno UNIFENAS', data: courses });

    } catch (error) {
        console.error(`\n[❌] Erro crítico: ${error.message}`);
        if (browser) await browser.close();
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🤖 Express Scraper API - UNIFENAS`);
    console.log(`✅ Rodando na porta ${PORT}\n`);
});
