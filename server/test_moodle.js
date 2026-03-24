import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log("Iniciando Puppeteer...");
    const browser = await puppeteer.launch({ headless: false }); // Vendo a mágica acontecer localmente
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log("Abrindo https://aluno.unifenas.br/...");
        await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('#username');
        await page.type('#username', '200859251');
        await page.type('#password', '11170059686');
        console.log("Clicando em Entrar...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.click('button[type="submit"]')
        ]);

        console.log("Conectando ao AVA Moodle via SSO...");
        await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2' });

        console.log("Abrindo Meus cursos...");
        await page.goto('https://ava.unifenas.br/my/courses.php', { waitUntil: 'domcontentloaded' });
        
        console.log("Aguardando 5 segundos para o Moodle carregar...");
        await new Promise(r => setTimeout(r, 5000));

        console.log("HTML salvo em moodle_courses.html");
        const html = await page.content();
        fs.writeFileSync('moodle_courses.html', html);

        const courses = await page.evaluate(() => {
            let items = Array.from(document.querySelectorAll('[data-region="course-content"][data-course-id], .course-summaryitem[data-region="course-content"]'));
            return items.map(i => i.outerHTML);
        });
        console.log("Encontrados:", courses.length);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        await browser.close();
    }
})();
