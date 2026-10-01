import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    fps: 0,
    score: 0,
    opponentScore: 0,
    boost: 100,
    speed: 0,
    mode: 'menu',
    time: 180
  });

  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const engine = new GameEngine(containerRef.current, handleStateChange);
    engineRef.current = engine;
    engine.startLoop();
    
    return () => {
      engine.dispose();
    };
  }, [handleStateChange]);

  const startGame = () => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen overflow-hidden relative bg-black">
      {/* 3D Game Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Main Menu Overlay */}
      {gameState.mode === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/70 via-purple-900/50 to-black/70 backdrop-blur-sm">
          {/* Title */}
          <div className="text-center mb-8 animate-pulse">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 drop-shadow-2xl tracking-tight">
              FORTLEGO
            </h1>
            <h2 className="text-3xl md:text-5xl font-bold text-cyan-400 mt-2 tracking-wider">
              ROCKET ARENA
            </h2>
            <p className="text-lg text-gray-300 mt-4">
              🧱 Lego Mod • Rocket League Mode • 180 FPS 🚀
            </p>
          </div>
          
          {/* Play Button */}
          <button
            onClick={startGame}
            className="group relative px-12 py-5 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl text-white text-2xl font-bold shadow-2xl hover:shadow-yellow-500/50 transform hover:scale-110 transition-all duration-300 border-2 border-yellow-300"
          >
            <span className="relative z-10">▶ PLAY ROCKET LEAGUE</span>
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
          </button>
          
          {/* Game Info */}
          <div className="mt-10 grid grid-cols-3 gap-6 text-center">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur border border-white/20">
              <div className="text-3xl mb-2">🏎️</div>
              <div className="text-sm text-gray-300">Lego Cars</div>
              <div className="text-white font-bold">Rocket Mode</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur border border-white/20">
              <div className="text-3xl mb-2">🏔️</div>
              <div className="text-sm text-gray-300">Fortnite</div>
              <div className="text-white font-bold">Landscape</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur border border-white/20">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-sm text-gray-300">Target</div>
              <div className="text-white font-bold">180 FPS</div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="mt-8 bg-black/50 rounded-xl p-6 backdrop-blur border border-white/10 max-w-lg">
            <h3 className="text-xl font-bold text-white mb-3 text-center">🎮 Controls</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">Move Forward</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">W / ↑</div>
              <div className="text-gray-400">Move Back</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">S / ↓</div>
              <div className="text-gray-400">Turn Left</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">A / ←</div>
              <div className="text-gray-400">Turn Right</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">D / →</div>
              <div className="text-gray-400">Jump</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">SPACE</div>
              <div className="text-gray-400">Boost</div>
              <div className="text-white font-mono bg-white/10 px-2 rounded">SHIFT</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Game HUD */}
      {gameState.mode === 'playing' && (
        <>
          {/* Top HUD - Score */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <div className="bg-red-600/80 backdrop-blur px-6 py-3 rounded-l-xl border-2 border-red-400">
              <span className="text-3xl font-black text-white">{gameState.score}</span>
              <span className="text-xs text-red-200 ml-2">YOU</span>
            </div>
            <div className="bg-black/80 backdrop-blur px-4 py-3 rounded-xl border border-gray-600">
              <span className="text-2xl font-bold text-yellow-400 font-mono">
                {formatTime(gameState.time)}
              </span>
            </div>
            <div className="bg-blue-600/80 backdrop-blur px-6 py-3 rounded-r-xl border-2 border-blue-400">
              <span className="text-xs text-blue-200 mr-2">CPU</span>
              <span className="text-3xl font-black text-white">{gameState.opponentScore}</span>
            </div>
          </div>
          
          {/* FPS Counter */}
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg border border-green-500/50">
            <div className="text-green-400 font-mono text-sm font-bold">
              {gameState.fps} FPS
            </div>
            <div className="text-green-300/60 text-xs">Target: 180</div>
          </div>
          
          {/* Speed Display */}
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg border border-cyan-500/50">
            <div className="text-cyan-400 font-mono text-lg font-bold">
              {gameState.speed} <span className="text-xs">km/h</span>
            </div>
          </div>
          
          {/* Boost Bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-64">
            <div className="bg-black/60 backdrop-blur rounded-full p-1 border border-orange-500/50">
              <div className="flex items-center gap-2 px-2">
                <span className="text-orange-400 text-xs font-bold">🔥 BOOST</span>
                <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-100"
                    style={{ 
                      width: `${gameState.boost}%`,
                      background: gameState.boost > 30 
                        ? 'linear-gradient(90deg, #f97316, #eab308)' 
                        : 'linear-gradient(90deg, #ef4444, #f97316)'
                    }}
                  />
                </div>
                <span className="text-orange-300 text-xs font-mono w-8">{Math.round(gameState.boost)}%</span>
              </div>
            </div>
          </div>
          
          {/* Mini instructions */}
          <div className="absolute bottom-2 left-4 text-white/40 text-xs">
            WASD: Drive | SPACE: Jump | SHIFT: Boost
          </div>
          
          {/* Goal notification area */}
          {gameState.score > 0 && gameState.opponentScore === 0 && gameState.time > 175 && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 animate-bounce">
              <div className="text-4xl font-black text-yellow-400 drop-shadow-lg">
                ⚽ GOAL! ⚽
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Game Over */}
      {gameState.mode === 'menu' && gameState.time === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur">
          <h2 className="text-5xl font-black text-white mb-4">
            {gameState.score > gameState.opponentScore ? '🏆 VICTORY!' : gameState.score < gameState.opponentScore ? '💀 DEFEAT' : '🤝 DRAW'}
          </h2>
          <p className="text-2xl text-gray-300 mb-2">
            Final Score: <span className="text-red-400 font-bold">{gameState.score}</span> - <span className="text-blue-400 font-bold">{gameState.opponentScore}</span>
          </p>
          <button
            onClick={startGame}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white text-xl font-bold shadow-xl hover:scale-105 transition-transform"
          >
            🔄 PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
