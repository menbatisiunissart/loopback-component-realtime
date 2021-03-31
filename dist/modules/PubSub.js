"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSub = void 0;
const logger_1 = require("../logger");
/**
 * @module PubSub
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement PubSub Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
class PubSub {
    constructor(driver, options) {
        logger_1.RealTimeLog.log(`PubSub server enabled using ${options.driver.name} driver.`);
        PubSub.driver = driver;
        PubSub.options = options;
        return PubSub;
    }
    static publish(options, next) {
        if (options && options.method && options.endpoint && options.data) {
            if (options.endpoint.match(/\?/))
                options.endpoint = options.endpoint.split('?').shift();
            let event = `[${options.method}]${options.endpoint}`;
            if (PubSub.options.debug) {
                logger_1.RealTimeLog.log(`Sending message to ${event}`);
                logger_1.RealTimeLog.log(`Message: ${typeof options.data === 'object' ? JSON.stringify(options.data) : options.data}`);
            }
            PubSub.driver.emit(event, options.data);
            next();
        }
        else {
            logger_1.RealTimeLog.log('Option must be an instance of type { method: string, data: object }');
            logger_1.RealTimeLog.log(options);
            next();
        }
    }
}
exports.PubSub = PubSub;
//# sourceMappingURL=PubSub.js.map