'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AdMobService } from '@/lib/admob';
import { useRouter } from 'next/navigation';
import { BreakEndedModal } from '@/components/games/BreakEndedModal';
import { GameOverModal } from '@/components/games/GameOverModal';
import { LeaderboardPlacementPopup } from '@/components/games/LeaderboardPlacementPopup';

type FlappyBirdProps = {
    avatarSrc: string;
    onExit: (coins: number) => void;
};

export default function FlappyBirdGame({ avatarSrc, onExit, timeLeft }: FlappyBirdProps & { timeLeft: number }) {
    const { state, recordSession, extendBreak, updateHighScore, submitGameScore } = useApp();
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'START' | 'PLAY' | 'GAME_OVER'>('START');
    const [highScore, setHighScore] = useState(0);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

    // Refs for Game State
    const scoreVal = useRef(0);

    // Mutable Game State Refs
    type BookData = { color: string, spineColor: string, widthPct: number, xOffsetPct: number, heightPct: number };
    type PipeData = { x: number, topHeight: number, gap: number, topBooks: BookData[], bottomBooks: BookData[] };

    const birdY = useRef(0);
    const birdVelocity = useRef(0);
    const pipes = useRef<PipeData[]>([]);
    const frameCount = useRef(0);
    const reqRef = useRef<number | null>(null);

    // Assets
    const birdImg = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.src = avatarSrc;
        birdImg.current = img;

        // Load high score from AppContext (prefer this over localStorage for consistency)
        const savedHigh = state.highScores['flappy-bird'] || 0;
        setHighScore(savedHigh);

        // Dynamic Canvas Logic
        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init

        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
            window.removeEventListener('resize', handleResize);
        };
    }, [avatarSrc]);

    const beginGame = () => {
        // Reset game state for the upcoming round
        scoreVal.current = 0;
        birdY.current = window.innerHeight / 2;
        birdVelocity.current = 0;
        pipes.current = [];
        frameCount.current = 0;
        setGameState('PLAY');
        loop();
    };

    const generateBookStack = (totalHeight: number, pipeWidth: number): BookData[] => {
        const stack: BookData[] = [];
        let currentH = 0;
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#d35400'];
        const spineColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#2c3e50', '#ba4a00'];

        while (currentH < totalHeight) {
            const remaining = totalHeight - currentH;
            const h = Math.min(remaining, Math.max(20, Math.random() * 40 + 10));

            stack.push({
                color: colors[Math.floor(Math.random() * colors.length)],
                spineColor: spineColors[Math.floor(Math.random() * spineColors.length)],
                widthPct: 0.85 + (Math.random() * 0.15),
                xOffsetPct: (Math.random() * 0.1) - 0.05,
                heightPct: h
            });
            currentH += h;
        }
        return stack;
    };

    const loop = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        const GRAVITY = height * 0.00045;
        const PIPE_SPEED = width * 0.012;
        const PIPE_SPAWN_RATE = 120;

        const birdSize = height * 0.07;
        const pipeWidth = width * 0.18;
        const minPipeHeight = height * 0.1;

        birdVelocity.current += GRAVITY;
        birdY.current += birdVelocity.current;

        if (frameCount.current % PIPE_SPAWN_RATE === 0) {
            const gap = height * 0.28;
            const maxTop = height - gap - minPipeHeight;
            const topHeight = Math.floor(Math.random() * (maxTop - minPipeHeight + 1)) + minPipeHeight;

            const topBooks = generateBookStack(topHeight, pipeWidth);
            const bottomBooks = generateBookStack(height - topHeight - gap, pipeWidth);

            pipes.current.push({ x: width, topHeight, gap, topBooks, bottomBooks });
        }

        pipes.current.forEach(p => p.x -= PIPE_SPEED);
        if (pipes.current.length > 0 && pipes.current[0].x < -pipeWidth) {
            pipes.current.shift();
            scoreVal.current += 1;
        }

        const hitCeiling = birdY.current < 0;
        const hitFloor = birdY.current + birdSize > height;
        let collision = hitCeiling || hitFloor;

        pipes.current.forEach(p => {
            if (width * 0.1 + birdSize > p.x + 10 && width * 0.1 < p.x + pipeWidth - 10) {
                if (birdY.current < p.topHeight || birdY.current + birdSize > p.topHeight + p.gap) {
                    collision = true;
                }
            }
        });

        if (collision) {
            handleGameOver();
            return;
        }

        ctx.fillStyle = '#70c5ce';
        ctx.fillRect(0, 0, width, height);

        pipes.current.forEach(p => {
            drawStack(ctx, p.x, 0, pipeWidth, p.topBooks, true);
            drawStack(ctx, p.x, p.topHeight + p.gap, pipeWidth, p.bottomBooks, false);
        });

        const birdX = width * 0.1;
        if (birdImg.current) {
            ctx.drawImage(birdImg.current, birdX, birdY.current, birdSize, birdSize);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(birdX, birdY.current, birdSize, birdSize);
        }

        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, height - (height * 0.05), width, height * 0.05);

        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(Math.max(30, width * 0.08))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeText(scoreVal.current.toString(), width / 2, height * 0.15);
        ctx.fillText(scoreVal.current.toString(), width / 2, height * 0.15);

        frameCount.current++;
        reqRef.current = requestAnimationFrame(loop);
    };

    const drawStack = (ctx: CanvasRenderingContext2D, x: number, startY: number, w: number, books: BookData[], isTopStack: boolean) => {
        let currentY = startY;

        books.forEach(book => {
            const bW = w * book.widthPct;
            const bX = x + (w * 0.5) - (bW * 0.5) + (w * book.xOffsetPct);
            const bH = book.heightPct;

            ctx.fillStyle = book.color;
            ctx.fillRect(bX, currentY, bW, bH);

            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(bX, currentY + 4, bW, bH * 0.3);

            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(bX, currentY + bH - 4, bW, 4);

            currentY += bH;
        });
    };

    // Internal timer removed. Using props.timeLeft

    // Check for Time's Up
    // Removed auto-exit logic. Let game finish.

    // Calculate Time Left based on Game Bank
    const gameTime = state.gameTimeBank || 0;
    // We can use a local timer to visualize seconds, but the bank is in minutes.
    // Let's just stick to minutes or assume the Layout handles the decrement.
    // The Layout handles the decrement every minute.
    // We can show "Xm" or switch to "gameTime" prop if passed, but context is safer.

    const handleGameOver = async () => {
        if (reqRef.current) cancelAnimationFrame(reqRef.current);
        const score = scoreVal.current;

        // Ad Logic
        const adPending = sessionStorage.getItem('ad_pending');
        if (adPending === 'true') {
            console.log('[Flappy] Ad Pending, showing interstitial...');
            try {
                // Stop rendering loop? Already stopped via cancelAnimationFrame
                await AdMobService.showInterstitial();
                sessionStorage.removeItem('ad_pending');
            } catch (e) {
                console.error('Ad failed', e);
            }
        }

        setGameState('GAME_OVER');
        const currentHigh = state.highScores['flappy-bird'] || 0;
        if (score > currentHigh) {
            setHighScore(score);
            setIsNewRecord(true);
            updateHighScore('flappy-bird', score);
        }
        // Submit to global leaderboard
        submitGameScore('flappy-bird', score).then(rank => {
            if (rank !== null) {
                setLeaderboardRank(rank);
            }
        });

    };

    const handleInput = () => {
        if (gameState === 'PLAY') {
            // Re-calc jump based on current height
            if (canvasRef.current) {
                birdVelocity.current = canvasRef.current.height * -0.01;
            }
        } else if (gameState === 'START' || gameState === 'GAME_OVER') {
            // Check Game Time
            if (state.gameTimeBank <= 0) {
                // Do nothing, UI will show BreakEndedModal
                return;
            }
            beginGame();
        }
    };
    // ...

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                handleInput();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, state.gameTimeBank]);

    return (
        <div
            onClick={handleInput}
            style={{
                width: '100vw',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
                background: '#333'
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: 'block', // Remove inline spacing
                    width: '100%',
                    height: '100%',
                    background: '#70c5ce',
                    cursor: 'pointer'
                }}
            />

            {/* Timer Display */}
            <div style={{
                position: 'absolute',
                top: 'calc(env(safe-area-inset-top) + 20px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: state.gameTimeBank <= 0 ? '#e74c3c' : '#27ae60',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                pointerEvents: 'none',
                transition: 'background 0.3s'
            }}>
                Game Time: {state.gameTimeBank}m
            </div>

            {/* UI Overlays */}
            {gameState === 'START' && (
                <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, color: 'white', textAlign: 'center', pointerEvents: 'none' }}>
                    <h1 style={{ fontSize: '2rem', textShadow: '2px 2px 0 #000' }}>Flappy Buddies</h1>
                    <p>Tap to Jump</p>
                    <p style={{ marginTop: '20px', fontSize: '1.2rem', animation: 'pulse 1s infinite' }}>Tap to Start</p>
                </div>
            )}



            {gameState === 'GAME_OVER' && (
                state.gameTimeBank <= 0 ? (
                    <BreakEndedModal
                        canWatchAd={false}
                        title="Out of Game Time"
                        message="You've used all your game time! Return to study mode to earn more."
                        onWatchAd={async () => {
                            // await extendBreak(1);
                        }}
                        onExit={() => router.push('/study')}
                    />
                ) : (
                    <GameOverModal
                        // @ts-ignore
                        key={scoreVal.current}
                        score={scoreVal.current}
                        highScore={state.highScores['flappy-bird'] || 0}
                        isNewRecord={isNewRecord}
                        onRestart={() => { setIsNewRecord(false); setGameState('START'); scoreVal.current = 0; }}
                        onBackToStudy={() => onExit(scoreVal.current * 10)}
                    />
                )
            )}

            {/* Exit Button (Always visible) - Moved to LEFT */}
            <button
                onClick={(e) => { e.stopPropagation(); onExit(scoreVal.current * 10); }}
                style={{
                    position: 'absolute',
                    top: 'calc(env(safe-area-inset-top) + 20px)',
                    left: '20px',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(4px)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    zIndex: 100,
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
            >
                <span>←</span> Exit
            </button>

            <style jsx>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                @keyframes countdownPop {
                    0% { transform: scale(2); opacity: 0; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 1; }
                }
            `}</style>

            {/* Leaderboard Placement Popup */}
            {leaderboardRank !== null && (
                <LeaderboardPlacementPopup
                    rank={leaderboardRank}
                    score={scoreVal.current}
                    gameName="Flappy Buddies"
                    onClose={() => setLeaderboardRank(null)}
                />
            )}
        </div>
    );
}
