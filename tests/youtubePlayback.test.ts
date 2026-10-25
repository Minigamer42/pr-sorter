import assert from 'node:assert/strict';
import { test } from 'node:test';
import { YouTubePlayback, type YouTubePlayerInstance } from '../src/media/internal/youtubePlayback';

function fixture() {
    const commands: unknown[][] = [];
    const events: string[] = [];
    let state = -1;
    let videoId = '';
    const player: YouTubePlayerInstance = {
        destroy: () => { commands.push(['destroy']); },
        getPlayerState: () => state,
        getVideoUrl: () => `https://www.youtube.com/watch?v=${videoId}`,
        loadVideoById: (id) => { commands.push(['load', id]); videoId = id; state = -1; },
        cueVideoById: (id) => { commands.push(['cue', id]); videoId = id; state = 5; },
        seekTo: (seconds, allowSeekAhead) => { commands.push(['seek', seconds, allowSeekAhead]); },
        playVideo: () => { commands.push(['play']); },
        pauseVideo: () => { commands.push(['pause']); },
    };
    const playback = new YouTubePlayback();
    const callbacks = {
        onPlay: () => { events.push('play'); },
        onPause: () => { events.push('pause'); },
        onEnded: () => { events.push('ended'); },
    };
    const update = (video: string | null, options: { autoPlay?: boolean; paused?: boolean; playbackKey?: number } = {}) => {
        playback.update({ videoId: video, autoPlay: true, paused: false, ...options }, callbacks);
    };
    const emit = (value: number, video = videoId) => {
        state = value;
        videoId = video;
        playback.handleState(value);
    };
    return { playback, player, commands, events, update, emit, callbacks };
}

test('a slot reuses its player for subsequent recordings without replaying on unrelated renders', () => {
    const f = fixture();
    f.update('first');
    f.playback.attach(f.player);
    f.emit(1);
    f.update('first');
    f.update('second');
    f.emit(1);
    assert.deepEqual(f.commands, [['load', 'first'], ['load', 'second']]);
    assert.deepEqual(f.events, ['play', 'play']);
});

test('switching to native media pauses YouTube and suppresses late playback and ended events', () => {
    const f = fixture();
    f.update('youtube');
    f.playback.attach(f.player);
    f.emit(1);
    f.update(null);
    f.emit(0);
    f.emit(1);
    assert.deepEqual(f.events, ['play']);
    assert.deepEqual(f.commands, [['load', 'youtube'], ['pause'], ['pause']]);
    f.update('youtube');
    assert.deepEqual(f.commands.at(-1), ['load', 'youtube']);
});

test('readiness uses the latest song and playback intent after rapid changes', () => {
    const f = fixture();
    f.update('outdated');
    f.update('current', { paused: true });
    f.playback.attach(f.player);
    assert.deepEqual(f.commands, [['cue', 'current']]);
    f.update('current');
    assert.deepEqual(f.commands.at(-1), ['play']);
});

test('a player becoming ready during native playback stays paused until selected again', () => {
    const f = fixture();
    f.update('outdated');
    f.update(null);
    f.playback.attach(f.player);
    assert.deepEqual(f.commands, [['pause']]);
    f.update('next');
    assert.deepEqual(f.commands.at(-1), ['load', 'next']);
});

test('non-autoplay slots cue songs and allow manual playback, including the other sorter side', () => {
    const f = fixture();
    f.update('manual', { autoPlay: false, paused: true });
    f.playback.attach(f.player);
    assert.deepEqual(f.commands, [['cue', 'manual']]);
    f.emit(1);
    assert.deepEqual(f.events, ['play']);
    f.update('manual', { autoPlay: true, paused: false });
    f.emit(0);
    assert.deepEqual(f.events, ['play', 'pause', 'ended']);
});

test('events from an outgoing recording cannot advance the current song', () => {
    const f = fixture();
    f.update('first');
    f.playback.attach(f.player);
    f.emit(1);
    f.update('second');
    f.emit(0, 'first');
    f.emit(1, 'second');
    f.playback.handleState(0); // Queued event whose state no longer matches the player.
    assert.deepEqual(f.events, ['play', 'play']);
    f.emit(0);
    f.emit(0);
    assert.deepEqual(f.events, ['play', 'play', 'pause', 'ended']);
});

test('a new comparison restarts the same recording without rebuilding the iframe', () => {
    const f = fixture();
    f.update('same', { playbackKey: 1 });
    f.playback.attach(f.player);
    f.emit(1);
    f.update('same', { playbackKey: 2 });
    f.emit(0); // Ended from the prior comparison before the new playback starts.
    assert.deepEqual(f.commands, [['load', 'same'], ['load', 'same']]);
    assert.deepEqual(f.events, ['play']);
});

test('autoplay hands off, rewinds ended songs, and resumes after an explicit pause', () => {
    const f = fixture();
    f.update('song');
    f.playback.attach(f.player);
    f.emit(1);
    f.emit(0);
    f.update('song', { autoPlay: false });
    f.update('song');
    assert.deepEqual(f.commands.slice(-3), [['pause'], ['seek', 0, true], ['play']]);
    f.update('song', { paused: true });
    f.update('song', { paused: true });
    assert.deepEqual(f.commands.at(-1), ['pause']);
    f.emit(2);
    f.update('song');
    assert.deepEqual(f.commands.at(-1), ['play']);
});

test('the two sorter slots keep independent players and callbacks and detach safely', () => {
    const left = fixture();
    const right = fixture();
    left.update('left');
    right.update('right', { autoPlay: false });
    left.playback.attach(left.player);
    right.playback.attach(right.player);
    left.emit(1);
    left.update('left', { paused: true });
    right.update('right');
    right.emit(1);
    assert.deepEqual(left.commands, [['load', 'left'], ['pause']]);
    assert.deepEqual(right.commands, [['cue', 'right'], ['play']]);
    left.playback.detach();
    left.emit(0);
    assert.deepEqual(left.events, ['play']);
    assert.deepEqual(right.events, ['play']);
});

test('callbacks update without restarting the current song', () => {
    const f = fixture();
    f.update('current');
    f.playback.attach(f.player);
    const latestEvents: string[] = [];
    f.playback.update({ videoId: 'current', autoPlay: true, paused: false }, {
        onEnded: () => { latestEvents.push('ended'); },
    });
    f.emit(1);
    f.emit(0);
    assert.deepEqual(f.events, []);
    assert.deepEqual(latestEvents, ['ended']);
    assert.deepEqual(f.commands, [['load', 'current']]);
});
