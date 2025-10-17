"use strict";
// Server-authoritative Tic-Tac-Toe match handler for Nakama
// Implements game state management, turn validation, and win conditions
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var OPCODES = {
    GAME_STATE: 1,
    MOVE: 2,
    GAME_OVER: 3,
    ERROR: 4
};
var WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns  
    [0, 4, 8], [2, 4, 6] // diagonals
];
function InitModule(ctx, logger, nk, initializer) {
    initializer.registerMatch('tictactoe', {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchSignal: matchSignal,
        matchTerminate: matchTerminate
    });
    // Register RPC functions for leaderboard and stats
    initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
    initializer.registerRpc('get_player_stats', rpcGetPlayerStats);
    initializer.registerRpc('update_player_stats', rpcUpdatePlayerStats);
    logger.info('Tic-Tac-Toe match handler and RPC functions registered');
}
function matchInit(ctx, logger, nk, params) {
    var gameState = {
        board: Array(9).fill(null),
        currentPlayer: '',
        players: {},
        gameStatus: 'waiting',
        winner: null,
        moveCount: 0
    };
    return {
        state: gameState,
        tickRate: 1, // 1 tick per second
        label: 'Tic-Tac-Toe Match'
    };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var gameState = state;
    // Only allow 2 players max
    if (Object.keys(gameState.players).length >= 2) {
        return {
            state: gameState,
            accept: false,
            rejectMessage: 'Match is full'
        };
    }
    return {
        state: gameState,
        accept: true
    };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = __assign({}, state);
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        // Assign symbol based on join order
        var playerCount = Object.keys(gameState.players).length;
        var symbol = playerCount === 0 ? 'X' : 'O';
        gameState.players[presence.userId] = {
            symbol: symbol,
            username: presence.username
        };
        logger.info("Player ".concat(presence.username, " joined as ").concat(symbol));
        // If we have 2 players, start the game
        if (Object.keys(gameState.players).length === 2) {
            gameState.gameStatus = 'playing';
            // X always goes first
            gameState.currentPlayer = Object.keys(gameState.players).find(function (userId) { return gameState.players[userId].symbol === 'X'; }) || '';
            logger.info("Game started! Current player: ".concat(gameState.currentPlayer));
        }
    }
    // Broadcast updated game state to all players
    var stateMessage = {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        players: gameState.players,
        gameStatus: gameState.gameStatus,
        winner: gameState.winner,
        moveCount: gameState.moveCount
    };
    dispatcher.broadcastMessage(OPCODES.GAME_STATE, JSON.stringify(stateMessage));
    return { state: gameState };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = __assign({}, state);
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        delete gameState.players[presence.userId];
        logger.info("Player ".concat(presence.username, " left the match"));
    }
    // If a player leaves during an active game, end it
    if (gameState.gameStatus === 'playing' && Object.keys(gameState.players).length < 2) {
        gameState.gameStatus = 'finished';
        // Declare remaining player as winner, or end game if no players left
        var remainingPlayers = Object.keys(gameState.players);
        gameState.winner = remainingPlayers.length > 0 ? remainingPlayers[0] : null;
        dispatcher.broadcastMessage(OPCODES.GAME_OVER, JSON.stringify({
            reason: 'Player disconnected',
            winner: gameState.winner
        }));
    }
    return { state: gameState };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    var gameState = __assign({}, state);
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        switch (message.opCode) {
            case OPCODES.MOVE:
                gameState = handleMove(gameState, message, dispatcher, logger);
                break;
            default:
                logger.warn("Unexpected message opCode: ".concat(message.opCode));
        }
    }
    return { state: gameState };
}
function handleMove(gameState, message, dispatcher, logger) {
    var newState = __assign({}, gameState);
    // Validate game is in playing state
    if (newState.gameStatus !== 'playing') {
        dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
            error: 'Game is not in playing state'
        }));
        return newState;
    }
    // Validate it's the player's turn
    if (message.sender.userId !== newState.currentPlayer) {
        dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
            error: 'Not your turn'
        }));
        return newState;
    }
    var moveData;
    try {
        moveData = JSON.parse(nkruntime.binaryToString(message.data));
    }
    catch (error) {
        logger.error('Failed to parse move data:', error);
        return newState;
    }
    // Validate move position
    if (moveData.position < 0 || moveData.position > 8) {
        dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
            error: 'Invalid move position'
        }));
        return newState;
    }
    // Validate position is empty
    if (newState.board[moveData.position] !== null) {
        dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
            error: 'Position already occupied'
        }));
        return newState;
    }
    // Make the move
    var playerSymbol = newState.players[message.sender.userId].symbol;
    newState.board[moveData.position] = playerSymbol;
    newState.moveCount++;
    logger.info("Player ".concat(message.sender.userId, " (").concat(playerSymbol, ") moved to position ").concat(moveData.position));
    // Check for win condition
    var winner = checkWinner(newState.board);
    if (winner) {
        newState.gameStatus = 'finished';
        newState.winner = winner === 'tie' ? 'tie' : message.sender.userId;
        // Update player stats (in a real implementation, this would be done via RPC calls)
        logger.info("Game finished. Winner: ".concat(newState.winner, ", Players: ").concat(Object.keys(newState.players).join(', ')));
        dispatcher.broadcastMessage(OPCODES.GAME_OVER, JSON.stringify({
            winner: newState.winner,
            winningSymbol: winner === 'tie' ? null : playerSymbol,
            board: newState.board,
            gameStats: {
                totalMoves: newState.moveCount,
                players: Object.keys(newState.players).map(function (id) { return ({
                    userId: id,
                    symbol: newState.players[id].symbol,
                    result: winner === 'tie' ? 'draw' : (id === newState.winner ? 'win' : 'loss')
                }); })
            }
        }));
    }
    else {
        // Switch turns
        var playerIds = Object.keys(newState.players);
        newState.currentPlayer = playerIds.find(function (id) { return id !== newState.currentPlayer; }) || '';
    }
    // Broadcast updated game state
    var stateMessage = {
        board: newState.board,
        currentPlayer: newState.currentPlayer,
        players: newState.players,
        gameStatus: newState.gameStatus,
        winner: newState.winner,
        moveCount: newState.moveCount,
        lastMove: {
            position: moveData.position,
            symbol: playerSymbol,
            player: message.sender.userId
        }
    };
    dispatcher.broadcastMessage(OPCODES.GAME_STATE, JSON.stringify(stateMessage));
    return newState;
}
function checkWinner(board) {
    // Check for winning combinations
    for (var _i = 0, WINNING_COMBINATIONS_1 = WINNING_COMBINATIONS; _i < WINNING_COMBINATIONS_1.length; _i++) {
        var combination = WINNING_COMBINATIONS_1[_i];
        var a = combination[0], b = combination[1], c = combination[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Return winning symbol
        }
    }
    // Check for tie (board full, no winner)
    if (board.every(function (cell) { return cell !== null; })) {
        return 'tie';
    }
    // Game continues
    return null;
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state };
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
}
// RPC Functions for Leaderboard and Player Stats
function rpcGetLeaderboard(ctx, logger, nk, payload) {
    try {
        // In a real implementation, you would query the database
        // For this demo, return mock leaderboard data
        var leaderboard = [
            { userId: "user1", username: "Player1", wins: 15, losses: 3, draws: 2, rating: 1250 },
            { userId: "user2", username: "Player2", wins: 12, losses: 5, draws: 3, rating: 1180 },
            { userId: "user3", username: "Player3", wins: 8, losses: 7, draws: 5, rating: 1050 },
            { userId: "user4", username: "Player4", wins: 5, losses: 10, draws: 2, rating: 920 },
            { userId: "user5", username: "Player5", wins: 3, losses: 12, draws: 1, rating: 850 }
        ];
        return JSON.stringify({ leaderboard: leaderboard });
    }
    catch (error) {
        logger.error('Error getting leaderboard:', error);
        return JSON.stringify({ error: 'Failed to get leaderboard' });
    }
}
function rpcGetPlayerStats(ctx, logger, nk, payload) {
    try {
        var request = JSON.parse(payload);
        var userId = request.userId;
        // In a real implementation, query the database for user stats
        // For this demo, return mock data
        var stats = {
            userId: userId,
            username: "Player_".concat(userId.substring(0, 8)),
            totalGames: 25,
            wins: 12,
            losses: 8,
            draws: 5,
            winRate: 0.48,
            rating: 1150,
            rank: 42,
            achievements: [
                { id: 'first_win', name: 'First Victory', description: 'Win your first game' },
                { id: 'streak_3', name: 'Hat Trick', description: 'Win 3 games in a row' }
            ]
        };
        return JSON.stringify(stats);
    }
    catch (error) {
        logger.error('Error getting player stats:', error);
        return JSON.stringify({ error: 'Failed to get player stats' });
    }
}
function rpcUpdatePlayerStats(ctx, logger, nk, payload) {
    try {
        var request = JSON.parse(payload);
        var userId = request.userId, result = request.result; // result: 'win', 'loss', 'draw'
        logger.info("Updating stats for user ".concat(userId, ": ").concat(result));
        // In a real implementation:
        // 1. Update user stats in database
        // 2. Recalculate rating using ELO or similar system
        // 3. Update leaderboard rankings
        // 4. Check for new achievements
        var updatedStats = {
            userId: userId,
            result: result,
            newRating: 1150 + (result === 'win' ? 25 : result === 'loss' ? -20 : 0),
            message: "Stats updated: ".concat(result)
        };
        return JSON.stringify(updatedStats);
    }
    catch (error) {
        logger.error('Error updating player stats:', error);
        return JSON.stringify({ error: 'Failed to update player stats' });
    }
}
// This ensures the module is properly initialized by Nakama
// The InitModule function will be called by Nakama's runtime
