
/// <reference path='Typings/tsd.d.ts' />

(global as any).inServer = true;
(global as any).inClient = false;

if (process.env.NODE_ENV !== 'production') {
    require('source-map-support').install();
}
let localizations = require('./Public/Scripts/Localizations/all');

import { ServerConfigurations as cf } from './Configurations/Server';
(global as any).cf = cf;
import express = require('express');
import logger = require('morgan');
import compression = require('compression');
import requestLanguage = require('express-request-language');
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
let modRewrite = require('connect-modrewrite');
import { login } from './Contents/LogInAPI';
import { init as initPages } from './Pages';
import { ServerComposer } from './Core/ServerComposer';
import { System, writeClientConfigurations } from './Library/Server/Index';
import { setDefaultHttpRequestOptions, setDefaultXCSRFTokenHeader, Debug } from './Library/Index';


let serverComposer: ServerComposer;

export function startServer(quiet = false) {
    let Server = express();
    Server.use(compression());
    if (process.env.NODE_ENV === 'development') {

        let backendOrigin = '';
        if (System.config.backend.https) {
            backendOrigin += 'https';
        }
        else {
            backendOrigin += 'http';
        }
        backendOrigin += `://${System.config.backend.host}:${System.config.backend.port}`;

        // We need to proxy our requests because of cross domain cookies issues. Browsers such as
        // Safari does not set cookies unless you visit the website. Thus, We cannot have a user
        // session in those browsers. To accomodate this, we proxy our request in development
        // environment through a sub domain of the website. Any production environment also need
        // to assign a sub-domain to the server API.
        Server.use(modRewrite([
            `^\\/(.*) ${backendOrigin}/$1 [H=api\\.flanity\\.local, P]`
        ]));
    }
    else if (process.env.NODE_ENV === 'production') {
        Server.use((req, res, next) => {
            if(req.url.indexOf('/Public/') === 0) {
                res.setHeader('Cache-Control', 'public, max-age=31536000000');
                res.setHeader('Expires', new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString());
            }
            return next();
        });
    }
    Server.use(bodyParser.urlencoded({ extended: true }));
    Server.use('/Public', express.static(System.joinPaths(__dirname, 'Public'), { etag: false }));
    Server.use('/', express.static(__dirname));
    Server.use(cookieParser());
    Server.use(requestLanguage({
        languages: ['en-US', 'zh-CN'],
        cookie: {
            name: 'language',
            options: { maxAge: 24*3600*1000 },
            url: '/languages/{language}'
        },
        localizations,
    }));

    setDefaultHttpRequestOptions({
        host: cf.DEFAULT_HTTP_REQUEST_HOST,
        port: cf.DEFAULT_HTTP_REQUEST_PORT,
        protocol: cf.DEFAULT_HTTP_REQUEST_HTTPS ? 'https' : 'http',
        timeout: cf.DEFAULT_HTTP_REQUEST_TIMEOUT,
    });
    setDefaultXCSRFTokenHeader();

    Server.post('/login', login);

    serverComposer = initPages(Server);

    return new Promise((resolve, reject) => {
        writeClientConfigurations();
        serverComposer.start((err: any) => {
            if (err) {
                reject(err);
            }
            if (!quiet) {
                Debug.prompt(`Server started at port ${process.env.PORT || cf.DEFAULT_SERVER_PORT}. Press CTRL + C to exit.`);
            }
            resolve();
        })
    }).catch(err => {
        console.log(err.stack || err);
    });
}

export function stopServer() {
    serverComposer.stop();
}

export function emitClientFiles() {
    serverComposer.emitBindings();
    writeClientConfigurations();
    serverComposer.emitClientRouter();
}

