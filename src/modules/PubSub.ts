import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { RealTimeLog } from '../logger';
/**
 * @module PubSub
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement PubSub Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
export class PubSub {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`PubSub server enabled using ${options.driver.name} driver.`);
    PubSub.driver  = driver;
    PubSub.options = options;
    return PubSub;
  }
  
  static publish(options: any, next: any): void {
    if (options && options.method && options.endpoint && options.data) {
      if (options.endpoint.match(/\?/))
        options.endpoint = options.endpoint.split('?').shift();
      let event = `[${options.method}]${options.endpoint}`;
      const { 
        id,
        projectId,
        organizationId,
        collectionId,
      } = options.data;
      if (id) {
          options.data = {id};
      }
      if (projectId) {
          options.data = {
              ...options.data,
              projectId
          };
      }
      if (organizationId) {
          options.data = {
              ...options.data,
              organizationId
          };
      }
      if (collectionId) {
          options.data = {
              ...options.data,
              collectionId
          };
      }
      options.data = {
          ...options.data,
          method: options.method
      };
      if (PubSub.options.debug) {
        RealTimeLog.log(`Sending message to ${event}`);
        RealTimeLog.log(`Message: ${typeof options.data === 'object' ? JSON.stringify(options.data) : options.data}`);
      }
      PubSub.driver.emit(event, options.data);
      next();
    } else {
      RealTimeLog.log('Option must be an instance of type { method: string, data: object }');
      RealTimeLog.log(options);
      next();
    }
  }
}