"use client";

import { useEffect, useRef } from "react";

type Opts = {
  active: boolean;
  paused: boolean;
  title: string;
  subtitle: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
};

/**
 * Media Session (lock screen / Control Center / headset) + near-silent audio
 * so the OS keeps treating the session as media playback.
 */
export function useFocusMediaSession(opts: Opts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Near-silent oscillator — some platforms only show media controls while "playing"
  useEffect(() => {
    if (!opts.active || typeof window === "undefined") return;

    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0.0001;
    osc.frequency.value = 20;
    osc.connect(gain).connect(ac.destination);
    osc.start();

    void ac.resume().catch(() => {});

    return () => {
      try {
        osc.stop();
        void ac.close();
      } catch {
        /* noop */
      }
    };
  }, [opts.active]);

  useEffect(() => {
    if (!opts.active || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: opts.title,
      artist: opts.subtitle,
      album: "Life OS · Focus",
    });
    ms.playbackState = opts.paused ? "paused" : "playing";

    const play = () => optsRef.current.onPlay();
    const pause = () => optsRef.current.onPause();
    const stop = () => optsRef.current.onStop();
    try {
      ms.setActionHandler("play", play);
      ms.setActionHandler("pause", pause);
      ms.setActionHandler("stop", stop);
    } catch {
      /* unsupported */
    }
    return () => {
      try {
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
        ms.setActionHandler("stop", null);
        ms.playbackState = "none";
      } catch {
        /* noop */
      }
    };
  }, [opts.active, opts.paused, opts.title, opts.subtitle]);
}
