// Type declarations for Nakama runtime
declare global {
  namespace nkruntime {
    interface Context {}
    interface Logger {
      info(message: string, ...args: any[]): void;
      warn(message: string, ...args: any[]): void;
      error(message: string, ...args: any[]): void;
    }
    interface Nakama {}
    interface Initializer {
      registerMatch(name: string, handlers: MatchHandlers): void;
      registerRpc(id: string, fn: RpcFunction): void;
    }
    interface MatchHandlers {
      matchInit: MatchInitFunction;
      matchJoinAttempt: MatchJoinAttemptFunction;
      matchJoin: MatchJoinFunction;
      matchLeave: MatchLeaveFunction;
      matchLoop: MatchLoopFunction;
      matchSignal: MatchSignalFunction;
      matchTerminate: MatchTerminateFunction;
    }
    interface MatchState {}
    interface Presence {
      userId: string;
      username: string;
      sessionId: string;
    }
    interface MatchDispatcher {
      broadcastMessage(opCode: number, data: string): void;
    }
    interface MatchMessage {
      opCode: number;
      data: Uint8Array;
      sender: Presence;
    }
    type MatchInitFunction = (ctx: Context, logger: Logger, nk: Nakama, params: {[key: string]: string}) => {state: MatchState, tickRate: number, label: string};
    type MatchJoinAttemptFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presence: Presence, metadata: {[key: string]: any}) => {state: MatchState, accept: boolean, rejectMessage?: string};
    type MatchJoinFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presences: Presence[]) => {state: MatchState};
    type MatchLeaveFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presences: Presence[]) => {state: MatchState};
    type MatchLoopFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, messages: MatchMessage[]) => {state: MatchState};
    type MatchSignalFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, data: string) => {state: MatchState, data?: string};
    type MatchTerminateFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, graceSeconds: number) => {state: MatchState};
    type RpcFunction = (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string;
    
    function binaryToString(data: Uint8Array): string;
  }
}

export {};