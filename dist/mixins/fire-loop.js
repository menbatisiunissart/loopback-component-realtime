"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LoopBackContext = require('loopback-context');
/**
 * @module LoopBack Component PubSub - Mixin -
 * @author Jonathan Casarrubias <@johncasarrubias>
 * @description
 *
 * The following algorithm will send messages to subscribed clients
 * for specific endpoints.
 *
 * If the request is in order to create a relationship between 2
 * entities, then the messages will be sent forwards and backwards
 *
 * Which means, that if you link an Account <-> Room 2 messages will
 * be sent:
 *
 *  1.- account.onRoomLink(account.id).subscribe(newRooms => {})
 *  2.- room.onAccountLink(room.id).subscribe(newAccount => {})
 *
 * Otherwise will send a direct message.
 *
 * Also it accepts filters defined within the model config, so you can
 * include data to messages sent, example:
 *
 *  When sending a message, we may want to include the owner account.
 */
class FireLoopMixin {
    constructor(Model, options) {
        options = Object.assign({ filters: {} }, options);
        Model.observe('after save', (ctx, next) => {
            Model.app.mx.IO.driver.server.to('flint').emit('create-hook', {
                modelName: ctx.Model.modelName,
                data: ctx.instance,
                created: ctx.isNewInstance
            });
            next();
        });
        Model.observe('after delete', (ctx, next) => {
            Model.app.mx.IO.driver.server.to('flint').emit('delete-hook', {
                modelName: ctx.Model.modelName,
                data: ctx.where
            });
            next();
        });
    }
    ;
}
module.exports = FireLoopMixin;
//# sourceMappingURL=fire-loop.js.map