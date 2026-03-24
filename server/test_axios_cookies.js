import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';

const matricula = '200859251';
const senha = '11170059686';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    console.log("Logando...");
    await page.goto('https://aluno.unifenas.br/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#username');
    await page.type('#username', matricula);
    await page.type('#password', senha);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(()=>console.log("nav timeout portal"));
    
    console.log("SSO...");
    await page.goto('https://aluno.unifenas.br/auto-login-moodle', { waitUntil: 'networkidle2' });
    
    // Pegando TODOS OS COOKIES do navegador inteiro
    const client = await page.target().createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');
    
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const http = axios.create({
        headers: {
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    console.log(`\n👨‍💻 Cookies gerados (${cookies.length}):`);
    console.log(cookieStr);

    console.log("\nSimulando Axios num arquivo do Moodle...");
    // Isso é um URL genérico de recurso do Moodle, se existir ou redirecionar veremos pelo Axios
    // Como não sei o ID exato de um recurso do seu curso, vou pesquisar um rapidinho no painel
    await page.goto('https://ava.unifenas.br/my/courses.php', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a.coursename', { timeout: 15000 });
    const firstCourse = await page.$eval('a.coursename', a => a.href);
    console.log("Curso:", firstCourse);
    
    await page.goto(firstCourse, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.activity a', { timeout: 15000 });
    const firstFile = await page.$eval('.activity a', a => a.href);
    console.log("Arquivo a ser testado via Axios:", firstFile);

    const res = await http.get(firstFile, { maxRedirects: 4 });
    const finalUrl = res.request?.res?.responseUrl || res.request?.responseURL || '';
    
    console.log("---- RESULTADO AXIOS ----");
    console.log("URL Final:", finalUrl);
    
    if (finalUrl.includes('login') || finalUrl.includes('my/')) {
        console.log("❌ Axios foi barrado e mandado pro dashboard/login!");
    } else {
        const $ = cheerio.load(res.data);
        const obj = $('object#resourceobject').attr('data');
        console.log("✅ Axios foi aceito! Link interno:", obj || "nenhum object encontrado. Html title:", $('title').text());
    }

    await browser.close();
})();
