"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IODriver = void 0;
const logger_1 = require("../logger");
const socket_io_1 = require("socket.io");
const socket_io_client_1 = require("socket.io-client");
const _ = __importStar(require("underscore"));
class IODriver {
    constructor() {
        this.options = {};
        this.connections = new Array();
    }
    serverInit(server, options) {
        return new socket_io_1.Server(server, options);
    }
    clientInit(url, options) {
        return socket_io_client_1.io(url, options);
    }
    /**
     * @method connect
     * @param {OptionsInterface} options
     * @description Will create a web socket server and then setup either clustering
     * and authentication functionalities.
     **/
    connect(options) {
        this.options = options;
        let transports = {};
        if (options
            && options.driver
            && options.driver.options) {
            transports = options.driver.options.transports;
        }
        else {
            throw new Error('IO driver Error: transports undefined');
        }
        this.server = this.serverInit(options.server, { transports });
        this.onConnection((socket) => this.newConnection(socket));
        this.setupClustering();
        this.setupAuthResolver();
        this.setupAuthentication();
        this.setupClient();
        this.setupInternal();
        this.options.app.emit('fire-connection-started');
    }
    setupAuthResolver() {
        if (this.options.auth) {
            logger_1.RealTimeLog.log('RTC requesting custom resolvers');
            this.options.app.on('fire-auth-resolver', (authResolver) => {
                if (!authResolver || !authResolver.name || !authResolver.handler) {
                    throw new Error('FireLoop: Custom auth resolver does not provide either name or handler');
                }
                this.server.on('connection', (socket) => {
                    socket.on(authResolver.name, (payload) => authResolver.handler(socket, payload, (token) => {
                        if (token) {
                            this.restoreNameSpaces(socket);
                            socket.token = token;
                            socket.emit('authenticated');
                        }
                    }));
                });
            });
        }
    }
    /**
     * @method setupClustering
     * @description Will setup socket.io adapters. This module is adapter agnostic, it means
     * it can use any valid socket.io-adapter, can either be redis or mongo. It will be setup
     * according the provided options. 8990021
     **/
    setupClustering() {
        if (this.options.driver.options.adapter &&
            this.options.driver.options.adapter.name &&
            this.options.driver.options.adapter.datasource &&
            this.options.app.datasources[this.options.driver.options.adapter.datasource] &&
            this.options.app.datasources[this.options.driver.options.adapter.datasource].settings) {
            let adapter = require(this.options.driver.options.adapter.name);
            let ds = this.options.app.datasources[this.options.driver.options.adapter.datasource];
            if (ds.settings.url) {
                logger_1.RealTimeLog.log('Running in clustering environment');
                this.server.adapter(adapter(ds.settings.url));
            }
            else if (ds.settings.host && ds.settings.port && ds.settings.db) {
                let adapterOptions = {
                    host: ds.settings.host,
                    port: ds.settings.port,
                    db: ds.settings.db
                };
                if (ds.settings.user)
                    adapterOptions.user = ds.settings.user;
                if (ds.settings.password)
                    adapterOptions.password = ds.settings.password;
                logger_1.RealTimeLog.log('Running in clustering environment');
                this.server.adapter(adapter(adapterOptions));
            }
            else {
                throw new Error('loopback-realtime-component: Unexpected datasource options for clustering mode.');
            }
        }
        else {
            logger_1.RealTimeLog.log('Running in a not clustered environment');
        }
    }
    /**
     * @method setupAuthentication
     * @description Will setup an authentication mechanism, for this we are using socketio-auth
     * connected with LoopBack Access Token.
     **/
    setupAuthentication() {
        if (this.options.auth) {
            logger_1.RealTimeLog.log('RTC authentication mechanism enabled');
            // Remove Unauthenticated sockets from namespaces
            _.each(this.server.nsps, (nsp) => {
                nsp.on('connect', (socket) => {
                    if (!socket.token) {
                        delete nsp.connected[socket.id];
                    }
                });
            });
            this.server.on('connection', (socket) => {
                /**
                 * Register Built in Auth Resolver
                 */
                socket.on('authentication', (token) => {
                    if (!token) {
                        return;
                    }
                    if (token.is === '-*!#fl1nter#!*-') {
                        logger_1.RealTimeLog.log('Internal connection has been established');
                        this.restoreNameSpaces(socket);
                        socket.token = token;
                        return socket.emit('authenticated');
                    }
                    var AccessToken = this.options.custom && this.options.custom.AccessToken
                        ? this.options.app.models[this.options.custom.AccessToken]
                        : this.options.app.models.AccessToken;
                    //verify credentials sent by the client
                    var token = AccessToken.findOne({
                        where: { id: token.id || 0 }
                    }, (err, tokenInstance) => {
                        if (tokenInstance) {
                            this.restoreNameSpaces(socket);
                            socket.token = tokenInstance;
                            socket.emit('authenticated');
                        }
                    });
                });
                /**
                 * Wait 1 second for token to be available
                 * Or disconnect
                 **/
                const to = setTimeout(() => {
                    if (!socket.token) {
                        socket.emit('unauthorized');
                        socket.disconnect(1);
                    }
                    clearTimeout(to);
                }, 3000);
            });
        }
    }
    /**
     * @method setupClient
     * @description Will setup a server side client, for server-side notifications.
     * This is mainly created to be called from hooks
     **/
    setupClient() {
        // Passing transport options if any (Mostly for clustered environments)
        this.client = this.clientInit(`http${this.options.secure ? 's' : ''}://127.0.0.1:${this.options.app.get('port')}`, {
            transports: ['websocket'],
            secure: this.options.secure
        });
        this.client.on('connect', () => {
            if (this.options.auth) {
                logger_1.RealTimeLog.log('Server side client is connected, trying to authenticate');
                this.client.emit('authentication', { is: '-*!#fl1nter#!*-' });
                this.client.on('authenticated', () => logger_1.RealTimeLog.log('Internal server client is authenticated'));
            }
        });
    }
    /**
     * @method setupInternal
     * @description Will setup an internal client that mainly will keep in sync different
     * server instances, is also used on.
     **/
    setupInternal() {
        // Passing transport options if any (Mostly for clustered environments)
        this.internal = this.clientInit(`http${this.options.secure ? 's' : ''}://127.0.0.1:${this.options.app.get('port')}`, {
            transports: ['websocket'],
            secure: this.options.secure
        });
        this.internal.on('connect', () => {
            if (this.options.auth) {
                logger_1.RealTimeLog.log('Internal client is connected, trying to authenticate');
                this.internal.emit('authentication', { is: '-*!#fl1nter#!*-' });
                this.internal.on('authenticated', () => {
                    logger_1.RealTimeLog.log('Internal client is authenticated');
                    this.internal.emit('fl-reg');
                });
            }
            else {
                this.internal.emit('fl-reg');
            }
        });
    }
    emit(event, message) {
        this.server.emit(event, message);
    }
    on(event, callback) {
        this.client.on(event, callback);
    }
    once(event, callback) {
        this.client.once(event, callback);
    }
    of(event) {
        return this.server.of(event);
    }
    getUserConnection(userId) {
        if (!userId || userId === '')
            return;
        let connection;
        this.forEachConnection((_connection) => {
            if (_connection.token && _connection.token.userId === userId) {
                connection = _connection;
            }
        });
        return connection;
    }
    forEachConnection(handler) {
        this.connections.forEach((connection) => handler(connection));
    }
    onConnection(handler) {
        this.server.on('connect', (socket) => handler(socket, this.server));
    }
    removeListener(name, listener) {
        this.server.sockets.removeListener(name, listener);
    }
    newConnection(socket) {
        this.connections.push(socket);
        socket.setMaxListeners(0);
        socket.on('ME:RT:1://event', (input) => {
            this.server.emit(input.event, input.data);
        });
        socket.on('disconnect', () => {
            this.options.app.emit('socket-disconnect', socket);
            socket.removeAllListeners();
        });
        socket.on('lb-ping', () => socket.emit('lb-pong', new Date().getTime() / 1000));
        socket.on('fl-reg', () => socket.join('flint'));
    }
    restoreNameSpaces(socket) {
        _.each(this.server.nsps, (nsp) => {
            if (_.findWhere(nsp.sockets, { id: socket.id })) {
                nsp.connected[socket.id] = socket;
            }
        });
    }
}
exports.IODriver = IODriver;
//# sourceMappingURL=io.driver.js.map