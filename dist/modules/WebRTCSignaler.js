"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRTCSignaler = void 0;
const logger_1 = require("../logger");
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement WebRTC Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
class WebRTCSignaler {
    constructor(driver, options) {
        logger_1.RealTimeLog.log(`WebRTCSignaler server enabled using ${options.driver.name} driver.`);
        WebRTCSignaler.driver = driver;
        WebRTCSignaler.options = options;
        // WebRTCSignaler.driver.onConnection((socket: any) => {
        //   let initiatorChannel: string = '';
        //   socket.on('new-channel', (data: any) => {
        //     if (!WebRTCSignaler.channels[data.channel]) {
        //       initiatorChannel = data.channel;
        //     }
        //     WebRTCSignaler.channels[data.channel] = data.channel;
        //     WebRTCSignaler.onNewNamespace(data.channel, data.sender);
        //   });
        //   socket.on('presence', (channel: any) => {
        //     var isChannelPresent = !!WebRTCSignaler.channels[channel];
        //     socket.emit('presence', isChannelPresent);
        //   });
        //   socket.on('disconnect', (channel: any) => {
        //     if (initiatorChannel) {
        //       delete WebRTCSignaler.channels[initiatorChannel];
        //     }
        //   });
        // });
        return WebRTCSignaler;
    }
    static onNewNamespace(channel, sender) {
        WebRTCSignaler.driver.of('/' + channel).on('connection', (socket) => {
            let username;
            if (WebRTCSignaler.driver.isConnected) {
                WebRTCSignaler.driver.isConnected = false;
                socket.emit('connect', true);
            }
            socket.on('message', (data) => {
                if (data.sender == sender) {
                    if (!username)
                        username = data.data.sender;
                    socket.broadcast.emit('message', data.data);
                }
            });
            socket.on('disconnect', () => {
                if (username) {
                    socket.broadcast.emit('user-left', username);
                    username = '';
                }
            });
        });
    }
}
exports.WebRTCSignaler = WebRTCSignaler;
WebRTCSignaler.channels = {};
//# sourceMappingURL=WebRTCSignaler.js.map