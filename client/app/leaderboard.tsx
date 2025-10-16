"use client";

import { useState, useEffect } from "react";
import { Session } from "@heroiclabs/nakama-js";
import nakamaClient from "./nakama";

interface PlayerStats {
  userId: string;
  username: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  rating: number;
  rank: number;
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
}

interface LeaderboardProps {
  session: Session | null;
}

export default function Leaderboard({ session }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'stats'>('leaderboard');

  const fetchLeaderboard = async () => {
    if (!session) return;
    
    setLoading(true);
    try {
      const result = await nakamaClient.rpc(session, 'get_leaderboard', {});
      const data = JSON.parse(result.payload as unknown as string);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerStats = async () => {
    if (!session) return;
    
    setLoading(true);
    try {
      const result = await nakamaClient.rpc(session, 'get_player_stats', {
        userId: session.user_id
      });
      const stats = JSON.parse(result.payload as unknown as string);
      setPlayerStats(stats);
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      if (activeTab === 'leaderboard') {
        fetchLeaderboard();
      } else {
        fetchPlayerStats();
      }
    }
  }, [session, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) {
    return (
      <div className="text-center text-gray-400">
        Please connect to view leaderboard
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex mb-6 border-b border-gray-600">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'leaderboard'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-semibold ml-4 ${
            activeTab === 'stats'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          My Stats
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading...</p>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && !loading && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
            🏆 Leaderboard
            <button
              onClick={fetchLeaderboard}
              className="ml-4 text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
            >
              Refresh
            </button>
          </h2>
          
          {leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-600">
                    <th className="py-2">Rank</th>
                    <th className="py-2">Player</th>
                    <th className="py-2">Rating</th>
                    <th className="py-2">Wins</th>
                    <th className="py-2">Losses</th>
                    <th className="py-2">Draws</th>
                    <th className="py-2">W/L Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr
                      key={player.userId}
                      className={`border-b border-gray-700 ${
                        player.userId === session.user_id ? 'bg-blue-900/30' : ''
                      }`}
                    >
                      <td className="py-3">
                        <span className="font-bold text-yellow-400">#{index + 1}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center">
                          {player.userId === session.user_id && (
                            <span className="text-blue-400 mr-2">👤</span>
                          )}
                          <span className="font-semibold">{player.username}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-green-400">{player.rating}</span>
                      </td>
                      <td className="py-3 text-green-400">{player.wins}</td>
                      <td className="py-3 text-red-400">{player.losses}</td>
                      <td className="py-3 text-yellow-400">{player.draws}</td>
                      <td className="py-3">
                        {player.losses > 0
                          ? (player.wins / player.losses).toFixed(2)
                          : player.wins > 0
                          ? '∞'
                          : '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No leaderboard data available</p>
          )}
        </div>
      )}

      {/* Player Stats Tab */}
      {activeTab === 'stats' && !loading && playerStats && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            📊 Your Statistics
            <button
              onClick={fetchPlayerStats}
              className="ml-4 text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
            >
              Refresh
            </button>
          </h2>
          
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">{playerStats.totalGames}</div>
              <div className="text-sm text-gray-400">Total Games</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">{playerStats.wins}</div>
              <div className="text-sm text-gray-400">Wins</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-400">{playerStats.rating}</div>
              <div className="text-sm text-gray-400">Rating</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-400">#{playerStats.rank}</div>
              <div className="text-sm text-gray-400">Rank</div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Game Results</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Wins:</span>
                  <span className="text-green-400 font-bold">{playerStats.wins}</span>
                </div>
                <div className="flex justify-between">
                  <span>Losses:</span>
                  <span className="text-red-400 font-bold">{playerStats.losses}</span>
                </div>
                <div className="flex justify-between">
                  <span>Draws:</span>
                  <span className="text-yellow-400 font-bold">{playerStats.draws}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-600">
                  <span>Win Rate:</span>
                  <span className="text-blue-400 font-bold">
                    {(playerStats.winRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🏆 Achievements</h3>
              {playerStats.achievements.length > 0 ? (
                <div className="space-y-2">
                  {playerStats.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="bg-gray-600 p-3 rounded border-l-4 border-yellow-400"
                    >
                      <div className="font-semibold text-yellow-400">{achievement.name}</div>
                      <div className="text-sm text-gray-300">{achievement.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No achievements yet. Keep playing!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && !loading && !playerStats && (
        <p className="text-gray-400 text-center py-8">Failed to load player statistics</p>
      )}
    </div>
  );
}