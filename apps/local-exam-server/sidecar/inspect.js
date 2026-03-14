const sqlite = require('@libsql/client');
const db = sqlite.createClient({ url: 'file:c:/Users/FAHD MUSA AHMED/Documents/McVinci/GradeINT_Web_Demo/apps/local-exam-server/sidecar/local-exam.sqlite' });
db.execute('SELECT * FROM submissions').then(r => console.dir(r.rows, {depth: null})).catch(console.error);
