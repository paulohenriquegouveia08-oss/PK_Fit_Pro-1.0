import app from '../dist/app/server.js';

export default async function (req, res) {
    await app.ready();
    app.server.emit('request', req, res);
}
