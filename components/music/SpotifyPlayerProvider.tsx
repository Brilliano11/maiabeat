"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import {
  ensureSpotifyPlaybackDevice,
  markSpotifyPlaybackDeviceStale,
  usePlayerStore,
} from "@/store/playerStore";

let sdkScriptPromise: Promise<void> | null = null;
let playerSingleton: InstanceType<NonNullable<typeof window.Spotify>["Player"]> | null =
  null;
let setupStarted = false;
let transferErrorShown = false;
const playbackSyncIntervalMs = 12_000;

type SpotifyWebApiPlaybackState = {
  is_playing?: boolean;
  progress_ms?: number | null;
  device?: { id?: string | null };
  item?: Spotify.Track | null;
};

function markSpotifyTiming(name: string) {
  if (typeof performance === "undefined") return;
  performance.mark(`maiabeat:${name}`);
}

function loadSpotifySdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) {
    markSpotifyTiming("sdk-ready");
    return Promise.resolve();
  }
  if (sdkScriptPromise) return sdkScriptPromise;

  sdkScriptPromise = new Promise((resolve, reject) => {
    markSpotifyTiming("sdk-load-start");
    window.onSpotifyWebPlaybackSDKReady = () => {
      markSpotifyTiming("sdk-ready");
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.scdn.co/spotify-player.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Spotify SDK.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load Spotify SDK."));
    document.body.appendChild(script);
  });

  return sdkScriptPromise;
}

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const lastAutoNextTrackRef = useRef<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const setSdkReady = usePlayerStore((state) => state.setSdkReady);
  const setDeviceId = usePlayerStore((state) => state.setDeviceId);
  const setActiveDeviceId = usePlayerStore((state) => state.setActiveDeviceId);
  const syncFromSdkState = usePlayerStore((state) => state.syncFromSdkState);

  useEffect(() => {
    if (!user || user.id === "local-preview") {
      setSdkReady(false);
      setDeviceId(null);
      return;
    }

    async function setup() {
      try {
        await loadSpotifySdk();
        if (!window.Spotify || playerSingleton || setupStarted) return;
        setupStarted = true;

        const player = new window.Spotify.Player({
          name: "Maiabeat Player",
          getOAuthToken: async (callback) => {
            markSpotifyTiming("token-request-start");
            const response = await fetch("/api/spotify/token");
            const data = (await response.json()) as { access_token?: string; error?: string };
            if (!response.ok || !data.access_token) {
              notify(data.error ?? "Connect Spotify from Profile first.");
              return;
            }
            markSpotifyTiming("token-request-complete");
            callback(data.access_token);
          },
          volume: 0.8,
        });

        player.addListener("ready", async (payload) => {
          const { device_id } = payload as Spotify.ReadyEvent;
          setSdkReady(true);
          setDeviceId(device_id);
          markSpotifyTiming("device-id-ready");
          notify("Maiabeat Spotify device is ready.");
          try {
            await ensureSpotifyPlaybackDevice(device_id, true);
          } catch (error) {
            if (transferErrorShown) return;
            transferErrorShown = true;
            const message = error instanceof Error ? error.message : "";
            if (message.toLowerCase().includes("premium")) notify(message);
          }
        });

        player.addListener("not_ready", () => {
          setSdkReady(false);
          setDeviceId(null);
          markSpotifyPlaybackDeviceStale();
          notify("Spotify device went offline.");
        });

        player.addListener("initialization_error", (payload) => {
          const { message } = payload as Spotify.Error;
          notify(message);
        });

        player.addListener("authentication_error", () => {
          notify("Reconnect Spotify from Profile.");
        });

        player.addListener("account_error", () => {
          notify("Spotify Premium is required to play full tracks in Maiabeat.");
        });

        player.addListener("playback_error", (payload) => {
          const { message } = payload as Spotify.Error;
          notify(message || "Spotify playback error.");
        });

        player.addListener("player_state_changed", (payload) => {
          syncFromSdkState(payload as Spotify.PlaybackState | null);
        });

        playerSingleton = player;
        window.maiabeatActivateSpotifyPlayer = () => player.activateElement();
        window.maiabeatPauseSpotifyPlayer = () => player.pause();
        window.maiabeatResumeSpotifyPlayer = () => player.resume();
        window.maiabeatSetSpotifyVolume = (volume) => player.setVolume(volume);
        const connected = await player.connect();
        setSdkReady(connected);
      } catch {
        setupStarted = false;
        setSdkReady(false);
      }
    }

    void setup();
  }, [setDeviceId, setSdkReady, syncFromSdkState, user]);

  useEffect(() => {
    if (!user || user.id === "local-preview") return;
    let active = true;
    let requestInFlight = false;

    const syncPlaybackState = async () => {
      if (!active || requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;
      try {
        const response = await fetch("/api/spotify/playback-state", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { state?: SpotifyWebApiPlaybackState | null };
        const state = data.state;
        if (!state?.item) return;

        if (state.device?.id) setActiveDeviceId(state.device.id);
        syncFromSdkState({
          paused: !state.is_playing,
          position: state.progress_ms ?? 0,
          duration: state.item.duration_ms,
          track_window: { current_track: state.item },
        });
      } catch {
        // SDK events remain authoritative while Spotify's REST state is unavailable.
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncPlaybackState();
    };
    void syncPlaybackState();
    const interval = window.setInterval(syncPlaybackState, playbackSyncIntervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [setActiveDeviceId, syncFromSdkState, user]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.isPlaying || !state.currentSong) return;

      const nextProgress = Math.min(state.progressMs + 1000, state.durationMs);
      state.setCurrentTime(Math.round(nextProgress / 1000));

      const trackId = state.currentSong.spotifyTrackId;
      const shouldAutoNext =
        state.durationMs > 0 &&
        state.durationMs - nextProgress <= 1200 &&
        lastAutoNextTrackRef.current !== trackId;

      if (shouldAutoNext) {
        lastAutoNextTrackRef.current = trackId;
        state.handleTrackEnded();
      }

      if (lastAutoNextTrackRef.current && lastAutoNextTrackRef.current !== trackId) {
        lastAutoNextTrackRef.current = null;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return <>{children}</>;
}
