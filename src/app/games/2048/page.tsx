'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AdMobService } from '@/lib/admob';
import { BreakEndedModal } from '@/components/games/BreakEndedModal';
import { GameOverModal } from '@/components/games/GameOverModal';
import { LeaderboardPlacementPopup } from '@/components/games/LeaderboardPlacementPopup';


// --- Constants ---
const GRID_SIZE = 4;
const CELL_GAP = 10;
const CELL_SIZE = 70; // approximate, for styling references if needed

export default function Game2048Page() {
    const { state, updateGame4096, extendBreak, isLoading, updateHighScore, submitGameScore } = useApp();
    const router = useRouter();
    const [points, setPoints] = useState(0);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(() => {
        if (state.breakTimer.endTime) {
            return Math.max(0, Math.ceil((state.breakTimer.endTime - Date.now()) / 1000));
        }
        return 0;
    });

    // Game State
    const [grid, setGrid] = useState<number[][]>([]);
    const [startTouch, setStartTouch] = useState<{ x: number, y: number } | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);

    // --- Break Timer ---
    useEffect(() => {
        const interval = setInterval(() => {
            if (state.breakTimer.endTime) {
                const diff = Math.ceil((state.breakTimer.endTime - Date.now()) / 1000);
                setTimeLeft(Math.max(0, diff));
            } else {
                setTimeLeft(0);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [state.breakTimer.endTime]);

    // --- Game Logic ---

    // Init Grid
    useEffect(() => {
        if (state.game4096) {
            // Restore
            setGrid(state.game4096.grid);
            setPoints(state.game4096.score);
            setGameOver(state.game4096.gameOver);
            setWon(state.game4096.won);
        } else {
            setupGame();
        }
    }, []);

    const setupGame = () => {
        // Save current score before resetting (if game was in progress)
        if (points > 0) {
            const currentHigh = state.highScores['2048'] || 0;
            if (points > currentHigh) {
                updateHighScore('2048', points);
            }
        }

        let newGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        addRandomTile(newGrid);
        addRandomTile(newGrid);

        const newState = {
            grid: newGrid,
            score: 0,
            gameOver: false,
            won: false
        };

        // Update Local & Context
        setGrid(newGrid);
        setPoints(0);
        setGameOver(false);
        setWon(false);
        setIsNewRecord(false);

        // Clear Persistence (or update with clean state)
        if (updateGame4096) updateGame4096(newState);
    };

    const addRandomTile = (currentGrid: number[][]) => {
        const emptyCells: { r: number, c: number }[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (currentGrid[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            currentGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
        return currentGrid;
    };

    // Movement Logic
    // Refactored to avoid calling side-effects during render (inside setState)
    const move = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
        // Guard clauses
        if (gameOver || (state.breakTimer.isActive && timeLeft <= 0)) return;
        if (grid.length === 0) return;

        // Use current grid from scope, not functional update
        let newGrid = grid.map(row => [...row]);
        let moved = false;
        let scoreAdd = 0;
        let newWon = won;

        const rotateLeft = (g: number[][]) => {
            const N = g.length;
            const res = Array(N).fill(0).map(() => Array(N).fill(0));
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    res[N - 1 - c][r] = g[r][c];
                }
            }
            return res;
        };

        const rotateRight = (g: number[][]) => {
            const N = g.length;
            const res = Array(N).fill(0).map(() => Array(N).fill(0));
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    res[c][N - 1 - r] = g[r][c];
                }
            }
            return res;
        };

        // Standardize: Rotate so we always slide LEFT
        let workingGrid = newGrid;
        let rotations = 0;

        if (direction === 'UP') { rotations = 1; workingGrid = rotateLeft(workingGrid); }
        else if (direction === 'RIGHT') { rotations = 2; workingGrid = rotateLeft(rotateLeft(workingGrid)); }
        else if (direction === 'DOWN') { rotations = 3; workingGrid = rotateLeft(rotateLeft(rotateLeft(workingGrid))); }

        // Slide Left Logic
        for (let r = 0; r < GRID_SIZE; r++) {
            let row = workingGrid[r].filter(val => val !== 0);
            for (let c = 0; c < row.length - 1; c++) {
                if (row[c] === row[c + 1]) {
                    row[c] *= 2;
                    scoreAdd += row[c];
                    row[c + 1] = 0;
                    if (row[c] === 2048) newWon = true;
                }
            }
            row = row.filter(val => val !== 0);
            while (row.length < GRID_SIZE) row.push(0);

            // Check if changed
            if (row.some((val, idx) => val !== workingGrid[r][idx])) moved = true;
            workingGrid[r] = row;
        }

        // Un-rotate
        if (rotations === 1) workingGrid = rotateRight(workingGrid);
        if (rotations === 2) workingGrid = rotateRight(rotateRight(workingGrid));
        if (rotations === 3) workingGrid = rotateRight(rotateRight(rotateRight(workingGrid)));

        if (moved) {
            addRandomTile(workingGrid);

            const newScore = points + scoreAdd;
            const isGameOver = !canMove(workingGrid);

            // Update local state
            setGrid(workingGrid);
            setPoints(newScore);
            if (newWon && !won) setWon(true);
            if (isGameOver) {
                setGameOver(true);
                const currentHigh = state.highScores['2048'] || 0;
                if (newScore > currentHigh) {
                    setIsNewRecord(true);
                    updateHighScore('2048', newScore);
                }
                // Submit to global leaderboard
                submitGameScore('2048', newScore).then(rank => {
                    if (rank !== null) {
                        setLeaderboardRank(rank);
                    }
                });
            }

            // Update Context (Side Effect) - Safe here!
            if (updateGame4096) {
                updateGame4096({
                    grid: workingGrid,
                    score: newScore,
                    gameOver: isGameOver,
                    won: newWon
                });
            }
        }
    }, [grid, points, won, gameOver, state.breakTimer.isActive, timeLeft, updateGame4096]);

    const canMove = (g: number[][]) => {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (g[r][c] === 0) return true;
                if (c < GRID_SIZE - 1 && g[r][c] === g[r][c + 1]) return true;
                if (r < GRID_SIZE - 1 && g[r][c] === g[r + 1][c]) return true;
            }
        }
        return false;
    };

    // Controls
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowUp': move('UP'); break;
                case 'ArrowDown': move('DOWN'); break;
                case 'ArrowLeft': move('LEFT'); break;
                case 'ArrowRight': move('RIGHT'); break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [move]);

    const handleTouchStart = (e: React.PointerEvent) => {
        e.preventDefault(); // prevent scroll
        setStartTouch({ x: e.clientX, y: e.clientY });
    };

    const handleTouchEnd = (e: React.PointerEvent) => {
        if (!startTouch) return;
        const dx = e.clientX - startTouch.x;
        const dy = e.clientY - startTouch.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) move(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
            if (Math.abs(dy) > 30) move(dy > 0 ? 'DOWN' : 'UP');
        }
        setStartTouch(null);
    };

    // --- Rendering ---
    const getTileStyle = (val: number) => {
        const baseStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: val > 512 ? '2rem' : '2.5rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            transition: 'all 0.15s ease-in-out',
            boxShadow: val > 0 ? `0 0 10px ${getGlowColor(val)}, inset 0 0 5px rgba(255,255,255,0.2)` : 'none',
            textShadow: val > 0 ? '0 0 5px rgba(0,0,0,0.5)' : 'none',
            color: val > 0 ? '#fff' : 'transparent',
            background: val === 0 ? 'rgba(255, 255, 255, 0.05)' : getTileColor(val),
            // Animation pop
            animation: val > 0 ? 'pop 0.2s ease-out' : 'none'
        };
        return baseStyle;
    };

    const getGlowColor = (val: number) => {
        switch (val) {
            case 2: return '#00f3ff';    // Cyan
            case 4: return '#ff00ff';    // Magenta
            case 8: return '#39ff14';    // Neon Green
            case 16: return '#bc13fe';   // Purple
            case 32: return '#fff01f';   // Yellow
            case 64: return '#ff5e00';   // Orange
            case 128: return '#0048ff';  // Blue
            case 256: return '#ff073a';  // Red
            case 512: return '#00ff88';  // Mint Green
            case 1024: return '#ff6ec7'; // Pink
            case 2048: return '#ffd700'; // Gold
            case 4096: return '#ffffff'; // White (victory)
            default: return '#aaa';
        }
    };

    const getTileColor = (val: number) => {
        return getGlowColor(val);
    };

    if (isLoading) return <div style={{ minHeight: '100vh', background: '#09090b' }} />;

    return (
        <div style={{
            minHeight: '100vh',
            background: '#09090b', // Deep dark
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#fff',
            fontFamily: 'monospace', // Cyberpunk terminal font
            paddingTop: 'calc(env(safe-area-inset-top) + 40px)' // Move down
        }} onPointerDown={handleTouchStart} onPointerUp={handleTouchEnd}>
            {/* Exit Button */}
            <button
                className="btn"
                style={{
                    position: 'absolute',
                    top: 'calc(env(safe-area-inset-top) + 20px)',
                    left: '20px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 100,
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                onClick={() => router.push('/games')}
            >
                <span>←</span> Exit
            </button>

            <header style={{ width: '100%', maxWidth: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
                <img src="/icons/game_2048.png" alt="4096" style={{ height: '80px', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', right: 0, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ background: '#333', padding: '5px 15px', borderRadius: '5px', color: 'white', fontWeight: 'bold', textAlign: 'center', border: '1px solid #555' }}>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#aaa' }}>Score</div>
                        <div style={{ fontSize: '1.2rem', color: '#fff' }}>{points}</div>
                    </div>
                    <button className="btn" style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #00f3ff', color: '#00f3ff', textShadow: '0 0 5px #00f3ff' }} onClick={setupGame}>RESET</button>
                </div>
            </header>

            {/* Timer Check */}
            {state.breakTimer.isActive && (
                <div style={{
                    background: timeLeft <= 0 ? '#e74c3c' : (timeLeft <= 30 ? '#e74c3c' : 'rgba(0,0,0,0.5)'),
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    marginBottom: '20px',
                    border: '1px solid #333',
                    textAlign: 'center',
                    fontWeight: 'bold'
                }}>
                    {timeLeft <= 0 ? 'Break Over! 0s' : `Break Time: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
                </div>
            )}

            <div style={{
                position: 'relative',
                background: '#18181b', // Dark container
                padding: GRID_SIZE,
                borderRadius: '12px',
                width: '340px', // slightly wider for glow spacing
                height: '340px',
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`, // Fix squishing!
                gridGap: '10px',
                touchAction: 'none',
                boxShadow: '0 0 20px rgba(0, 243, 255, 0.2), inset 0 0 20px rgba(0,0,0,0.8)',
                border: '1px solid #333'
            }}>
                {grid.map((row, r) => row.map((val, c) => (
                    <div key={`${r}-${c}`} style={getTileStyle(val)}>
                        {val !== 0 && val}
                    </div>
                )))}

                {/* Overlays */}
                {(state.breakTimer.isActive && timeLeft <= 0) ? (
                    <BreakEndedModal
                        canWatchAd={!state.breakTimer.hasClaimedAd}
                        onWatchAd={async () => {
                            await extendBreak(1);
                        }}
                        onExit={() => router.push('/study')}
                    />
                ) : gameOver && (
                    <GameOverModal
                        score={points}
                        highScore={state.highScores['2048'] || 0}
                        isNewRecord={isNewRecord}
                        onRestart={() => { setIsNewRecord(false); setupGame(); }}
                        onBackToStudy={() => router.push('/games')}
                    />
                )}
                {won && !gameOver && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(237, 194, 46, 0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '6px', pointerEvents: 'none' }}>
                        <h2 style={{ fontSize: '3rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>You Win!</h2>
                        <div style={{ color: 'white', fontSize: '1rem', marginTop: '10px' }}>Keep going...</div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes pop {
                    0% { transform: scale(0.5); opacity: 0; }
                    80% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); }
                }
            `}</style>



            {/* Leaderboard Placement Popup */}
            {leaderboardRank !== null && (
                <LeaderboardPlacementPopup
                    rank={leaderboardRank}
                    score={points}
                    gameName="4096 Neon"
                    onClose={() => setLeaderboardRank(null)}
                />
            )}
        </div>
    );
}
