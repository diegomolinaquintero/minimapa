const { Pool } = require('pg');

const pool= new Pool({
    user: 'jabetanc_user_bdvisorweb',
    host: 'postgresql-jabetanc.alwaysdata.net',
    database:'jabetanc_bdvisorweb',
    password:'18jzooe2',
    port:5432,
});

const listTables = async () => {
    try {
        const query = `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;

        const result = await pool.query(query);
        console.log("Tablas en la base de datos:");
        result.rows.forEach(row => console.log(row.table_name));
    } catch (error) {
        console.error('Error al listar las tablas:', error);
    } finally {
        await pool.end();
    }
};

listTables();