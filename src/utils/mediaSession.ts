// 1-second silent MP3 data URI
export const SILENT_AUDIO_URI = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////8AAABhTGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAVrGHAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA//OEZAAABAAAAA0gAAAAABAAABAAAAAAAAAAAAAA';

let audio: HTMLAudioElement | null = null;

export const initAudio = () => {
    if (!audio) {
        audio = new Audio(SILENT_AUDIO_URI);
        audio.loop = true;
        audio.volume = 0; // Silent
    }
    return audio;
};

export interface MediaSessionMetadata {
    title: string;
    artist: string;
    album?: string;
    artwork?: { src: string; sizes?: string; type?: string }[];
}

export const startLockScreenSession = async (metadata: MediaSessionMetadata) => {
    const audioEl = initAudio();

    // Resume context if needed (browsers block auto-play)
    try {
        await audioEl.play();
    } catch (e) {
        console.warn('Audio playback failed (user interaction needed?):', e);
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album || 'StudyBudy',
            artwork: metadata.artwork || [
                { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }
};

export const updateLockScreenProgress = (elapsedSeconds: number, totalSeconds: number) => {
    if ('mediaSession' in navigator) {
        const duration = totalSeconds;
        const position = Math.min(elapsedSeconds, duration);

        try {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1,
                position: position
            });
        } catch (e) {
            // Ignore (can fail if duration is 0 or invalid)
        }
    }
};

export const setLockScreenHandlers = (
    onPlay: () => void,
    onPause: () => void
) => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', onPlay);
        navigator.mediaSession.setActionHandler('pause', onPause);
        navigator.mediaSession.setActionHandler('stop', onPause);
    }
};

export const clearLockScreenSession = () => {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
    }
};
