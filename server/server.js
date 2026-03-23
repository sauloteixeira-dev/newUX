import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Utilitário: sleep
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Utilitário: Bloquear assets inúteis no Puppeteer
const blockAssets = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort();
        else req.continue();
    });
};

// Cria cliente axios com cookies de sessão do Puppeteer
const buildHttpSession = (cookies) => {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return axios.create({
        headers: {
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        timeout: 20000,
    });
};

app.post('/api/login', async (req, res) => {
    const { matricula, senha } = req.body;

    // Configura streaming de resposta (NDJSON)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();

    const sendLog = (msg) => {
        console.log(msg);
        try { res.write(JSON.stringify({ type: 'log', message: msg }) + '\n'); } catch (_) { }
    };

    if (!matricula || !senha) {
        res.write(JSON.stringify({ type: 'error', error: 'Matrícula e Senha são obrigatórios' }) + '\n');
        return res.end();
    }

    let browser;
    try {
        sendLog(`[🚀] Iniciando robô para a matrícula: ${matricula}`);

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await blockAssets(page); // 🚀 Ativa modo turbo

        // ─── ETAPA 1: Login no Portal do Aluno ───────────────────────────────────
        sendLog('[1/5] 🌐 Abrindo o Portal do Aluno...');
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Preenche matrícula
        await page.waitForSelector('#username', { timeout: 15000 });
        await page.click('#username', { clickCount: 3 });
        await page.type('#username', matricula, { delay: 50 });

        // Preenche senha
        await page.waitForSelector('#password', { timeout: 10000 });
        await page.click('#password', { clickCount: 3 });
        await page.type('#password', senha, { delay: 50 });

        sendLog('[1/5] 🔑 Credenciais preenchidas. Clicando em Entrar...');

        const btnEntrar = await page.$('button[type="submit"]');
        if (btnEntrar) {
            await btnEntrar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        sendLog('[1/5] ⏳ Aguardando autenticação do Portal...');
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            sleep(15000)
        ]).catch(() => { });
        await sleep(4000); // extra para cookies SSO

        const urlAposLogin = page.url();
        sendLog(`[1/5] ✓ Autenticado no Portal!`);

        const aindaNoLogin = urlAposLogin.includes('/login') || urlAposLogin === 'https://aluno.unifenas.br/';
        const campoAindaVisivel = await page.$('#username');
        if (aindaNoLogin && campoAindaVisivel) {
            const errMsg = await page.evaluate(() => {
                const e = document.querySelector('.alert, .error, .invalid-feedback, [class*="error"]');
                return e ? e.textContent.trim() : '';
            });
            throw new Error(`Login no Portal falhou. ${errMsg || 'Verifique matrícula e senha.'}`);
        }

        // ─── ETAPA 2: Navegar para auto-login-moodle ────────────────────────────
        sendLog('[2/5] 🔄 Conectando ao AVA Moodle via SSO...');
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(5000);

        sendLog(`[2/5] ✓ Sessão Moodle ativa!`);

        // ─── ETAPA 3: Acessar Meus Cursos diretamente ──────────────────────────
        sendLog('[3/5] 📚 Buscando suas matérias no AVA...');
        await page.goto('https://ava.unifenas.br/my/courses.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);

        const urlMoodle = page.url();
        if (urlMoodle.includes('/login/index.php')) {
            throw new Error('O SSO falhou — o Moodle não reconheceu a sessão do Portal. Tente novamente.');
        }

        // ─── ETAPA 4: Raspar lista de cursos e Nome do Aluno ────────────────────
        sendLog('[4/5] 🎓 Extraindo informações de usuário e matérias...');

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

        sendLog(`[4/5] 👤 Aluno: ${nomeAluno || 'identificado'}`);

        await page.waitForSelector('[data-region="course-content"], .course-summaryitem, .course-listitem', {
            timeout: 20000
        }).catch(() => sendLog('  ⚠️ Timeout aguardando cards, tentando extrair mesmo assim...'));
        await sleep(2000);

        const courses = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll(
                '[data-region="course-content"][data-course-id], .course-summaryitem[data-region="course-content"]'
            ));
            return items.map(item => {
                const courseId = item.getAttribute('data-course-id');
                const linkEl = item.querySelector('a.coursename, a.aalink.coursename');
                let name = '';
                if (linkEl) {
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
                    name = name.replace(/^Curso é favorito\s*/i, '').trim();
                }
                const url = linkEl ? linkEl.href : `https://ava.unifenas.br/course/view.php?id=${courseId}`;
                const progressEl = item.querySelector('.progress-bar');
                const progresso = progressEl ? (progressEl.getAttribute('aria-valuenow') || '').trim() : '';
                const progressoTexto = progressEl ? `${progresso}% completo` : '';
                return { id: courseId, name: name.replace(/\s+/g, ' ').trim(), url, progresso: progressoTexto, secoes: [] };
            }).filter(c => c.name && c.name.length > 2);
        });

        if (courses.length === 0) {
            throw new Error('Nenhuma matéria encontrada em "Meus Cursos". O login pode ter falhado silenciosamente.');
        }

        sendLog(`[4/5] ✅ ${courses.length} matérias encontradas!`);

        // ─── Extrair cookies para HTTP direto ────────────────────────────────
        const allCookies = await page.cookies('https://ava.unifenas.br');
        const http = buildHttpSession(allCookies);
        sendLog('[5/5] 📖 Entrando em cada matéria para raspar as seções...');

        // Helper: busca HTML via HTTP e retorna cheerio
        const getHtml = async (url) => {
            const resp = await http.get(url);
            return cheerio.load(resp.data);
        };

        // ─── Processar cursos em paralelo (lotes de 2) ──────────────────────
        const processarCurso = async (curso) => {
            sendLog(`  → Acessando: ${curso.name}`);
            try {
                const $ = await getHtml(curso.url);

                // Extrair professor via HTTP+cheerio
                const profLink = $('a.view-user-profile-link').first();
                if (profLink.length) {
                    curso.professor = { nome: (profLink.attr('title') || profLink.text()).trim(), link: profLink.attr('href') || '#' };
                } else {
                    const contactLink = $('.block_course_contacts a[href*="message/"], .block_course_contacts a[href*="user/"]').first();
                    if (contactLink.length) curso.professor = { nome: contactLink.text().trim(), link: contactLink.attr('href') };
                }

                // Extrair seções via HTTP+cheerio
                const secoes = [];
                $('li.section.main[data-sectionid]').each((_, section) => {
                    const $s = $(section);
                    const nome = $s.find('h2.sectionname').text().trim() || `Seção ${$s.attr('data-number')}`;
                    const linkEl = $s.find('.section-header a').first();
                    const url = linkEl.attr('href') || '';
                    const locked = $s.find('.fa-lock').length > 0;
                    const disponibilidade = $s.find('.availabilityinfo').text().replace(/\s+/g, ' ').trim().substring(0, 200);
                    const progressoTexto = $s.find('.progress-text span').text().trim() || '';
                    secoes.push({ nome, url, locked, disponibilidade, progressoTexto, atividades: [] });
                });

                // ─── Para cada seção: HTTP direto + cheerio ─────────────────
                for (const secao of secoes) {
                    if (secao.locked || !secao.url) continue;
                    try {
                        sendLog(`       📖 Buscando: ${secao.nome}`);
                        const $s = await getHtml(secao.url);
                        const atividades = [];
                        $s('li.activity[id^="module-"]').each((_, act) => {
                            const $a = $s(act);
                            if ($a.hasClass('modtype_label')) return;
                            const actLink = $a.find('a[href*="mod/"], a[href*="course/"]').first();
                            if (!actLink.length) return;
                            let nome = '';
                            const instanceNode = $a.find('.instancename');
                            if (instanceNode.length) {
                                nome = instanceNode.clone().children('.visually-hidden, .hidden, .accesshide, .sr-only').remove().end().text().trim();
                                if (!nome) nome = instanceNode.text().replace(/\s+/g, ' ').trim();
                            }
                            if (!nome) nome = actLink.text().replace(/\s+/g, ' ').trim();

                            // Limpar qualquer tipo que ainda sobrar no final do nome (ex: "Aula 1 Página", "Video Ferramenta externa")
                            nome = nome.replace(/\s*(Arquivo|Ferramenta externa|Fórum|Tarefa|Questionário|Quiz|Página|URL|Pasta|Material|Oculto para estudantes)$/i, '').trim();
                            let tipo = 'Material';
                            if ($a.hasClass('modtype_forum')) tipo = 'Fórum';
                            else if ($a.hasClass('modtype_assign')) tipo = 'Tarefa';
                            else if ($a.hasClass('modtype_quiz')) tipo = 'Quiz/Avaliação';
                            else if ($a.hasClass('modtype_resource')) tipo = 'Arquivo';
                            else if ($a.hasClass('modtype_lti')) tipo = 'Ferramenta externa';
                            else if ($a.hasClass('modtype_page')) tipo = 'Página';
                            else if ($a.hasClass('modtype_url')) tipo = 'Link Externo';
                            else if ($a.hasClass('modtype_folder')) tipo = 'Pasta';
                            if (nome) atividades.push({ nome, url: actLink.attr('href'), tipo });
                        });

                        // ─── BYPASS via Puppeteer (necessário para JS) ──────
                        const processBypass = async (atv) => {
                            if (atv.tipo !== 'Arquivo' && atv.tipo !== 'Link Externo') return;
                            let actPage = null;
                            try {
                                sendLog(`           🔍 Buscando link de: ${atv.nome}`);
                                actPage = await browser.newPage();
                                await blockAssets(actPage);
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
                                            if (target.type() === 'page') resolve(await target.page());
                                        });
                                    });
                                    if (hasForm) {
                                        await actPage.click(formBtnSelector);
                                    } else {
                                        await actPage.evaluate(() => {
                                            const links = Array.from(document.querySelectorAll('a'));
                                            const t = links.find(a => a.textContent.toLowerCase().includes('abrir em uma nova janela') || a.parentElement.classList.contains('urlworkaround') || a.parentElement.classList.contains('resourceworkaround'));
                                            if (t) t.click();
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
                                            const e = document.querySelector('iframe#resourceobject, object#resourceobject');
                                            return e ? (e.src || e.data) : null;
                                        });
                                        if (embedUrl) atv.url = embedUrl;
                                        else if (actPage.url() !== atv.url) atv.url = actPage.url();
                                    }
                                } else {
                                    const embedUrl = await actPage.evaluate(() => {
                                        const e = document.querySelector('iframe#resourceobject, object#resourceobject');
                                        return e ? (e.src || e.data) : null;
                                    });
                                    if (embedUrl) atv.url = embedUrl;
                                }
                                if (actPage && !actPage.isClosed()) await actPage.close();
                            } catch (e) {
                                if (actPage && !actPage.isClosed()) await actPage.close();
                            }
                        };

                        const bypassBatchSize = 5;
                        for (let i = 0; i < atividades.length; i += bypassBatchSize) {
                            await Promise.all(atividades.slice(i, i + bypassBatchSize).map(processBypass));
                        }

                        secao.atividades = atividades;
                        sendLog(`         ✓ ${atividades.length} atividades processadas`);
                    } catch (e) {
                        sendLog(`         ✗ Erro na seção "${secao.nome}": ${e.message}`);
                    }
                }

                curso.secoes = secoes;
                sendLog(`     ✓ ${curso.name} seções concluídas`);

                // ─── Notas via HTTP+cheerio (sem browser!) ───────────────────
                try {
                    sendLog(`     📊 Buscando notas de ${curso.name}...`);
                    const $g = await getHtml(`https://ava.unifenas.br/grade/report/index.php?id=${curso.id}`);
                    const notasAtividades = {};
                    const somaModulos = [];
                    let totalCurso = '-';
                    $g('table.user-grade tbody tr').each((_, tr) => {
                        const $tr = $g(tr);
                        const th = $tr.find('th.column-itemname');
                        const td = $tr.find('td.column-grade');
                        if (!th.length || !td.length) return;
                        const tagNome = th.find('.gradeitemheader, a').first();
                        if (!tagNome.length) return;
                        const name = tagNome.text().trim();
                        const gradeMatch = td.text().match(/\d+,\d+|\d+\.\d+|\d+/);
                        const gradeText = gradeMatch ? gradeMatch[0] : '-';
                        if ($tr.hasClass('courseitem') || th.hasClass('courseitem')) {
                            totalCurso = gradeText;
                        } else if ($tr.hasClass('categoryitem') || th.hasClass('categoryitem')) {
                            somaModulos.push({ nome: name, nota: gradeText });
                        } else {
                            const cleanName = name.replace(/^Avaliac(\u00e3|a)o global do f(\u00f3|o)rum\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
                            if (cleanName) notasAtividades[cleanName] = gradeText;
                        }
                    });
                    curso.notasResult = { notasAtividades, somaModulos, totalCurso };
                    // Associar notas às atividades
                    curso.secoes.forEach(sec => {
                        (sec.atividades || []).forEach(atv => {
                            const cleanAtvName = atv.nome.replace(/\s+/g, ' ').trim().toLowerCase();
                            const keys = Object.keys(notasAtividades);
                            const matchKey = keys.find(k => k.length > 3 && (k === cleanAtvName || k.includes(cleanAtvName) || cleanAtvName.includes(k)));
                            if (matchKey) atv.notaStr = notasAtividades[matchKey];
                        });
                    });
                    sendLog(`     ✓ Notas extraídas (${Object.keys(notasAtividades).length} itens)`);
                } catch (errGrade) {
                    sendLog(`     ✗ Aviso: erro ao buscar notas: ${errGrade.message}`);
                }

            } catch (err) {
                sendLog(`     ✗ Erro ao raspar "${curso.name}": ${err.message}`);
                curso.secoes = [];
                curso.erro = err.message;
            }
        };

        // Processar cursos em lotes paralelos de 2
        const courseBatchSize = 2;
        for (let i = 0; i < courses.length; i += courseBatchSize) {
            await Promise.all(courses.slice(i, i + courseBatchSize).map(processarCurso));
        }


        await browser.close();
        sendLog(`[🎉] Raspagem concluída! ${courses.length} matérias prontas.`);

        res.write(JSON.stringify({ type: 'success', matricula, nome: nomeAluno || 'Aluno UNIFENAS', data: courses }) + '\n');
        res.end();

    } catch (error) {
        console.error(`\n[❌] Erro crítico: ${error.message}`);
        if (browser) await browser.close();
        res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
        res.end();
    }
});

app.post('/api/sync-recent', async (req, res) => {
    const { matricula, senha, urls } = req.body;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();

    const sendLog = (msg) => {
        console.log(msg);
        try { res.write(JSON.stringify({ type: 'log', message: msg }) + '\n'); } catch (_) { }
    };

    if (!matricula || !senha || !urls || !Array.isArray(urls) || urls.length === 0) {
        res.write(JSON.stringify({ type: 'error', error: 'Matrícula, Senha e URLs são obrigatórios' }) + '\n');
        return res.end();
    }

    let browser;
    try {
        sendLog(`[🚀] Sincronizando ${urls.length} aula(s) recente(s)...`);

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await blockAssets(page);

        sendLog('[1/3] 🌐 Autenticando para o acesso rápido...');
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#username', { timeout: 15000 });
        await page.type('#username', matricula, { delay: 50 });
        await page.type('#password', senha, { delay: 50 });
        const btnEntrar = await page.$('button[type="submit"]');
        if (btnEntrar) { await btnEntrar.click(); } else { await page.keyboard.press('Enter'); }

        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            sleep(15000)
        ]).catch(() => { });
        await sleep(3000);

        sendLog('[2/3] 🔄 Conectando SSO Moodle...');
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4500);

        sendLog('[3/3] 📖 Confirmando aulas acessadas... (By-pass)');
        const processBypass = async (url) => {
            let actPage = null;
            try {
                sendLog(`  -> Acessando: ${url}`);
                actPage = await browser.newPage();
                await blockAssets(actPage);
                await actPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await actPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
                            if (target.type() === 'page') { resolve(await target.page()); }
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
                    if (result && result !== actPage) await result.close();
                }
                if (actPage && !actPage.isClosed()) await actPage.close();
                return { url, status: 'ok' };
            } catch (e) {
                if (actPage && !actPage.isClosed()) await actPage.close();
                return { url, status: 'error', error: e.message };
            }
        };

        const bypassBatchSize = 3;
        const results = [];
        for (let i = 0; i < urls.length; i += bypassBatchSize) {
            const batch = urls.slice(i, i + bypassBatchSize);
            const batchResults = await Promise.all(batch.map(processBypass));
            results.push(...batchResults);
        }

        await browser.close();
        sendLog(`[🎉] Atualização de links recentes concluída!`);

        res.write(JSON.stringify({ type: 'success', matricula, results }) + '\n');
        res.end();

    } catch (error) {
        console.error(`\n[❌] Erro ao sincronizar recentes: ${error.message}`);
        if (browser) await browser.close();
        res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`\n🤖 Express Scraper API - UNIFENAS`);
    console.log(`✅ Rodando na porta ${PORT}\n`);
});
