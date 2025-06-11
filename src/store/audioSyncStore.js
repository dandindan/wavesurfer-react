// src/store/audioSyncStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useAudioSyncStore = create(
  subscribeWithSelector((set, get) => ({
    // 🎵 Core audio state
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    volume: 1.0,
    isMuted: false,
    zoomLevel: 100,
    
    // 📁 File management
    audioFile: null,
    audioUrl: null,
    uploadProgress: 0,
    
    // 🎬 MPV state
    mpvConnected: false,
    mpvCurrentTime: 0,
    mpvDuration: 0,
    mpvPlaying: false,
    
    // 🔄 Sync state
    syncMode: 'idle', // 'idle', 'wavesurfer-master', 'mpv-master'
    syncAccuracy: 0,
    lastSyncTime: 0,
    
    // 📊 Region management
    activeRegion: null,
    regions: [],
    
    // 🎨 UI state
    loading: false,
    error: null,
    status: 'Ready for ultimate audio sync! 🎯',
    
    // 🎵 Actions - WaveSurfer
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setPlaybackRate: (rate) => set({ playbackRate: rate }),
    setVolume: (volume) => set({ volume }),
    setIsMuted: (muted) => set({ isMuted: muted }),
    setZoomLevel: (level) => set({ zoomLevel: level }),
    
    // 📁 Actions - File management
    setAudioFile: (file) => {
      const url = file instanceof File ? URL.createObjectURL(file) : file;
      set({ 
        audioFile: file, 
        audioUrl: url,
        loading: true,
        error: null,
        status: `Loading ${file instanceof File ? file.name : 'audio file'}...`
      });
    },
    
    clearAudioFile: () => {
      const { audioUrl } = get();
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
      set({ 
        audioFile: null, 
        audioUrl: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        loading: false,
        status: 'Ready for ultimate audio sync! 🎯'
      });
    },
    
    setUploadProgress: (progress) => set({ uploadProgress: progress }),
    
    // 🎬 Actions - MPV
    setMpvConnected: (connected) => set({ 
      mpvConnected: connected,
      status: connected ? '🎯 MPV Connected - Perfect Sync Active!' : 'MPV Disconnected'
    }),
    
    setMpvState: (state) => set({
      mpvCurrentTime: state.currentTime !== undefined ? state.currentTime : get().mpvCurrentTime,
      mpvDuration: state.duration !== undefined ? state.duration : get().mpvDuration,
      mpvPlaying: state.isPlaying !== undefined ? state.isPlaying : get().mpvPlaying
    }),
    
    // 🔄 Actions - Sync
    setSyncMode: (mode) => set({ syncMode: mode }),
    updateSyncAccuracy: (accuracy) => {
      const now = Date.now();
      set({ 
        syncAccuracy: accuracy,
        lastSyncTime: now,
        status: accuracy < 0.05 ? 
          '✅ Perfect Sync - Sub-50ms accuracy!' : 
          `⚠️ Sync drift: ${(accuracy * 1000).toFixed(0)}ms`
      });
    },
    
    // 📊 Actions - Regions
    setActiveRegion: (region) => set({ 
      activeRegion: region,
      status: region ? 
        `🎵 Region: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s` : 
        'Region playback ended'
    }),
    
    addRegion: (region) => set((state) => ({
      regions: [...state.regions, region],
      status: `📊 Region created: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`
    })),
    
    removeRegion: (regionId) => set((state) => ({
      regions: state.regions.filter(r => r.id !== regionId),
      activeRegion: state.activeRegion?.id === regionId ? null : state.activeRegion,
      status: 'Region removed'
    })),
    
    clearRegions: () => set({ 
      regions: [], 
      activeRegion: null,
      status: 'All regions cleared'
    }),
    
    // 🎨 Actions - UI
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ 
      error,
      status: error ? `❌ Error: ${error}` : get().status
    }),
    setStatus: (status) => set({ status }),
    
    // 🚀 Advanced actions
    syncToTime: (time, source = 'manual') => {
      const state = get();
      
      // Prevent unnecessary sync loops
      if (Math.abs(state.currentTime - time) < 0.05) return;
      
      set({
        currentTime: time,
        syncMode: source === 'mpv' ? 'mpv-master' : 'wavesurfer-master',
        lastSyncTime: Date.now(),
        status: `🎯 Synced to ${time.toFixed(3)}s (${source})`
      });
    },
    
    // 🎵 Professional audio file validation
    validateAudioFile: (file) => {
      const validTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
        'audio/flac', 'audio/aac', 'audio/m4a',
        'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 
        'video/mkv', 'video/mov'
      ];
      
      const maxSize = 500 * 1024 * 1024; // 500MB
      
      if (!validTypes.includes(file.type)) {
        set({ error: 'Invalid file type. Please upload audio or video files only.' });
        return false;
      }
      
      if (file.size > maxSize) {
        set({ error: 'File too large. Maximum size is 500MB.' });
        return false;
      }
      
      return true;
    },
    
    // 🧹 Ultimate reset function
    reset: () => {
      const { audioUrl } = get();
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
      
      set({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        zoomLevel: 100,
        audioFile: null,
        audioUrl: null,
        uploadProgress: 0,
        mpvConnected: false,
        mpvCurrentTime: 0,
        mpvDuration: 0,
        mpvPlaying: false,
        syncMode: 'idle',
        syncAccuracy: 0,
        lastSyncTime: 0,
        activeRegion: null,
        regions: [],
        loading: false,
        error: null,
        status: '🎯 Reset complete - Ready for ultimate audio sync!'
      });
    },
    
    // 📊 Performance monitoring
    getPerformanceStats: () => {
      const state = get();
      return {
        syncAccuracy: state.syncAccuracy,
        syncMode: state.syncMode,
        lastSyncTime: state.lastSyncTime,
        regionCount: state.regions.length,
        hasActiveRegion: !!state.activeRegion,
        mpvConnected: state.mpvConnected,
        timeDrift: Math.abs(state.currentTime - state.mpvCurrentTime),
        isOptimal: state.syncAccuracy < 0.05 && state.mpvConnected
      };
    }
  }))
);

// 🔄 Ultimate sync monitoring system
// 🔄 Safe sync monitoring system (prevents infinite loops)
let lastSyncUpdate = 0;
useAudioSyncStore.subscribe(
  (state) => ({ 
    currentTime: state.currentTime, 
    mpvCurrentTime: state.mpvCurrentTime,
    isPlaying: state.isPlaying,
    mpvPlaying: state.mpvPlaying,
    mpvConnected: state.mpvConnected
  }),
  (current, previous) => {
    // Prevent infinite loops with throttling
    const now = Date.now();
    if (now - lastSyncUpdate < 100) return; // Throttle to max 10 updates per second
    
    // Only monitor if MPV is connected
    if (!current.mpvConnected) return;
    
    // Calculate real-time sync accuracy
    const timeDrift = Math.abs(current.currentTime - current.mpvCurrentTime);
    const playStateDrift = current.isPlaying !== current.mpvPlaying;
    
    // Update sync accuracy if there's significant drift (but don't call updateSyncAccuracy to avoid loops)
    if (timeDrift > 0.05 || playStateDrift) {
      lastSyncUpdate = now;
      // Direct state update instead of calling updateSyncAccuracy
      useAudioSyncStore.setState({ 
        syncAccuracy: timeDrift,
        lastSyncTime: now
      });
    }
  }
);
// 🎯 Debug utilities (development only)
if (process.env.NODE_ENV === 'development') {
  window.ultimateStore = useAudioSyncStore;
  console.log('🎯 Ultimate Store attached to window.ultimateStore for debugging');
}