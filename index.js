const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const libraryPath = path.join(__dirname, 'library.json');

app.get('/api/jonell', async (req, res) => {
    try {
        const { search: query } = req.query;
        const soundCloudUrl = `https://soundcloud-music-player-by-jonell.onrender.com/sc?search=${query}`;

        const instance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            baseURL: 'https://www.cjoint.com/',
        });

        const uploadUrl = await getUploadUrl(instance);
        const musicTitle = `gdphbot${new Date().getTime()}`; // Default filename with current time
        const outputPath = path.join(__dirname, `${musicTitle}.mp3`);

        await downloadMusic(soundCloudUrl, outputPath);

        const uploadResponse = await uploadFile(outputPath, uploadUrl, instance);
        const cjointLink = await getCjointLink(uploadResponse);
        const finalUrl = await getFinalUrl(cjointLink);

        const jsonResponse = {
            Successfully: finalUrl
        };

        addToLibrary(jsonResponse.Successfully);

        res.json(jsonResponse);

        fs.unlink(outputPath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                console.log('File deleted successfully');
            }
        });
    } catch (error) {
        console.error('Error processing music:', error);
        res.status(500).send('Error processing music');
    }
});

app.get('/api/library', async (req, res) => {
    try {
        const data = await fs.promises.readFile(libraryPath, 'utf8');
        const library = JSON.parse(data);
        res.json(library);
    } catch (error) {
        console.error('Error reading library:', error);
        res.status(500).send('Error reading library');
    }
});

function addToLibrary(data) {
    let library = [];

    if (fs.existsSync(libraryPath)) {
        const existingData = fs.readFileSync(libraryPath, 'utf8');
        library = JSON.parse(existingData);
    }

    library.push(data);

    fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2), 'utf8');
}

async function getUploadUrl(instance) {
    const response = await instance.get('/');
    const $ = cheerio.load(response.data);
    return $('#form-upload').attr('action');
}

async function downloadMusic(url, outputPath) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, response.data);
}

async function uploadFile(filePath, uploadUrl, instance) {
    const formData = new FormData();
    formData.append('USERFILE', fs.createReadStream(filePath));

    const response = await instance.post(uploadUrl, formData, {
        headers: formData.getHeaders(),
    });
    return response.data;
}

async function getCjointLink(uploadResponse) {
    const $ = cheerio.load(uploadResponse);
    return $('.share_url a').attr('href');
}

async function getFinalUrl(cjointLink) {
    const htmlResponse = await axios.get(`${cjointLink}`);
    const html$ = cheerio.load(htmlResponse.data);
    return `https://www.cjoint.com${html$('.share_url a').attr('href').split('"')[0]}`;
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
