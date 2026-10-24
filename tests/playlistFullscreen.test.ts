import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachPlaylistFullscreen, type PlaylistPlayback } from '../src/app/internal/playlistFullscreen';

class Clock extends EventTarget {
    now = 0;
    nextId = 0;
    timers = new Map<number, { at: number; callback: () => void }>();
    setTimeout = (callback: () => void, delay: number) => {
        const id = ++this.nextId;
        this.timers.set(id, { at: this.now + delay, callback });
        return id;
    };
    clearTimeout = (id: number) => { this.timers.delete(id); };
    requestAnimationFrame = (callback: () => void) => this.setTimeout(callback, 16);
    cancelAnimationFrame = this.clearTimeout;
    advance(ms: number) {
        const end = this.now + ms;
        while (true) {
            const next = [...this.timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            this.now = next[1].at;
            this.timers.delete(next[0]);
            next[1].callback();
        }
        this.now = end;
    }
}

function fixture(playingIndex: number | null = 0) {
    const clock = new Clock();
    const doc = Object.assign(new EventTarget(), { defaultView: clock, fullscreenElement: null as object | null });
    const classes = new Set<string>();
    const properties = new Map<string, string>();
    let bounds = { left: 20, top: 30, width: 640, height: 360 };
    const viewport = { style: { setProperty: (key: string, value: string) => properties.set(key, value) } };
    const media = { querySelector: () => viewport, getBoundingClientRect: () => bounds };
    const control = {
        focused: false,
        hovered: false,
        closest: () => control,
        matches: (selector: string) => selector === ':hover' ? control.hovered : control.focused,
        querySelector: () => null,
    };
    const stage = Object.assign(new EventTarget(), {
        ownerDocument: doc,
        closest: () => null,
        classList: {
            add: (...names: string[]) => names.forEach((name) => classes.add(name)),
            remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
            contains: (name: string) => classes.has(name),
        },
        querySelectorAll: (selector: string) => selector === '.playlist-media-entry > .playlist-media' ? [media] : [control],
    });
    const state: PlaylistPlayback = { playingIndex, activeIndex: 0, entryId: 1 };
    const controller = attachPlaylistFullscreen(stage as unknown as HTMLElement, () => state);
    const fire = (type: string, target: object = stage, relatedTarget: object | null = null) => {
        const event = new Event(type);
        Object.defineProperties(event, { target: { value: target }, relatedTarget: { value: relatedTarget } });
        stage.dispatchEvent(event);
    };
    return {
        clock, doc, stage, state, controller, control, properties,
        immersive: () => classes.has('playlist-stage--immersive'),
        settled: () => classes.has('playlist-stage--immersive-settled'),
        enter: () => { doc.fullscreenElement = stage; doc.dispatchEvent(new Event('fullscreenchange')); },
        resize: (width: number, height: number) => { bounds = { ...bounds, width, height }; clock.dispatchEvent(new Event('resize')); },
        fire,
    };
}

test('the playlist expands only during fullscreen playback after the sorter inactivity delay', () => {
    const f = fixture();
    f.clock.advance(10000);
    assert.equal(f.immersive(), false);
    f.enter();
    f.clock.advance(2499);
    assert.equal(f.immersive(), false);
    f.clock.advance(1);
    assert.equal(f.immersive(), true);
    f.clock.advance(500);
    assert.equal(f.settled(), true);
    f.controller.dispose();
});

test('paused players stay visible and pausing or moving restores controls immediately', () => {
    const f = fixture(null);
    f.enter();
    f.clock.advance(10000);
    assert.equal(f.immersive(), false);
    f.state.playingIndex = 0;
    f.controller.playbackChanged();
    f.clock.advance(2500);
    assert.equal(f.immersive(), true);
    f.fire('pointermove');
    assert.equal(f.immersive(), false);
    f.clock.advance(2500);
    assert.equal(f.immersive(), true);
    f.state.playingIndex = null;
    f.controller.playbackChanged();
    assert.equal(f.immersive(), false);
    f.clock.advance(10000);
    assert.equal(f.immersive(), false);
    f.controller.dispose();
});

test('hovering or using keyboard controls prevents them from being hidden', () => {
    const f = fixture();
    f.enter();
    f.fire('pointerover', f.control);
    f.clock.advance(3000);
    assert.equal(f.immersive(), false);
    f.fire('pointerout', f.control, f.stage);
    f.clock.advance(2500);
    assert.equal(f.immersive(), true);
    f.fire('keydown');
    assert.equal(f.immersive(), false);
    f.control.focused = true;
    f.fire('focusin', f.control);
    f.clock.advance(3000);
    assert.equal(f.immersive(), false);
    f.control.focused = false;
    f.fire('focusout', f.control);
    f.clock.advance(2500);
    assert.equal(f.immersive(), true);
    f.fire('pointerdown');
    assert.equal(f.immersive(), false);
    f.controller.dispose();
});

test('grouped-player and next-song autoplay preserve expansion and recover from blocked playback', () => {
    const f = fixture();
    f.enter();
    f.clock.advance(3000);
    f.state.playingIndex = null;
    f.state.activeIndex = 1;
    f.controller.playbackChanged();
    f.clock.advance(4999);
    assert.equal(f.immersive(), true);
    f.state.playingIndex = 1;
    f.controller.playbackChanged();
    f.clock.advance(5001);
    assert.equal(f.immersive(), true);
    f.state.playingIndex = null;
    f.state.activeIndex = 0;
    f.state.entryId = 2;
    f.controller.playbackChanged();
    f.clock.advance(5000);
    assert.equal(f.immersive(), false);
    f.controller.dispose();
});

test('fullscreen exit and unmount cancel pending expansion and remove event listeners', () => {
    const f = fixture();
    f.enter();
    f.clock.advance(3000);
    f.doc.fullscreenElement = null;
    f.doc.dispatchEvent(new Event('fullscreenchange'));
    assert.equal(f.immersive(), false);
    assert.equal(f.settled(), false);
    f.clock.advance(10000);
    assert.equal(f.immersive(), false);
    f.enter();
    f.controller.dispose();
    f.clock.advance(10000);
    assert.equal(f.immersive(), false);
    assert.equal(f.clock.timers.size, 0);
    f.doc.dispatchEvent(new Event('fullscreenchange'));
    f.fire('pointermove');
    assert.equal(f.clock.timers.size, 0);
});

test('player bounds update after resizing and switching playlist entries', () => {
    const f = fixture();
    f.enter();
    assert.equal(f.properties.get('--media-left'), '20px');
    assert.equal(f.properties.get('--media-width'), '640px');
    f.resize(900, 500);
    assert.equal(f.properties.get('--media-width'), '900px');
    assert.equal(f.properties.get('--media-height'), '500px');
    f.state.entryId = 2;
    f.controller.playbackChanged();
    assert.equal(f.properties.get('--media-height'), '500px');
    f.controller.dispose();
});
