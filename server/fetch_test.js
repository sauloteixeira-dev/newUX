const run = async () => {
    try {
        const req = await fetch('https://newux-backend.onrender.com/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({matricula: '200859251', senha: '11170059686'})
        });
        const reader = req.body.getReader();
        const decoder = new TextDecoder();
        while(true) {
            const {value, done} = await reader.read();
            if (done) break;
            const str = decoder.decode(value);
            console.log(str);
            if(str.includes('"type":"success"')) {
                const parts = str.split('\n');
                for(let p of parts) {
                    if(p.includes('"type":"success"')) {
                        const json = JSON.parse(p);
                        const fs = await import('fs');
                        fs.writeFileSync('courses_rendered.json', JSON.stringify(json.data, null, 2));
                        console.log('Salvo em courses_rendered.json');
                    }
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
};
run();
