const express = require('express');
const path = require('path');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const signale = require('signale');
const pool = require('./pool');
const discord = require('./discord');
const config = require('./config.json');

const log = new signale.Signale({ scope: 'Express' });
const app = express();
const port = config.https ? 443 : config.http_port;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/verify/:verifyId?', (req, res) => {
    if (!req.params.verifyId) return res.render('err/invalidLink', { domain: config.domain });
    if (!pool.isValidLink(req.params.verifyId)) return res.render('err/invalidLink', { domain: config.domain });
    res.render('verify', { publicKey: config.recaptcha['publicKey'], id: req.params.verifyId, domain: config.domain });
});

app.post('/verify/:verifyId?', async (req, res) => {
    if (!req.body || !req.body['g-recaptcha-response']) return res.render('err/invalidLink', { domain: config.domain });

    const response = await axios({
        method: 'post',
        url: `https://www.google.com/recaptcha/api/siteverify?secret=${config.recaptcha['secret-key']}&response=${req.body['g-recaptcha-response']}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    if (!response.data.success) return res.render('err/invalidCaptcha', { domain: config.domain });
    if (!pool.isValidLink(req.params.verifyId)) return res.render('err/invalidLink', { domain: config.domain });

    discord.addRole(pool.getDiscordId(req.params.verifyId));
    discord.removeRole(pool.getDiscordId(req.params.verifyId));

    pool.removeLink(req.params.verifyId);

    res.render('verified', { userID: pool.getDiscordId(req.params.verifyId), domain: config.domain });
});

app.get('/*', (req, res) => res.render('index', { domain: config.domain }));

function main() {
    log.info('Waiting for web server to start...');
    if (config.https) {
        https.createServer({
            key: fs.readFileSync('private.pem'),
            cert: fs.readFileSync('certificate.pem')
        }, app).listen(port, () => log.info(`Server started on port ${port}`));
    } else {
        app.listen(port, () => log.info(`Server started on port ${port}`));
    }
}

module.exports = {
    run: main
}