declare var module: any;
declare var require: any;
declare var Object: any;
import { SubscriptionInterface } from '../types/subscription';
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { EventsInterface } from '../types/events';
import { FireLoopData } from '../types/fireloop-data';
import { RealTimeLog } from '../logger';
import * as async from 'async';
/**
 * @module FireLoop
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
export class FireLoop {
  /**
   * @property UNAUTHORIZED: string
   * Constant for UNAUTHORIZED Events
   **/
  static UNAUTHORIZED: string = '401 Unauthorized Event';
  /**
   * @property driver: DriverInterface
   * The transportation driver that will be used by this module
   **/
  static driver: DriverInterface;
  /**
   * @property options: OptionsInterface
   * The options object that are injected from the main module
   **/
  static options: OptionsInterface;
  /**
   * @property events: OptionsInterface
   * The options object that are injected from the main module
   **/
  static events: EventsInterface = {
    readings: ['value', 'change', 'child_added', 'child_updated', 'child_removed', 'stats'],
    writings: ['create', 'upsert', 'remove'],
  };
  /**
   * @property context {[ id: number ]: {[ id: number ]: Object }}
   * Context container, it will temporally store contexts. These
   * are automatically deleted when client disconnects.
   **/
  static contexts: { [id: number]: { [id: number]: Object } } = {};
  /**
  * @method constructor
  * @param driver: DriverInterface
  * @param options: OptionsInterface
  * @description
  * Initializes FireLoop module by storing a static reference for the driver and
  * options that will be used. Then it will call the setup method.
  **/
  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`FireLoop server enabled using ${options.driver.name} driver.`);
    FireLoop.driver = driver;
    FireLoop.options = options;
    FireLoop.setup();
  }
  /**
  * @method setup
  * @description
  * Listen for new connections in order to configure each new client connected
  * by iterating the LoopBack models and configuring the necessary events
  **/
  static setup(): void {
    // Setup Hook Handlers
    FireLoop.setupHooks();
    // Setup Server Side Broadcasts
    Object.keys(FireLoop.options.app.models).forEach((modelName: string) => {
      // TODO: verify why this is not working -> FireLoop.options.app.models[modelName].mixin('FireLoop');
      // Answer: There is a bug from LoopBack, it requires the mixin to be configured through json at least
      // for 1 time, if the mixing is lodaded 1 time, then the mixin() would work, but is not the best solution.
      // For now dev-users need to define the FireLoop mixin within the model.json file, for those models 
      // The Real-Time functionality is needed.
      FireLoop.events.readings.forEach((event: string) => {
        FireLoop.setupServerBroadcast({ modelName }, event);
        if (!FireLoop.options.app.models[modelName].sharedClass.ctor.relations) return;
        Object.keys(FireLoop.options.app.models[modelName].sharedClass.ctor.relations).forEach((scope: string) => {
          FireLoop.setupServerBroadcast({ modelName: `${modelName}.${scope}` }, event);
        });
      });
    });
    // Setup Client Side Connection
    // FireLoop.driver.onConnection((socket: any) => {
    //   socket.connContextId = FireLoop.buildId();
    //   FireLoop.contexts[socket.connContextId] = {};
    //   // Setup On Set Methods
    //   Object.keys(FireLoop.options.app.models).forEach((modelName: string) =>
    //     FireLoop.getReference(modelName, null, (Model: any) => {
    //       // Setup reference subscriptions
    //       socket.on(`Subscribe.${modelName}`, (subscription: SubscriptionInterface) => {
    //         FireLoop.contexts[socket.connContextId][subscription.id] = {
    //           id: subscription.id, modelName, Model, socket, subscription
    //         };
    //         // Register remote method events
    //         FireLoop.setupRemoteMethods(FireLoop.contexts[socket.connContextId][subscription.id]);
    //         // Iterate for writting events
    //         FireLoop.events.writings.forEach((event: string) => {
    //           FireLoop.setupModelWritings(FireLoop.contexts[socket.connContextId][subscription.id], event);
    //           FireLoop.setupScopeWritings(FireLoop.contexts[socket.connContextId][subscription.id], event);
    //         });
    //         // Iterate for reading events
    //         FireLoop.events.readings.forEach((event: string) => {
    //           FireLoop.setupModelReadings(FireLoop.contexts[socket.connContextId][subscription.id], event);
    //           FireLoop.setupScopeReadings(FireLoop.contexts[socket.connContextId][subscription.id], event);
    //         });
    //         // Register dispose method to removeAllListeners
    //         FireLoop.setupDisposeReference(FireLoop.contexts[socket.connContextId][subscription.id]);
    //       });
    //     })
    //   );
    //   // Clean client contexts from the server memory when client disconnects :D
    //   socket.on('disconnect', () => {
    //     RealTimeLog.log(`FireLoop is releasing context tree with id ${socket.connContextId} from memory`);
    //     delete FireLoop.contexts[socket.connContextId];
    //   });
    // });
  }
  /**
  * @method setupDisposeReference
  * @description
  * will remove all the listeners for this reference subscription
   */
  static setupDisposeReference(ctx: any): void {
    ctx.socket.on(
      `${ctx.modelName}.dispose.${ctx.subscription.id}`,
      (input: FireLoopData) => {
        // Notify we are releasing memory
        RealTimeLog.log(`FireLoop is releasing model subscription tree with id ${ctx.subscription.id} from memory`);
        // Dispose Remote Methods
        ctx.socket.removeAllListeners(`${ctx.modelName}.remote.${ctx.subscription.id}`);
        // Dispose Model Writings
        FireLoop.disposeModelWritings(ctx);
        // Dispose Scope Writings
        FireLoop.disposeScopeWritings(ctx);
        // Dispose Model Readings
        FireLoop.disposeModelReadings(ctx);
        // Dispose Scope Readings
        FireLoop.disposeScopeReadings(ctx);
        // Remove Context 
        process.nextTick(() => {
            if (
              FireLoop.contexts[ctx.socket.connContextId] &&
              FireLoop.contexts[ctx.socket.connContextId][ctx.id]
            )
            delete FireLoop.contexts[ctx.socket.connContextId][ctx.id];
        });
      }
    );
  }
  /**
  * @method getUserConnection
  * @description
  * will return a user connection from the given user Id
   */
  static getUserConnection(userId: string): void {
    FireLoop.driver.getUserConnection(userId);
  }
  /**
  * @method setupHooks
  * @description
  * setup opeation hooks
  **/
  static setupHooks(): void {
    FireLoop.driver.internal.on('create-hook', (event: any) => {
      FireLoop.publish({ modelName: event.modelName, err: null, input: null, data: event.data, created: event.created });
    });
    FireLoop.driver.internal.on('delete-hook', (event: any) => {
      FireLoop.publish({ modelName: event.modelName, err: null, input: null, removed: event.data });
    });
  }
  /**
  * @method setupRemoteMethods
  * @description
  * setup writting events for root models
   */
  static setupRemoteMethods(ctx: any): void {
    ctx.socket.on(
      `${ctx.modelName}.remote.${ctx.subscription.id}`,
      (input: FireLoopData) => FireLoop.remote(ctx, input)
    );
  }
  /**
  * @method setupModelWritings
  * @description
  * setup writting events for root models
   */
  static setupModelWritings(ctx: any, event: string): void {
    ctx.socket.on(
      `${ctx.modelName}.${event}.${ctx.subscription.id}`,
      (input: FireLoopData) => (<any>FireLoop)[event](ctx, input)
    )
  }
  /**
  * @method disposeModelWritings
  * @description
  * setup writting events for root models
   */
  static disposeModelWritings(ctx: any): void {
    FireLoop.events.writings.forEach((event: string) => {
      ctx.socket.removeAllListeners(`${ctx.modelName}.${event}.${ctx.subscription.id}`);
    });
  }
  /**
  * @method setupModelReading
  * @description
  * Listen for connections that requests to pull data without waiting until the next
  * public broadcast announce.
  **/
  static setupModelReadings(ctx: any, event: string): void {
    // Pull Request Listener
    ctx.socket.on(
      `${ctx.modelName}.${event}.pull.request.${ctx.subscription.id}`,
      (request: any) => {
        let _request: any = Object.assign({}, request);
        RealTimeLog.log(`FireLoop model pull request received: ${JSON.stringify(_request.filter)}`);
        let emit: any = (err: any, data: any) => {
          if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
          ctx.socket.emit(`${ctx.modelName}.${event}.pull.requested.${ctx.subscription.id}`, err ? { error: err } : data);
        };
        // This works only for Root Models, related models are configured in setupScopes method
        // Define the name of the method
        let remoteEvent: string;
        if (event.match('stats')) {
          remoteEvent = 'stats';
        } else {
          remoteEvent = 'find';
        }
        // Check for Access
        FireLoop.checkAccess(ctx, ctx.Model, remoteEvent, ctx.input, (err: Error, hasAccess: boolean) => {
          if (err) {
            emit(err);
          } else if (!hasAccess) {
            emit(FireLoop.UNAUTHORIZED);
          } else {
            switch (remoteEvent) {
              case 'find':
                ctx.Model.find(_request.filter, { accessToken: ctx.socket.token }, emit);
                break;
              case 'stats':
                ctx.Model.stats(_request.filter.range || 'monthly', _request.filter.custom, _request.filter.where || {}, _request.filter.groupBy, emit);
                break;
            }
          }
        });
      }
    );
    FireLoop.setupClientBroadcast(ctx, event);
  }
  /**
  * @method disposeModelReadings
  * @description
  * setup writting events for root models
  **/
  static disposeModelReadings(ctx: any): void {
    FireLoop.events.readings.forEach((event: string) => {
      ctx.socket.removeAllListeners(`${ctx.modelName}.${event}.pull.request.${ctx.subscription.id}`);
    });
  }
  /**
  * @method setupScopeWritings
  * @description
  * setup writting events for root models
   */
  static setupScopeWritings(ctx: any, event: string): void {
    if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations) return;
    Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach((scope: string) => {
      let relation: any = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
      // Lets copy the context for each Scope, to keep the right references
      let _ctx = Object.assign({}, { modelName: `${ctx.modelName}.${scope}` }, ctx);
      _ctx.modelName = `${ctx.modelName}.${scope}`;
      // Setup writting events for scope/related models
      RealTimeLog.log(`FireLoop setting write relation: ${ctx.modelName}.${scope}.${event}.${ctx.subscription.id}`);
      ctx.socket.on(
        `${_ctx.modelName}.${event}.${ctx.subscription.id}`,
        (input: FireLoopData) => {
          _ctx.input = input;
          RealTimeLog.log(`FireLoop relation operation: ${_ctx.modelName}.${event}.${ctx.subscription.id}: ${JSON.stringify(input)}`);
          (<any>FireLoop)[event](_ctx, input);
        }
      )
    });
  }
  /**
  * @method disposeScopeWritings
  * @description
  * setup writting events for root models
   */
  static disposeScopeWritings(ctx: any): void {
    if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations) return;
    FireLoop.events.writings.forEach((event: string) => {
      Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach((scope: string) => {
        ctx.socket.removeAllListeners(`${ctx.modelName}.${scope}.${event}.${ctx.subscription.id}`);
      })
    });
  }
  /**
  * @method setupScopeReading
  * @description
  * Listen for connections that requests to pull data without waiting until the next
  * public broadcast announce.
  **/
  static setupScopeReadings(ctx: any, event: string): void {
    if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations) return;
    Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach((scope: string) => {
      let relation: any = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
      // Lets copy the context for each Scope, to keep the right references
      // TODO: Make sure _ctx is deleted when client is out, not seeing where it is removed (JC)
      let _ctx = Object.assign({}, { modelName: `${ctx.modelName}.${scope}` }, ctx);
      _ctx.modelName = `${ctx.modelName}.${scope}`;
      RealTimeLog.log(`FireLoop setting read relation: ${_ctx.modelName}.${event}.pull.request.${ctx.subscription.id}`);
      ctx.socket.on(
        `${_ctx.modelName}.${event}.pull.request.${ctx.subscription.id}`,
        (request: any) => {
          _ctx.input = request; // Needs to be inside because we need scope params from request
          FireLoop.setupClientBroadcast(_ctx, event);
          let _filter: any = Object.assign({}, request.filter);
          RealTimeLog.log(`FireLoop scope pull request received: ${JSON.stringify(_filter)}`);
          let emit: any = (err: any, data: any) => {
            if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
            ctx.socket.emit(`${_ctx.modelName}.${event}.pull.requested.${ctx.subscription.id}`, err ? { error: err } : data);
          };
          // TODO: Verify if this works with child references?
          switch (event) {
            case 'value':
            case 'change':
              FireLoop.getReference(_ctx.modelName, request, (ref: any) => {
                if (!ref) {
                  const error = { error: `${ctx.modelName} Model reference was not found.` };
                  RealTimeLog.log(error);
                  emit(error);
                } else {
                  ref(_filter, emit)
                }
              });
              break;
            case 'stats':
              RealTimeLog.log('Stats are currently only for root models');
              // ctx.Model.stats(_filter.range ||  'monthly', _filter.custom, _filter.where ||  {}, _filter.groupBy, emit);
              break;
          }
        }
      );
    });
  }
  /**
  * @method disposeScopeReadings
  * @description
  * setup writting events for root models
   */
  static disposeScopeReadings(ctx: any): void {
    if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations) return;
    FireLoop.events.readings.forEach((event: string) => {
      Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach((scope: string) => {
        ctx.socket.removeAllListeners(`${ctx.modelName}.${scope}.${event}.pull.request.${ctx.subscription.id}`);
      })
    });
  }
  /**
  /**
  * @method getReference
  * @description
  * Returns a model reference, this can be either a Regular Model or a Scoped Model.
  * For regular models we just return the model as it is, but for scope models (childs)
  * we return a child model reference by correctly finding it.
  **/
  static getReference(modelName: string, input: FireLoopData, next: Function): any {
    let ref: any;
    if (modelName.match(/\./g)) {
      if (!input || !input.parent) return next(null);
      let segments: string[] = modelName.split('.');
      let parent: any = FireLoop.options.app.models[segments[0]] || null;
      if (!parent) return next(null);
      let idName: any = parent.getIdName();
      let filter: any = { where: {} };
      filter.where[idName] = input.parent[idName];
      return parent.findOne(filter, (err: any, instance: any) => {
        ref = instance ? instance[segments[1]] || null : null;
        next(ref);
      });
    } else {
      ref = FireLoop.options.app.models[modelName] || null;
      next(ref);
    }
  }
  /**
  * @method remote
  * @description
  * Enables an interface for calling remote methods from FireLoop clients.
  **/
  static remote(ctx: any, input: FireLoopData): void {
    RealTimeLog.log(`FireLoop starting remote: ${ctx.modelName}: ${JSON.stringify(input)}`);
    async.waterfall([
      (next: Function) => {
        if (ctx.modelName.match(/\./g)) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => FireLoop.checkAccess(ctx, ref, input.data.method, input, next),
      (ref: any, next: Function) => {
        let method: Function = ref[input.data.method];
        if (!method) {
          return next(`ERROR: Remote method ${input.data.method} was not found`);
        }
        if (Array.isArray(input.data.params) && input.data.params.length > 0) {
          input.data.params.push(next);
          method.apply(method, input.data.params);
        } else {
          method(next);
        }
      }
    ], (err: any, data: any) => FireLoop.publish(
      Object.assign({ err, input, data, created: true }, ctx))
    );
  }
  /**
  * @method create
  * @description
  * Creates a new instance for either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
  static create(ctx: any, input: FireLoopData): void {
    RealTimeLog.log(`FireLoop starting create: ${ctx.modelName}: ${JSON.stringify(input)}`);
    let isScoped: boolean = ctx.modelName.match(/\./g);
    async.waterfall([
      (next: Function) => {
        if (isScoped) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => FireLoop.checkAccess(ctx, ref, 'create', input, next),
      (ref: any, next: Function) => ref.create(input.data, { accessToken: ctx.socket.token }, next)
    ], (err: any, data: any) => {
      const resultContext = Object.assign({ err, input, data, created: true }, ctx);
      FireLoop.response(resultContext);
      if (isScoped) { FireLoop.publish(resultContext); }
    });
  }
  /**
  * @method upsert
  * @description
  * Creates a new instance from either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
  static upsert(ctx: any, input: FireLoopData): void {
    let created: boolean;
    RealTimeLog.log(`FireLoop starting upsert: ${ctx.modelName}: ${JSON.stringify(input)}`);
    let isScoped: boolean = ctx.modelName.match(/\./g);
    // Wont use findOrCreate because only works at level 1, does not work on related references
    async.waterfall([
      (next: Function) => {
        if (isScoped) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => FireLoop.checkAccess(ctx, ref, 'create', input, next),
      (ref: any, next: Function) => {
        if (input.data.id) {
          ref.findById(input.data.id, (err: any, inst: any) => next(err, ref, inst))
        } else {
          next(null, ref, null)
        }
      },
      (ref: any, inst: any, next: Function) => {
        if (inst) {
          created = false;
          Object.keys(input.data).forEach((key: string) => {
            if (typeof inst[key] !== 'function') {
              inst[key] = input.data[key];
            }
          });
          inst.save({ accessToken: ctx.socket.token }, next);
        } else {
          created = true;
          ref.create(input.data, { accessToken: ctx.socket.token }, next);
        }
      }
    ], (err: any, data: any) => {
      const resultContext = Object.assign({ err, input, data, created: true }, ctx);
      FireLoop.response(resultContext);
      if (isScoped) { FireLoop.publish(resultContext); }
    });
  }
  /**
  * @method remove
  * @description
  * Removes instances from either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
  static remove(ctx: any, input: FireLoopData): void {
    RealTimeLog.log(`FireLoop starting remove: ${ctx.modelName}: ${JSON.stringify(input)}`);
    let isScoped: boolean = ctx.modelName.match(/\./g);
    async.waterfall([
      (next: Function) => {
        if (ctx.modelName.match(/\./g)) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => FireLoop.checkAccess(ctx, ref, ref.destroy ? 'destroy' : 'removeById', input, next),
      (ref: any, next: Function) => ref.destroy
        ? ref.destroy(input.data.id, { accessToken: ctx.socket.token }, next)
        : ref.removeById(input.data.id, { accessToken: ctx.socket.token }, next)
    ], (err: any) => {
      const resultContext = Object.assign({ err, input, removed: input.data }, ctx);
      FireLoop.response(resultContext);
      if (isScoped) { FireLoop.publish(resultContext); }
    });
  }
  /**
  * @method response
  * @description
  * Response to client who started this process
  **/
  static response(ctx: any): void {
    // Response to the client that sent the request
    if (ctx.subscription && ctx.subscription.id) {
      ctx.socket.emit(
        `${ctx.modelName}.value.result.${ctx.subscription.id}`,
        ctx.err ? { error: ctx.err } : ctx.data || ctx.removed
      );
    }
  }
  /**
  * @method publish
  * @description
  * Publish gateway that will broadcast according the specific case.
  *
  * Context will be destroyed everytime, make sure the ctx passed is a
  * custom copy for current request or else bad things will happen :P.
  * WARNING: Do not pass the root context.
  *
  * Optional ctx properties:
  * ctx.subscription.id
  * ctx.input
  * Required ctx properties
  * ctx.modelName
  * ctx.data or ctx.removed
  **/
  static publish(ctx: any): void {
    // We don't broadcast to others if there is an error
    if (ctx.err) { return; }
    // We only broadcast remote methods if the request is public since are unknown events
    if (ctx.input && ctx.input.data && ctx.input.data.method) {
      if (ctx.input && ctx.input.data && ctx.input.data.method && ctx.input.data.broadcast) {
        FireLoop.broadcast(ctx, 'remote');
      }
      return;
    }
    // FireLoop events will be public by default since are known events
    if (ctx.data) {
      FireLoop.broadcast(ctx, 'value');
      if (ctx.created) {
        FireLoop.broadcast(ctx, 'child_added');
      } else {
        FireLoop.broadcast(ctx, 'child_changed');
      }
    } else if (ctx.removed) {
      FireLoop.broadcast(ctx, 'child_removed');
    }
    // In any write operations we call the following events
    // except by custom remote methods.
    FireLoop.broadcast(ctx, 'change');
    FireLoop.broadcast(ctx, 'stats');
  }
  /**
  * @method broadcast
  * @description
  * Notifies other server instances to start a broadcasting process, this
  * allows each server to notify their own clients upon their specific requests,
  * then it will clean the context from the user that started the process.
  *
  * Context will be destroyed everytime, make sure the ctx passed is a
  * custom copy for current request or else bad things will happen :P.
  * WARNING: Do not pass the root context.
  *
  * There are 2 different type context used in this method
  * 1.- ctx = user executing an operation (Publisher)
  * 2.- context = users subscribed to specific operations (Subscribers)
  **/
  static broadcast(ctx: any, event: string): void {
    RealTimeLog.log(`FireLoop ${event} broadcasting`);
    FireLoop.driver.server.to('flint').emit(`${ctx.modelName}.${event}.broadcast`, ctx.data || ctx.removed);
    ctx = null;
  }
  /**
  * @method setupServerBroadcast
  * @description
  * Setup the broadcast process to notify other server instances that an event needs
  * to be propagated between their own clients.
  **/
  static setupServerBroadcast(ctx: any, event: string): void {
    FireLoop.driver.internal.on(`${ctx.modelName}.${event}.broadcast`, (payload: any) => {
      Object.keys(FireLoop.contexts).forEach((connContextId: number) => {
        Object.keys(FireLoop.contexts[connContextId]).forEach((contextId: number) => {
          let context: any = FireLoop.contexts[connContextId][contextId];
          let scopeModelName: string = context.modelName.match(/\./g) ? context.modelName.split('.').shift() : context.modelName;
          if (context.modelName === ctx.modelName || ctx.modelName.match(new RegExp(`\\b${scopeModelName}\.${context.subscription.relationship}\\b`, 'g'))) {
            if (event.match(/(child_changed|child_removed|remote)/)) {
              context.socket.emit(`${ctx.modelName}.${event}.broadcast.${context.subscription.id}`, payload);
            }
            if (event !== 'remote') {
              context.socket.emit(`${ctx.modelName}.${event}.broadcast.announce.${context.subscription.id}`, 1);
            }
          }
        });
      });
    });
  }
  /**
  * @method setupClientBroadcast
  * @description
  * Setup the actual broadcast process, once it is announced by the broadcast method.
  *
  * Anyway, this setup needs to be done once and prior any broadcast, so it is
  * configured when the connection is made, before any broadcast announce.
  **/
  static setupClientBroadcast(ctx: any, event: string): void {
    if (!event.match(/(value|change|stats|child_added)/)) { return; }
    RealTimeLog.log(`FireLoop setting up: ${ctx.modelName}.${event}.broadcast.request.${ctx.subscription.id}`);
    ctx.socket.on(`${ctx.modelName}.${event}.broadcast.request.${ctx.subscription.id}`, (request: any) => {
      let _request: any = Object.assign({}, request);
      RealTimeLog.log(`FireLoop ${event} broadcast request received: ${JSON.stringify(_request.filter)}`);
      // Standard Broadcast Function (Will be used in any of the cases).
      let broadcast: Function = (err: any, data: any) => {
        if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
        if (event.match(/(value|change|stats)/)) {
          RealTimeLog.log(`FireLoop ${event} broadcasting: ${JSON.stringify(data)}`);
          ctx.socket.emit(`${ctx.modelName}.${event}.broadcast.${ctx.subscription.id}`, err ? { error: err } : data);
        } else {
          data.forEach(
            (d: any) => ctx.socket.emit(
              `${ctx.modelName}.${event}.broadcast.${ctx.subscription.id}`,
              err ? { error: err } : d
            )
          );
        }
      };

      // Define the name of the method
      let remoteEvent: string;
      if (event.match('stats')) {
        remoteEvent = 'stats';
      } else {
        remoteEvent = 'find';
      }

      // Progress of fetching and broadcasting the data
      async.waterfall([
        // Get Reference
        (next: Function) => {
          if (ctx.modelName.match(/\./g)) {
            FireLoop.getReference(ctx.modelName, ctx.input, (ref: any) => {
              if (!ref) {
                next({ error: `${ctx.modelName} Model reference was not found.` });
              } else {
                next(null, ref);
              }
            });
          } else {
            next(null, ctx.Model);
          }
        },
        // Check for Access
        (ref: any, next: Function) => FireLoop.checkAccess(
          ctx,
          ref,
          remoteEvent,
          ctx.input,
          (err: Error, hasAccess: boolean) => next(err, hasAccess, ref)
        ),
        // Make the right call if accessed
        (hasAccess: boolean, ref: any, next: Function) => {
          if (!hasAccess) {
            broadcast(FireLoop.UNAUTHORIZED);
            next();
          } else {
            switch (remoteEvent) {
              case 'find':
                if (ctx.modelName.match(/\./g)) {
                  ref(_request.filter, broadcast);
                } else {
                  ref.find(_request.filter, { accessToken: ctx.socket.token }, broadcast);
                }
                break;
              case 'stats':
                ref.stats(_request.filter.range || 'monthly', _request.filter.custom, _request.filter.where || {}, _request.filter.groupBy, broadcast);
                break;
            }
          }
        }
      ]);
    });
  }
  /**
  * @method checkAccess
  * @param ctx (current client context)
  * @param ref (model reference)
  * @param event (event to be executed)
  * @param input (input request from client)
  * @param next callback function
  * @description
  * This will verify if the current client has access to specific remotes.
  **/
  static checkAccess(ctx: any, ref: any, event: string, input: any, next: Function) {
    if (ref.checkAccess) {
      ref.checkAccess(ctx.socket.token, input && input.parent ? input.parent.id : null, {
        name: event, aliases: []
      }, {}, function (err: any, access: boolean) {
        if (access) {
          next(null, ref);
        } else {
          next(FireLoop.UNAUTHORIZED, ref);
        }
      });
    } else if (ctx.subscription && FireLoop.options.app.models[ctx.subscription.scope].checkAccess) {
      const relationName: string = ctx.modelName.split('.').pop();
      let methodName: string = '';
      switch (event) {
        case 'create':
        case 'upsert':
          methodName = `__create__${relationName}`;
          break;
        case 'remove':
          methodName = `__delete__${relationName}`;
          break;
        default:
          methodName = `__get__${relationName}`;
      }
      ctx.Model.checkAccess(
        ctx.socket.token,
        input && input.parent ? input.parent.id : null,
        {
          name: methodName, aliases: []
        },
        {},
        function (err: Error, access: boolean) {
          if (access) {
            next(null, ref);
          }
          else {
            next(FireLoop.UNAUTHORIZED, ref);
          }
        }
      );
    } else {
      RealTimeLog.log(`Reference not found for: ${ctx.subscription.scope}`);
      next(FireLoop.UNAUTHORIZED, ref);
    }
  }
  /**
  * @method buildId
  * @description
  * This will create unique numeric ids for each conenction context.
  **/
  static buildId(): number {
    let id: number = Date.now() + Math.floor(Math.random() * 100800) *
      Math.floor(Math.random() * 100700) *
      Math.floor(Math.random() * 198500);
    if (FireLoop.contexts[id]) {
      return FireLoop.buildId();
    } else {
      return id;
    }
  }
}
