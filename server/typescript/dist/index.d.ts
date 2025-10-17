interface GameState {
    board: (string | null)[];
    currentPlayer: string;
    players: {
        [userId: string]: {
            symbol: 'X' | 'O';
            username: string;
        };
    };
    gameStatus: 'waiting' | 'playing' | 'finished';
    winner: string | null;
    moveCount: number;
}
interface MoveData {
    position: number;
}
declare const OPCODES: {
    GAME_STATE: number;
    MOVE: number;
    GAME_OVER: number;
    ERROR: number;
};
declare const WINNING_COMBINATIONS: number[][];
declare function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer): void;
declare function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {
    [key: string]: string;
}): {
    state: nkruntime.MatchState;
    tickRate: number;
    label: string;
};
declare function matchJoinAttempt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {
    [key: string]: any;
}): {
    state: nkruntime.MatchState;
    accept: boolean;
    rejectMessage?: string;
};
declare function matchJoin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {
    state: nkruntime.MatchState;
};
declare function matchLeave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {
    state: nkruntime.MatchState;
};
declare function matchLoop(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]): {
    state: nkruntime.MatchState;
};
declare function handleMove(gameState: GameState, message: nkruntime.MatchMessage, dispatcher: nkruntime.MatchDispatcher, logger: nkruntime.Logger): GameState;
declare function checkWinner(board: (string | null)[]): string | null;
declare function matchSignal(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string): {
    state: nkruntime.MatchState;
    data?: string;
};
declare function matchTerminate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number): {
    state: nkruntime.MatchState;
};
declare function rpcGetLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string;
declare function rpcGetPlayerStats(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string;
declare function rpcUpdatePlayerStats(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string;
