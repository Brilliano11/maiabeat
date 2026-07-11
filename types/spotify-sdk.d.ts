declare namespace Spotify {
  type PlaybackState = {
    paused: boolean;
    position: number;
    duration: number;
    track_window?: {
      current_track?: {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
        artists?: Array<{ name: string }>;
        album?: {
          name?: string;
          images?: Array<{ url: string }>;
        };
      };
    };
  };

  type Error = {
    message: string;
  };

  type ReadyEvent = {
    device_id: string;
  };
}

interface Window {
  Spotify?: {
    Player: new (options: {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }) => {
      addListener: (event: string, callback: (payload: unknown) => void) => void;
      connect: () => Promise<boolean>;
      disconnect: () => void;
      activateElement: () => Promise<void>;
    };
  };
  onSpotifyWebPlaybackSDKReady?: () => void;
  maiabeatActivateSpotifyPlayer?: () => Promise<void>;
}
