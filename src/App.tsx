import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    fps: 0, score: 0, opponentScore: 0,
    boost: 100, speed: 0, mode: 'menu', time: 180, goalFlash: 0
  });

  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new GameEngine(containerRef.current, handleStateChange);
    engineRef.current = engine;
    engine.startLoop();
    return () => { engine.dispose(); };
  }, [handleStateChange]);

  const startGame = () => {
    if (engineRef.current) engineRef.current.startGame();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen overflow-hidden relative bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {/* MAIN MENU */}
      {gameState.mode === 'menu' && gameState.time > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(10,5,30,0.7) 50%, rgba(0,0,0,0.8) 100%)' }}>

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative">
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #FF6B00 50%, #FF0044 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 60px rgba(255,100,0,0.3)',
                  filter: 'drop-shadow(0 4px 20px rgba(255,100,0,0.4))'
                }}>
                FORTLEGO
              </h1>
              <h2 className="text-4xl md:text-6xl font-bold tracking-widest mt-1"
                style={{
                  background: 'linear-gradient(90deg, #00ccff, #0088ff, #00ccff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 10px rgba(0,150,255,0.5))'
                }}>
                ROCKET ARENA
              </h2>
            </div>
            <p className="text-gray-400 mt-4 text-lg tracking-wide">
              🏎️ Réaliste • Paysage Naturel • Mode Rocket League
            </p>
          </div>

          {/* Play Button */}
          <button onClick={startGame}
            className="group relative mt-4 px-14 py-5 rounded-2xl text-white text-2xl font-black tracking-wider overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FF6B00, #FF0044)',
              boxShadow: '0 0 40px rgba(255,80,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,200,0,0.5)'
            }}>
            <span className="relative z-10 flex items-center gap-3">
              <span className="text-3xl">▶</span> JOUER
            </span>
          </button>

          {/* Features */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl px-4">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-2">🏎️</div>
              <div className="text-white font-bold text-sm">Voitures Réalistes</div>
              <div className="text-gray-500 text-xs mt-1">Style Rocket League</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-2">🏔️</div>
              <div className="text-white font-bold text-sm">Paysage Réaliste</div>
              <div className="text-gray-500 text-xs mt-1">Terrain & Forêt</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-2">⚡</div>
              <div className="text-white font-bold text-sm">180 FPS</div>
              <div className="text-gray-500 text-xs mt-1">Haute Performance</div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-8 bg-black/60 backdrop-blur-md rounded-2xl p-5 border border-white/10 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-3 text-center">🎮 Contrôles</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <span className="text-gray-400">Accélérer</span>
              <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-center">W / ↑</span>
              <span className="text-gray-400">Reculer</span>
              <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-center">S / ↓</span>
              <span className="text-gray-400">Tourner</span>
              <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-center">A D / ← →</span>
              <span className="text-gray-400">Sauter</span>
              <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-center">ESPACE</span>
              <span className="text-gray-400">Boost 🔥</span>
              <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-center">SHIFT</span>
            </div>
          </div>
        </div>
      )}

      {/* GAME HUD */}
      {gameState.mode === 'playing' && (
        <>
          {/* Scoreboard */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center">
            <div className="flex items-center rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Player score */}
              <div className="px-5 py-2 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(255,50,0,0.3), rgba(255,50,0,0.1))' }}>
                <span className="text-xs text-red-300 font-bold">YOU</span>
                <span className="text-3xl font-black text-white">{gameState.score}</span>
              </div>
              {/* Timer */}
              <div className="px-4 py-2 border-x border-white/10">
                <div className="text-xl font-mono font-bold" style={{ color: gameState.time < 30 ? '#ff4444' : '#FFD700' }}>
                  {formatTime(gameState.time)}
                </div>
              </div>
              {/* Opponent score */}
              <div className="px-5 py-2 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(0,80,255,0.1), rgba(0,80,255,0.3))' }}>
                <span className="text-3xl font-black text-white">{gameState.opponentScore}</span>
                <span className="text-xs text-blue-300 font-bold">CPU</span>
              </div>
            </div>
          </div>

          {/* FPS */}
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,255,100,0.3)' }}>
            <div className="text-green-400 font-mono text-sm font-bold">{gameState.fps} FPS</div>
          </div>

          {/* Speed */}
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,200,255,0.3)' }}>
            <div className="text-cyan-400 font-mono text-lg font-bold">
              {gameState.speed}<span className="text-xs text-cyan-300 ml-1">km/h</span>
            </div>
          </div>

          {/* Boost Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72">
            <div className="rounded-xl p-1.5" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,150,0,0.3)' }}>
              <div className="flex items-center gap-2 px-2">
                <span className="text-orange-400 text-xs font-bold whitespace-nowrap">🔥 BOOST</span>
                <div className="flex-1 h-3 bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${gameState.boost}%`,
                      background: gameState.boost > 30
                        ? 'linear-gradient(90deg, #f97316, #fbbf24)'
                        : 'linear-gradient(90deg, #ef4444, #f97316)'
                    }} />
                </div>
                <span className="text-orange-300 text-xs font-mono w-8 text-right">{Math.round(gameState.boost)}%</span>
              </div>
            </div>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-2 left-3 text-white/30 text-xs">
            WASD: Conduire | ESPACE: Sauter | SHIFT: Boost
          </div>

          {/* GOAL Flash */}
          {gameState.goalFlash > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center animate-bounce">
                <div className="text-6xl md:text-8xl font-black"
                  style={{
                    background: 'linear-gradient(180deg, #FFD700, #FF6B00)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 30px rgba(255,200,0,0.8))'
                  }}>
                  ⚽ BUT! ⚽
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* GAME OVER */}
      {gameState.mode === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
          <div className="text-center">
            <h2 className="text-5xl md:text-7xl font-black mb-4"
              style={{
                background: gameState.score > gameState.opponentScore
                  ? 'linear-gradient(180deg, #FFD700, #FF6B00)'
                  : gameState.score < gameState.opponentScore
                    ? 'linear-gradient(180deg, #ff4444, #880000)'
                    : 'linear-gradient(180deg, #aaa, #666)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(255,200,0,0.3))'
              }}>
              {gameState.score > gameState.opponentScore ? '🏆 VICTOIRE!' : gameState.score < gameState.opponentScore ? '💀 DÉFAITE' : '🤝 ÉGALITÉ'}
            </h2>
            <p className="text-2xl text-gray-300 mb-2">
              Score Final
            </p>
            <p className="text-4xl font-black mb-6">
              <span className="text-red-400">{gameState.score}</span>
              <span className="text-gray-500 mx-2">-</span>
              <span className="text-blue-400">{gameState.opponentScore}</span>
            </p>
            <button onClick={startGame}
              className="px-10 py-4 rounded-xl text-white text-xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #00cc44, #008833)',
                boxShadow: '0 0 30px rgba(0,200,50,0.3)',
                border: '2px solid rgba(0,255,100,0.4)'
              }}>
              🔄 REJOUER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
