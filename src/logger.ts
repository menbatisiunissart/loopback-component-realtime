import { OptionsInterface } from './types/options';
/**
* @author Jonathan Casarrubias <twitter:@johncasarrubias> <github:@johncasarrubias>
* @module RealTimeLog
* @license MTI
* @description
* Console Log wrapper that can be disabled in production mode
**/
export class RealTimeLog {
  static namespace: string = 'custom-loopback-component-realtime';
  static options: OptionsInterface;
  static log(input: any) {
    if (RealTimeLog.options.debug)
    console.log('\x1b[36m%s\x1b[0m', `${this.namespace}: ${input}`);
  }
}
