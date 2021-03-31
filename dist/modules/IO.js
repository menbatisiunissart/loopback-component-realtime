"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IO = void 0;
const logger_1 = require("../logger");
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
class IO {
    constructor(driver, options) {
        logger_1.RealTimeLog.log(`IO server enabled using ${options.driver.name} driver.`);
        IO.driver = driver;
        IO.options = options;
        return IO;
    }
    static emit(event, message) {
        IO.driver.emit(event, typeof message === 'object' ? JSON.stringify(message) : message);
    }
    static on(event, next) {
        IO.driver.on(event, next);
    }
}
exports.IO = IO;
//# sourceMappingURL=IO.js.map