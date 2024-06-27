const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');  
const app = express();
const PORT = 3000;
app.use(cors()); 
const pool = new Pool({
    user: 'jabetanc_user_bdvisorweb',
    host: 'postgresql-jabetanc.alwaysdata.net',
    database: 'jabetanc_bdvisorweb',
    password: '18jzooe2',
    port: 5432,
});



// Función para manejar errores y enviar respuestas JSON
const handleErrors = (res, error) => {
    console.error(error);
    res.status(500).json({ error: error.message });
};

app.get('/fincas/:nucleo', async (req, res) => {
    try {
        const nucleo = req.params.nucleo;
        const result = await pool.query('SELECT finca, ST_AsGeoJSON(ST_Centroid(geom)) AS centroide FROM public.linderos WHERE nucleo = $1', [nucleo]);
        const fincas = result.rows.map(row => ({ finca: row.finca, centroide: JSON.parse(row.centroide) }));
        res.json(fincas);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.get('/fields/:layerName', async (req, res) => {
    try {
        const layerName = req.params.layerName;
        const queryResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${layerName}'`);
        const fields = queryResult.rows.map(row => row.column_name);
        res.json(fields);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.get('/values/:layerName/:fieldName', async (req, res) => {
    try {
        const { layerName, fieldName } = req.params;
        const queryResult = await pool.query(`SELECT DISTINCT "${fieldName}" FROM public."${layerName}"`);
        const values = queryResult.rows.map(row => row[fieldName]);
        res.json(values);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.get('/data/:layerName/filter', async (req, res) => {
    try {
        const { layerName } = req.params;
        const { field, value } = req.query;
        const queryResult = await pool.query(`SELECT *, ST_AsGeoJSON(geom)::json AS geometry FROM public."${layerName}" WHERE "${field}" = '${value}'`);
        const geojson = transformToGeoJSON(queryResult.rows);
        res.json(geojson);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.get('/data/:layerName', async (req, res) => {
    try {
        const layerName = req.params.layerName;
        const validLayers = ['linderos', 'Catastrales_wgs', 'Drenajes_wgs', 'parcelas_wgs', 'Mapa_tierras_wgs'];
        if (!validLayers.includes(layerName)) {
            return res.status(400).json({ error: "Capa no válida" });
        }

        const queryResult = await pool.query(`SELECT *, ST_AsGeoJSON(geom)::json AS geometry FROM public."${layerName}"`);
        const geojson = transformToGeoJSON(queryResult.rows);
        res.json(geojson);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.get('/lista_capas', async (req, res) => {
    try {
        const queryResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const layers = queryResult.rows.map(row => row.table_name);
        res.json(layers);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    console.log("Solicitud recibida para la página principal");
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/landing', (req, res) => {
    console.log("Solicitud recibida para la página principal");
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor Corriendo en http://localhost:${PORT}`);
});

const transformToGeoJSON = (rows) => {
    const geoJSON = {
        type: "FeatureCollection",
        features: [],
    };

    for (const row of rows) {
        const feature = {
            type: "Feature",
            properties: {},
            geometry: row.geometry,
        };

        for (const property in row) {
            if (property !== 'geometry') {
                feature.properties[property] = row[property];
            }
        }

        geoJSON.features.push(feature);
    }

    return geoJSON;
};

app.get('/parcelasCalor/', async (req, res) => {
    try {
        const result = await pool.query('SELECT ST_Y(geom)::float as lat, ST_X(geom)::float as lng, ima::float as count FROM public.parcelas_wgs');
        const parcelasData = result.rows.map(row => ({
            lat: parseFloat(row.lat),
            lng: parseFloat(row.lng),
            count: parseFloat(row.count)
        }));

        res.json(parcelasData);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.use(express.json());

app.post('/registro', async (req, res) => {
    const { nombre, cedula, contrasena } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.login (nombre, cedula, contrasena) VALUES ($1, $2, $3) RETURNING *', [nombre, cedula, contrasena]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        handleErrors(res, error);
    }
});

app.post('/login', async (req, res) => {
    const { cedula, contrasena } = req.body;
    try {
        const result = await pool.query('SELECT * FROM public.login WHERE cedula = $1 AND contrasena = $2', [cedula, contrasena]);
        console.log(result);
        if (result.rows.length > 0) {
            res.json({ mensaje: "Inicio de sesión exitoso" });
        } else {
            res.status(401).json({ error: "Cédula o contraseña incorrecta" });
        }
    } catch (error) {
        handleErrors(res, error);
    }
});

//graficas

app.get('/uso-del-suelo', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH AreaPorMunicipio AS (
                SELECT municipio, COUNT(*) AS area_total_municipio
                FROM "Mapa_tierras_wgs"
                GROUP BY municipio
            ),
            AreaPorUsoSuelo AS (
                SELECT municipio, uso_suelo, COUNT(*) AS area_uso_suelo
                FROM "Mapa_tierras_wgs"
                GROUP BY municipio, uso_suelo
            )
            SELECT 
                a.municipio,
                a.uso_suelo,
                a.area_uso_suelo,
                b.area_total_municipio,
                (a.area_uso_suelo::float / b.area_total_municipio) * 100 AS porcentaje_uso_suelo
            FROM AreaPorUsoSuelo a
            JOIN AreaPorMunicipio b ON a.municipio = b.municipio
            ORDER BY a.municipio, a.uso_suelo;
        `);

        // Convertir los resultados en un formato más estructurado si es necesario
        const structuredResults = result.rows.reduce((acc, item) => {
            if (!acc[item.municipio]) {
                acc[item.municipio] = [];
            }
            acc[item.municipio].push({
                uso_suelo: item.uso_suelo,
                area_uso_suelo: item.area_uso_suelo,
                area_total_municipio: item.area_total_municipio,
                porcentaje_uso_suelo: item.porcentaje_uso_suelo
            });
            return acc;
        }, {});

        const formattedResults = Object.keys(structuredResults).map(municipio => ({
            municipio,
            usos_suelo: structuredResults[municipio]
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/cosechas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT nucleo, COUNT(areagenera) AS cantidad_cosechas
            FROM "Mapa_tierras_wgs"
            GROUP BY nucleo;
        `);

        // Estructurar los resultados para enviarlos en un formato amigable
        const structuredResults = result.rows.reduce((acc, item) => {
            acc[item.nucleo] = item.cantidad_cosechas;
            return acc;
        }, {});

        res.json({ Cosechas: structuredResults });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});