'use client';

import React, { useRef, useEffect, useState } from 'react';

type FlappyBirdProps = {
    avatarSrc: string;
    onExit: (coins: number) => void;
};

export default function FlappyBirdGame({ avatarSrc, onExit, timeLeft }: FlappyBirdProps & { timeLeft: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'START' | 'PLAY' | 'GAME_OVER'>('START');
    const [highScore, setHighScore] = useState(0);

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

        // Load high score
        const saved = localStorage.getItem('flappy_highscore');
        if (saved) setHighScore(parseInt(saved));

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

    const startGame = () => {
        setGameState('PLAY');
        scoreVal.current = 0;
        birdY.current = window.innerHeight / 2;
        birdVelocity.current = 0;
        pipes.current = [];
        frameCount.current = 0;
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
    useEffect(() => {
        if (timeLeft === 0 && gameState !== 'PLAY') {
            onExit(scoreVal.current * 10);
        }
    }, [timeLeft, gameState, onExit]);

    // Format time mm:ss
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleGameOver = () => {
        setGameState('GAME_OVER');
        if (scoreVal.current > highScore) {
            setHighScore(scoreVal.current);
            localStorage.setItem('flappy_highscore', scoreVal.current.toString());
        }
        if (reqRef.current) cancelAnimationFrame(reqRef.current);

        // If time is up, exit immediately instead of showing game over screen
        if (timeLeft === 0) {
            onExit(scoreVal.current * 10);
        }
    };

    const handleInput = () => {
        if (gameState === 'PLAY') {
            // Re-calc jump based on current height
            if (canvasRef.current) {
                birdVelocity.current = canvasRef.current.height * -0.01;
            }
        } else if (gameState === 'START' || gameState === 'GAME_OVER') {
            if (timeLeft > 0) startGame();
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
    }, [gameState, timeLeft]);

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
                background: timeLeft < 30 ? 'rgba(231, 76, 60, 0.8)' : 'rgba(0,0,0,0.5)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                pointerEvents: 'none',
                transition: 'background 0.3s'
            }}>
                Break Time: {formatTime(timeLeft)}
            </div>

            {/* UI Overlays */}
            {gameState === 'START' && (
                <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, color: 'white', textAlign: 'center', pointerEvents: 'none' }}>
                    <h1 style={{ fontSize: '2rem', textShadow: '2px 2px 0 #000' }}>Flappy Study</h1>
                    <p>Tap to Jump</p>
                    <p style={{ marginTop: '20px', fontSize: '1.2rem', animation: 'pulse 1s infinite' }}>Tap to Start</p>
                </div>
            )}

            {gameState === 'GAME_OVER' && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', textAlign: 'center', background: 'rgba(0,0,0,0.8)', padding: '32px', borderRadius: '16px', minWidth: '300px' }}>
                    <h2 style={{ fontSize: '2rem', color: '#e74c3c' }}>Game Over!</h2>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', margin: '20px 0' }}>
                        <div style={{ background: '#ecf0f1', padding: '10px', borderRadius: '8px', color: '#333' }}>
                            <div style={{ fontSize: '0.8rem' }}>SCORE</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{scoreVal.current}</div>
                        </div>
                        <div style={{ background: '#f1c40f', padding: '10px', borderRadius: '8px', color: '#333' }}>
                            <div style={{ fontSize: '0.8rem' }}>BEST</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{highScore}</div>
                        </div>
                    </div>
                    {timeLeft > 0 && (
                        <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); startGame(); }} style={{ width: '100%', marginBottom: '0', padding: '12px' }}>
                            Try Again 🔄
                        </button>
                    )}
                </div>
            )}

            {/* Exit Button (Always visible) - Moved to LEFT */}
            <button
                onClick={(e) => { e.stopPropagation(); onExit(scoreVal.current * 10); }}
                style={{
                    position: 'absolute',
                    top: 'calc(env(safe-area-inset-top) + 20px)',
                    left: '20px',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    zIndex: 100
                }}
            >
                ✕ Exit
            </button>

            <style jsx>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
            `}</style>
        </div>
    );
}
