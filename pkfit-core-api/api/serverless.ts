import app from '../src/app/server.js';

export default async function (req: any, res: any) {
    await app.ready();
    app.server.emit('request', req, res);
}
