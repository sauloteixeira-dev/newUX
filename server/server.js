import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Utilitários globais ──────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Health-check — acordar o servidor do Render (cron externo chama a cada 14 min)
app.get('/ping', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Bloquear assets inúteis no Puppeteer (imagens, CSS, fontes, mídia)
const blockAssets = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });
};

// Flags comuns do Puppeteer para ambientes Linux sem sandbox (Render)
const PUPPETEER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Cria instância do axios com cookies de sessão autenticada do Puppeteer
const buildHttpSession = (cookies) => axios.create({
    headers: {
        'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; '),
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    timeout: 20000,
});

// ─── Função compartilhada: extrai atividades de um contexto Cheerio ───────────
const parseAtividades = ($ctx, $) => {
    const atividades = [];
    $ctx.find('li.activity[id^="module-"]').each((_, act) => {
        const $a = $(act);
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
        nome = nome.replace(/\s*(Arquivo|Ferramenta externa|Fórum|Tarefa|Questionário|Quiz|Página|URL|Pasta|Material|Oculto para estudantes)$/i, '').trim();
        if (!nome) return;

        let tipo = 'Material';
        if ($a.hasClass('modtype_forum')) tipo = 'Fórum';
        else if ($a.hasClass('modtype_assign')) tipo = 'Tarefa';
        else if ($a.hasClass('modtype_quiz')) tipo = 'Quiz/Avaliação';
        else if ($a.hasClass('modtype_resource')) tipo = 'Arquivo';
        else if ($a.hasClass('modtype_lti')) tipo = 'Ferramenta externa';
        else if ($a.hasClass('modtype_page')) tipo = 'Página';
        else if ($a.hasClass('modtype_url')) tipo = 'Link Externo';
        else if ($a.hasClass('modtype_folder')) tipo = 'Pasta';

        atividades.push({ nome, url: actLink.attr('href'), tipo });
    });
    return atividades;
};

// ─── Função compartilhada: bypass híbrido Axios → Cheerio → Puppeteer ────────
const makeBypassFn = (http, browser, sendLog) => async (atv) => {
    if (atv.tipo !== 'Arquivo' && atv.tipo !== 'Link Externo') return;
    try {
        // Tentativa 1: Axios puro — segue redirecionamentos HTTP
        const res = await http.get(atv.url, {
            maxRedirects: 5,
            validateStatus: s => s >= 200 && s < 400,
            timeout: 8000,
        });
        const finalUrl = res.request?.res?.responseUrl || res.request?.responseURL || '';
        if (finalUrl && !finalUrl.includes('mod/resource/view.php') && !finalUrl.includes('mod/url/view.php')) {
            atv.url = finalUrl;
            return;
        }

        // Tentativa 2: Cheerio no HTML — procura link de workaround
        const $ = cheerio.load(res.data);
        const workaround = $('.resourceworkaround a, .urlworkaround a').first().attr('href')
            || $('object#resourceobject').attr('data')
            || $('iframe#resourceobject').attr('src')
            || $('a[href$=".pdf"], a[href$=".docx"], a[href$=".pptx"], a[href$=".xlsx"]').first().attr('href');
        if (workaround) {
            atv.url = workaround;
            return;
        }

        // Tentativa 3: Puppeteer — apenas quando JS é realmente necessário
        sendLog(`           🔍 JS necessário para: ${atv.nome}`);
        let actPage = null;
        try {
            actPage = await browser.newPage();
            await blockAssets(actPage);
            await actPage.setUserAgent(USER_AGENT);
            await actPage.goto(atv.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const formBtnSelector = 'form[action] button[type="submit"], input[type="submit"]';
            const hasForm = await actPage.$(formBtnSelector);
            const hasLink = hasForm ? false : await actPage.evaluate(() =>
                Array.from(document.querySelectorAll('a')).some(a =>
                    a.textContent.toLowerCase().includes('abrir em uma nova janela') || a.classList.contains('urlworkaround')
                )
            );

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
                        const t = Array.from(document.querySelectorAll('a')).find(a =>
                            a.textContent.toLowerCase().includes('abrir em uma nova janela') ||
                            a.parentElement?.classList.contains('urlworkaround') ||
                            a.parentElement?.classList.contains('resourceworkaround')
                        );
                        if (t) t.click();
                    });
                }

                const result = await Promise.race([
                    newPagePromise,
                    actPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).then(() => actPage),
                    sleep(4000).then(() => null),
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
    } catch (e) {
        // Erro leve — mantém URL original sem travar o fluxo
        console.log(`Bypass ignorado para "${atv.nome}": ${e.message}`);
    }
};

// ─── Rota principal: Login + Raspagem completa ────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { matricula, senha } = req.body;

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
            args: PUPPETEER_ARGS,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent(USER_AGENT);
        await blockAssets(page);

        // ─── ETAPA 1: Login no Portal do Aluno ──────────────────────────────
        sendLog('[1/5] 🌐 Abrindo o Portal do Aluno...');
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.waitForSelector('#username', { timeout: 15000 });
        await page.click('#username', { clickCount: 3 });
        await page.type('#username', matricula, { delay: 40 });
        await page.waitForSelector('#password', { timeout: 10000 });
        await page.click('#password', { clickCount: 3 });
        await page.type('#password', senha, { delay: 40 });

        sendLog('[1/5] 🔑 Credenciais preenchidas. Clicando em Entrar...');
        const btnEntrar = await page.$('button[type="submit"]');
        if (btnEntrar) await btnEntrar.click();
        else await page.keyboard.press('Enter');

        sendLog('[1/5] ⏳ Aguardando autenticação do Portal...');
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
            sleep(20000),
        ]).catch(() => { });

        // Verifica falha de login
        const urlAposLogin = page.url();
        const aindaNoLogin = urlAposLogin.includes('/login') || urlAposLogin === 'https://aluno.unifenas.br/';
        const campoAindaVisivel = await page.$('#username');
        if (aindaNoLogin && campoAindaVisivel) {
            const errMsg = await page.evaluate(() => {
                const e = document.querySelector('.alert, .error, .invalid-feedback, [class*="error"]');
                return e ? e.textContent.trim() : '';
            });
            throw new Error(`Login no Portal falhou. ${errMsg || 'Verifique matrícula e senha.'}`);
        }
        sendLog('[1/5] ✓ Autenticado no Portal!');

        // ─── ETAPA 2: SSO → Moodle ──────────────────────────────────────────
        sendLog('[2/5] 🔄 Conectando ao AVA Moodle via SSO...');
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2', timeout: 60000 });
        // Sem sleep aqui — networkidle2 garante que o SSO completou
        sendLog('[2/5] ✓ Sessão Moodle ativa!');

        // ─── ETAPA 3: Meus Cursos ────────────────────────────────────────────
        sendLog('[3/5] 📚 Buscando suas matérias no AVA...');
        await page.goto('https://ava.unifenas.br/my/courses.php', { waitUntil: 'domcontentloaded', timeout: 60000 });

        if (page.url().includes('/login/index.php')) {
            throw new Error('O SSO falhou — o Moodle não reconheceu a sessão. Tente novamente.');
        }

        // ─── ETAPA 4: Extração de cursos e nome do aluno ────────────────────
        sendLog('[4/5] 🎓 Extraindo informações de usuário e matérias...');

        const nomeAluno = await page.evaluate(() => {
            const nameEl = document.querySelector('.usertext, .logininfo a, .userbutton .usertext');
            if (nameEl) return nameEl.textContent.replace(/\s+/g, ' ').trim();
            const loginInfo = document.querySelector('.logininfo');
            if (loginInfo) {
                const match = loginInfo.textContent.replace(/\s+/g, ' ').match(/Você acessou como\s+(.+?)\s*\(/i);
                if (match) return match[1].trim();
            }
            return '';
        });
        sendLog(`[4/5] 👤 Aluno: ${nomeAluno || 'identificado'}`);

        // Aguarda cards de curso aparecerem de fato (evita skeleton loaders)
        await page.waitForSelector(
            'a.coursename, .coursename a, .courses .coursebox',
            { timeout: 20000 }
        ).catch(() => sendLog('  ⚠️ Timeout aguardando nomes dos cursos, tentando extrair mesmo assim...'));
        await sleep(4000); // Dar tempo para renderizar todos os cards na tela após o AJAX

        const courses = await page.evaluate(() => {
            let items = Array.from(document.querySelectorAll('[data-region="course-content"][data-course-id], .course-summaryitem[data-region="course-content"]'));
            if (items.length === 0) items = Array.from(document.querySelectorAll('[data-course-id]'));
            if (items.length === 0) items = Array.from(document.querySelectorAll('.coursebox'));

            return items.map(item => {
                const courseId = item.getAttribute('data-course-id') || item.getAttribute('data-id') || '';
                const linkEl = item.querySelector('a.coursename, a.aalink.coursename, .coursename a, h3.coursename a, .info a[href*="course"]');
                let name = '';
                if (linkEl) {
                    name = Array.from(linkEl.childNodes)
                        .filter(n => {
                            if (n.nodeType === 3) return n.textContent.trim().length > 0;
                            if (n.nodeType === 1) return !n.classList.contains('visually-hidden') && !n.classList.contains('hidden');
                            return false;
                        })
                        .map(n => n.textContent.trim()).join(' ').trim();
                    if (!name) name = linkEl.textContent.replace(/\s+/g, ' ').trim();
                    name = name.replace(/^Curso é favorito\s*/i, '').trim();
                }
                const url = linkEl ? linkEl.href : (courseId ? `https://ava.unifenas.br/course/view.php?id=${courseId}` : '');
                if (!url) return null;
                const progressEl = item.querySelector('.progress-bar');
                const progresso = progressEl ? (progressEl.getAttribute('aria-valuenow') || '').trim() : '';
                return { id: courseId, name: name.replace(/\s+/g, ' ').trim(), url, progresso: progresso ? `${progresso}% completo` : '', secoes: [] };
            }).filter(c => c && c.name && c.name.length > 2);
        });

        if (courses.length === 0) {
            const pageTitle = await page.title();
            sendLog(`  ⚠️ Título da página atual: ${pageTitle}`);
            throw new Error('Nenhuma matéria encontrada em "Meus Cursos". O login pode ter falhado silenciosamente.');
        }
        sendLog(`[4/5] ✅ ${courses.length} matérias encontradas!`);

        // Extrai cookies para usar o Axios com a sessão autenticada
        const allCookies = await page.cookies('https://ava.unifenas.br');
        const http = buildHttpSession(allCookies);

        // Helper: busca página HTML via Axios+Cheerio
        const getHtml = async (url) => {
            const resp = await http.get(url);
            return cheerio.load(resp.data);
        };

        // Cria a função de bypass uma vez e reutiliza
        const processBypass = makeBypassFn(http, browser, sendLog);

        sendLog('[5/5] 📖 Entrando em cada matéria para raspar as seções...');

        // ─── Processar cursos em lotes paralelos de 2 ────────────────────────
        const processarCurso = async (curso) => {
            sendLog(`  → Acessando: ${curso.name}`);
            try {
                const $ = await getHtml(curso.url);

                // Professor
                const profLink = $('a.view-user-profile-link').first();
                if (profLink.length) {
                    curso.professor = { nome: (profLink.attr('title') || profLink.text()).trim(), link: profLink.attr('href') || '#' };
                } else {
                    const contactLink = $('.block_course_contacts a[href*="message/"], .block_course_contacts a[href*="user/"]').first();
                    if (contactLink.length) curso.professor = { nome: contactLink.text().trim(), link: contactLink.attr('href') };
                }

                // Seções
                const secoes = [];
                $('li.section.main[data-sectionid]').each((_, section) => {
                    const $s = $(section);
                    const nome = $s.find('h2.sectionname, h3.sectionname').text().trim() || `Seção ${$s.attr('data-number')}`;
                    const linkEl = $s.find('.section-header a, .sectionname a').first();
                    const url = linkEl.attr('href') || '';
                    const locked = $s.find('.fa-lock').length > 0;
                    const disponibilidade = $s.find('.availabilityinfo').text().replace(/\s+/g, ' ').trim().substring(0, 200);
                    const progressoTexto = $s.find('.progress-text span').text().trim() || '';
                    const atividades = parseAtividades($s, $);
                    secoes.push({ nome, url, locked, disponibilidade, progressoTexto, atividades });
                });

                // Para cada seção: busca sub-seção se necessário e resolve links
                for (const secao of secoes) {
                    if (secao.locked) continue;
                    try {
                        let atividades = secao.atividades;

                        // Só busca sub-seção se não carregou atividades e tem URL de seção separada
                        if (atividades.length === 0 && secao.url && secao.url.includes('&section=')) {
                            sendLog(`       📖 Buscando sub-seção: ${secao.nome}`);
                            const $s = await getHtml(secao.url);
                            atividades = parseAtividades($s.root(), $s);
                            if (atividades.length > 0) {
                                sendLog(`         ✓ ${atividades.length} atividades em ${secao.nome}`);
                            }
                        }

                        // Resolve URLs de arquivos/links (Axios→Cheerio→Puppeteer)
                        const bypassBatchSize = 3;
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
                sendLog(`     ✓ ${curso.name} concluído`);

                // Notas via Axios+Cheerio (sem Puppeteer)
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
                            const cleanName = name
                                .replace(/^Avaliac(\u00e3|a)o global do f(\u00f3|o)rum\s+/i, '')
                                .replace(/\s+/g, ' ').trim().toLowerCase();
                            if (cleanName) notasAtividades[cleanName] = gradeText;
                        }
                    });

                    curso.notasResult = { notasAtividades, somaModulos, totalCurso };

                    // Associa notas às atividades pelo nome
                    curso.secoes.forEach(sec => {
                        (sec.atividades || []).forEach(atv => {
                            const cleanAtvName = atv.nome.replace(/\s+/g, ' ').trim().toLowerCase();
                            const keys = Object.keys(notasAtividades);
                            const matchKey = keys.find(k =>
                                k.length > 3 && (k === cleanAtvName || k.includes(cleanAtvName) || cleanAtvName.includes(k))
                            );
                            if (matchKey) atv.notaStr = notasAtividades[matchKey];
                        });
                    });

                    sendLog(`     ✓ Notas extraídas (${Object.keys(notasAtividades).length} itens)`);
                } catch (errGrade) {
                    sendLog(`     ✗ Erro nas notas: ${errGrade.message}`);
                }

            } catch (err) {
                sendLog(`     ✗ Erro em "${curso.name}": ${err.message}`);
                curso.secoes = [];
                curso.erro = err.message;
            }
        };

        // Lotes de 2 cursos em paralelo
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
        if (browser) await browser.close().catch(() => { });
        res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
        res.end();
    }
});

// ─── Rota de sync-recente: re-autentica e acessa URLs recentes ────────────────
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

    if (!matricula || !senha || !Array.isArray(urls) || urls.length === 0) {
        res.write(JSON.stringify({ type: 'error', error: 'Matrícula, Senha e URLs são obrigatórios' }) + '\n');
        return res.end();
    }

    let browser;
    try {
        sendLog(`[🚀] Sincronizando ${urls.length} aula(s) recente(s)...`);

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: PUPPETEER_ARGS,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent(USER_AGENT);
        await blockAssets(page);

        // Autenticação rápida
        sendLog('[1/3] 🌐 Autenticando...');
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#username', { timeout: 15000 });
        await page.type('#username', matricula, { delay: 40 });
        await page.type('#password', senha, { delay: 40 });
        const btnEntrar = await page.$('button[type="submit"]');
        if (btnEntrar) await btnEntrar.click();
        else await page.keyboard.press('Enter');

        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
            sleep(20000),
        ]).catch(() => { });

        sendLog('[2/3] 🔄 Conectando SSO Moodle...');
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2', timeout: 60000 });
        // Sem sleep — networkidle2 já aguarda o SSO

        // Extrai cookies para usar Axios com sessão autenticada
        const allCookies = await page.cookies('https://ava.unifenas.br');
        const http = buildHttpSession(allCookies);

        sendLog('[3/3] 📖 Confirmando aulas acessadas...');
        const processBypass = makeBypassFn(http, browser, sendLog);

        // Adapta para aceitar URL pura (sync-recent passa strings, não objetos)
        const processUrl = async (url) => {
            const fakeAtv = { nome: url, url, tipo: 'Arquivo' };
            await processBypass(fakeAtv);
            return { url, status: 'ok' };
        };

        const bypassBatchSize = 3;
        const results = [];
        for (let i = 0; i < urls.length; i += bypassBatchSize) {
            const batch = urls.slice(i, i + bypassBatchSize);
            const batchResults = await Promise.all(batch.map(url =>
                processUrl(url).catch(e => ({ url, status: 'error', error: e.message }))
            ));
            results.push(...batchResults);
        }

        await browser.close();
        sendLog('[🎉] Atualização de links recentes concluída!');
        res.write(JSON.stringify({ type: 'success', matricula, results }) + '\n');
        res.end();

    } catch (error) {
        console.error(`\n[❌] Erro ao sincronizar recentes: ${error.message}`);
        if (browser) await browser.close().catch(() => { });
        res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
        res.end();
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🤖 Express Scraper API - UNIFENAS`);
    console.log(`✅ Rodando na porta ${PORT}\n`);
});
