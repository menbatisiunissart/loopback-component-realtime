"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverFactory = void 0;
const io_driver_1 = require("./io.driver");
class DriverFactory {
    static load(name) {
        let driver;
        switch (name) {
            case 'socket.io':
                driver = new io_driver_1.IODriver();
                break;
            /*
            case 'kafka':
              driver = <DriverInterface> new KafkaDriver();
            break;
            */
            default:
                driver = new io_driver_1.IODriver();
                break;
        }
        return driver;
    }
}
exports.DriverFactory = DriverFactory;
//# sourceMappingURL=factory.js.map