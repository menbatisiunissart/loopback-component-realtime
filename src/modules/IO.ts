import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { RealTimeLog } from '../logger';
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
export class IO {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`IO server enabled using ${options.driver.name} driver.`);
    IO.driver  = driver;
    IO.options = options;
    return IO;
  }

  static emit(event: string, message: any): void {
    const data = typeof message === 'object' ? JSON.stringify(message) : message;
    if (IO.options.debug) {
        RealTimeLog.log("IO Server Sending message to " + event);
        RealTimeLog.log("Message: " + data);
    }
    IO.driver.emit(event, data);
  }

  static on(event: string, next: Function): void {
    IO.driver.on(event, next);
  }
}