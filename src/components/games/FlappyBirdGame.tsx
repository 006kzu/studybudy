'use client';

import React, { useRef, useEffect, useState } from 'react';

type FlappyBirdProps = {
    avatarSrc: string;
    onExit: (coins: number) => void;
};

export default function FlappyBirdGame({ avatarSrc, onExit }: FlappyBirdProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'START' | 'PLAY' | 'GAME_OVER'>('START');
    const [highScore, setHighScore] = useState(0);

    // Refs for Game State (Mutable, no re-renders)
    const scoreVal = useRef(0);

    // Game Constants - Tuned Mode
    const GRAVITY = 0.12;
    const JUMP = -3.5;
    const PIPE_SPEED = 1.8;    // Little faster
    const PIPE_SPAWN_RATE = 220;

    // Mutable Game State Refs (for Loop)
    const birdY = useRef(300);
    const birdVelocity = useRef(0);
    const pipes = useRef<{ x: number, topHeight: number, gap: number }[]>([]);
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

        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
        };
    }, [avatarSrc]);

    const startGame = () => {
        setGameState('PLAY');
        scoreVal.current = 0;
        birdY.current = 300;
        birdVelocity.current = 0;
        pipes.current = [];
        frameCount.current = 0;
        loop();
    };

    const loop = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Update Physics
        birdVelocity.current += GRAVITY;
        birdY.current += birdVelocity.current;

        // Spawn Pipes
        if (frameCount.current % PIPE_SPAWN_RATE === 0) {
            const minHeight = 50;
            // Variable Gap: Random between 240 and 290
            const gap = Math.floor(Math.random() * (290 - 240 + 1)) + 240;
            const maxHeight = canvas.height - gap - minHeight;
            const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
            pipes.current.push({ x: canvas.width, topHeight, gap });
        }

        // Move Pipes & Remove old ones
        pipes.current.forEach(p => p.x -= PIPE_SPEED);
        if (pipes.current.length > 0 && pipes.current[0].x < -60) {
            pipes.current.shift();
            scoreVal.current += 1;
        }

        // Collision Detection
        const birdSize = 40; // Hitbox size
        const hitCeiling = birdY.current < 0;
        const hitFloor = birdY.current + birdSize > canvas.height;

        let collision = hitCeiling || hitFloor;

        pipes.current.forEach(p => {
            const pipeWidth = 60;
            // Horizontal check
            if (50 + birdSize > p.x && 50 < p.x + pipeWidth) {
                // Vertical check (Hit top pipe OR hit bottom pipe)
                // Use per-pipe gap
                if (birdY.current < p.topHeight || birdY.current + birdSize > p.topHeight + p.gap) {
                    collision = true;
                }
            }
        });

        if (collision) {
            handleGameOver();
            return;
        }

        // --- DRAW ---
        // Sky
        ctx.fillStyle = '#70c5ce';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pipes (Books)
        ctx.fillStyle = '#654321'; // Brown spine color
        pipes.current.forEach(p => {
            // Top Pipe
            drawBooks(ctx, p.x, 0, 60, p.topHeight);
            // Bottom Pipe
            drawBooks(ctx, p.x, p.topHeight + p.gap, 60, canvas.height - (p.topHeight + p.gap));
        });

        // Bird
        if (birdImg.current) {
            ctx.drawImage(birdImg.current, 50, birdY.current, birdSize, birdSize);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(50, birdY.current, birdSize, birdSize);
        }

        // Floor
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

        // Score
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeText(scoreVal.current.toString(), canvas.width / 2 - 10, 50);
        ctx.fillText(scoreVal.current.toString(), canvas.width / 2 - 10, 50);

        frameCount.current++;
        reqRef.current = requestAnimationFrame(loop);
    };

    // Helper to draw stacks of books instead of plain pipes
    const drawBooks = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
        const bookHeight = 20;
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6']; // Red, Blue, Green, Yellow, Purple

        for (let curY = y; curY < y + h; curY += bookHeight) {
            const colorIndex = Math.floor((curY / bookHeight) % colors.length);
            ctx.fillStyle = colors[colorIndex];
            // Randomize width slightly for "messy stack" look
            const offset = Math.random() * 5;
            const width = w - 5 + (Math.random() * 10);
            const currentH = Math.min(bookHeight, (y + h) - curY); // Clip last book

            ctx.fillRect(x + (w - width) / 2, curY, width, currentH);

            // Book Spine Detail
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(x + (w - width) / 2, curY + 2, width, 2);
        }
    };

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

    // Timer Countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

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
            birdVelocity.current = JUMP;
        } else if (gameState === 'START' || gameState === 'GAME_OVER') {
            // Prevent starting if time is up (though effect normally catches this)
            if (timeLeft > 0) {
                startGame();
            }
        }
    };

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
                width: '100%',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#333',
                position: 'relative'
            }}
        >
            <canvas
                ref={canvasRef}
                width={400}
                height={600}
                style={{
                    background: '#70c5ce',
                    borderRadius: '8px',
                    boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                    cursor: 'pointer'
                }}
            />

            {/* Timer Display */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: timeLeft < 30 ? 'rgba(231, 76, 60, 0.8)' : 'rgba(0,0,0,0.5)', // Red warning
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
                <div style={{ position: 'absolute', color: 'white', textAlign: 'center', pointerEvents: 'none' }}>
                    <h1 style={{ fontSize: '2rem', textShadow: '2px 2px 0 #000' }}>Flappy Study</h1>
                    <p>Tap, Click, or Space to Float</p>
                    <p style={{ marginTop: '20px', fontSize: '1.2rem', animation: 'pulse 1s infinite' }}>Tap to Start</p>
                </div>
            )}

            {gameState === 'GAME_OVER' && (
                <div style={{ position: 'absolute', color: 'white', textAlign: 'center', background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '16px' }}>
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
                        <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); startGame(); }}>
                            Try Again 🔄
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onExit(scoreVal.current * 10); }} style={{ marginTop: '10px', display: 'block', width: '100%' }}>
                        Back to Study 📚
                    </button>
                </div>
            )}

            {/* Exit Button (Always visible) */}
            <button
                onClick={(e) => { e.stopPropagation(); onExit(scoreVal.current * 10); }}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
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
