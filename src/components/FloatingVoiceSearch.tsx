import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Play, Pause, SkipForward, SkipBack, Search, Volume2, Shuffle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { searchDeezerTrack } from "@/services/musicApi";
import { Track } from "@/data/mockData";
import { toast } from "sonner";

// Check if Web Speech API is supported
const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

// Voice command types
type CommandType = 'play' | 'pause' | 'resume' | 'stop' | 'next' | 'skip' | 'previous' | 'back' | 'shuffle' | 'search' | null;

interface ParsedCommand {
  type: CommandType;
  query?: string;
}

// Parse voice commands
function parseVoiceCommand(transcript: string): ParsedCommand {
  const text = transcript.toLowerCase().trim();
  
  // Play specific song: "play [song name]" or "play [song] by [artist]"
  const playMatch = text.match(/^play\s+(.+)/i);
  if (playMatch) {
    return { type: 'play', query: playMatch[1] };
  }
  
  // Search: "search for [query]" or "find [query]" or "look up [query]"
  const searchMatch = text.match(/^(?:search(?:\s+for)?|find|look\s+up)\s+(.+)/i);
  if (searchMatch) {
    return { type: 'search', query: searchMatch[1] };
  }
  
  // Pause commands
  if (/^(pause|stop\s+playing|stop\s+music|stop)$/i.test(text)) {
    return { type: 'pause' };
  }
  
  // Resume commands
  if (/^(resume|continue|unpause|start\s+playing)$/i.test(text)) {
    return { type: 'resume' };
  }
  
  // Next/Skip commands
  if (/^(next|skip|next\s+song|skip\s+song|next\s+track|skip\s+track)$/i.test(text)) {
    return { type: 'next' };
  }
  
  // Previous/Back commands
  if (/^(previous|back|go\s+back|previous\s+song|last\s+song|previous\s+track)$/i.test(text)) {
    return { type: 'previous' };
  }
  
  // Shuffle commands
  if (/^(shuffle|shuffle\s+on|shuffle\s+off|toggle\s+shuffle)$/i.test(text)) {
    return { type: 'shuffle' };
  }
  
  // Default to search if no command matched
  return { type: 'search', query: text };
}

export function FloatingVoiceSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { play, pause, togglePlay, next, previous, toggleShuffle, isPlaying, currentTrack, setQueue } = usePlayer();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedCommand, setDetectedCommand] = useState<ParsedCommand | null>(null);
  
  const processingRef = useRef(false);

  // Don't show on search page (it has its own voice search)
  const isOnSearchPage = location.pathname === "/search";

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());

    if (isSpeechRecognitionSupported()) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        const currentTranscript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setTranscript(currentTranscript);
        setShowTranscript(true);
        
        // Parse command in real-time for visual feedback
        const command = parseVoiceCommand(currentTranscript);
        setDetectedCommand(command);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setShowTranscript(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const executeCommand = useCallback(async (command: ParsedCommand) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      switch (command.type) {
        case 'pause':
          pause();
          toast.success('Paused', { icon: <Pause className="h-4 w-4" /> });
          setShowTranscript(false);
          break;
          
        case 'resume':
          if (currentTrack) {
            play();
            toast.success('Resumed', { icon: <Play className="h-4 w-4" /> });
          } else {
            toast.error('No track to resume');
          }
          setShowTranscript(false);
          break;
          
        case 'next':
          next();
          toast.success('Skipped to next', { icon: <SkipForward className="h-4 w-4" /> });
          setShowTranscript(false);
          break;
          
        case 'previous':
          previous();
          toast.success('Previous track', { icon: <SkipBack className="h-4 w-4" /> });
          setShowTranscript(false);
          break;
          
        case 'shuffle':
          toggleShuffle();
          toast.success('Shuffle toggled', { icon: <Shuffle className="h-4 w-4" /> });
          setShowTranscript(false);
          break;
          
        case 'play':
          if (command.query) {
            toast.loading('Searching...', { id: 'voice-search' });
            const tracks = await searchDeezerTrack(command.query, 5);
            
            if (tracks.length > 0) {
              const track = tracks[0];
              const appTrack: Track = {
                id: `deezer-${track.id}`,
                title: track.title,
                artist: track.artist?.name || 'Unknown',
                album: track.album?.title || 'Unknown',
                artwork: track.album?.cover_medium || track.album?.cover || '',
                duration: track.duration,
              };
              
              // Set queue with found tracks
              const queueTracks: Track[] = tracks.map(t => ({
                id: `deezer-${t.id}`,
                title: t.title,
                artist: t.artist?.name || 'Unknown',
                album: t.album?.title || 'Unknown',
                artwork: t.album?.cover_medium || t.album?.cover || '',
                duration: t.duration,
              }));
              
              setQueue(queueTracks);
              play(appTrack);
              toast.success(`Playing "${track.title}" by ${track.artist?.name}`, { 
                id: 'voice-search',
                icon: <Play className="h-4 w-4" /> 
              });
            } else {
              toast.error(`No results for "${command.query}"`, { id: 'voice-search' });
            }
          } else if (!isPlaying && currentTrack) {
            play();
            toast.success('Resumed', { icon: <Play className="h-4 w-4" /> });
          }
          setShowTranscript(false);
          break;
          
        case 'search':
          if (command.query) {
            navigate(`/search?q=${encodeURIComponent(command.query)}`);
            toast.success(`Searching for "${command.query}"`, { icon: <Search className="h-4 w-4" /> });
          }
          setShowTranscript(false);
          break;
          
        default:
          // If no command detected, treat as search
          if (transcript.trim()) {
            navigate(`/search?q=${encodeURIComponent(transcript.trim())}`);
          }
          setShowTranscript(false);
      }
    } catch (error) {
      console.error('Error executing voice command:', error);
      toast.error('Failed to execute command');
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
      setTranscript("");
      setDetectedCommand(null);
    }
  }, [play, pause, next, previous, toggleShuffle, currentTrack, isPlaying, navigate, transcript, setQueue]);

  const startListening = useCallback(() => {
    if (!recognition) return;
    setTranscript("");
    setShowTranscript(false);
    setDetectedCommand(null);
    recognition.start();
    setIsListening(true);
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (!recognition) return;
    recognition.stop();
    setIsListening(false);
  }, [recognition]);

  const handleCancel = useCallback(() => {
    stopListening();
    setShowTranscript(false);
    setTranscript("");
    setDetectedCommand(null);
  }, [stopListening]);

  // Auto-execute command after speech ends
  useEffect(() => {
    if (!isListening && transcript.trim() && showTranscript && !isProcessing) {
      const timer = setTimeout(() => {
        const command = parseVoiceCommand(transcript);
        executeCommand(command);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript, showTranscript, isProcessing, executeCommand]);

  if (!speechSupported || isOnSearchPage) {
    return null;
  }

  // Get command icon and label
  const getCommandDisplay = () => {
    if (!detectedCommand) return null;
    
    switch (detectedCommand.type) {
      case 'play':
        return { icon: <Play className="h-4 w-4" />, label: detectedCommand.query ? `Play "${detectedCommand.query}"` : 'Play' };
      case 'pause':
        return { icon: <Pause className="h-4 w-4" />, label: 'Pause' };
      case 'resume':
        return { icon: <Play className="h-4 w-4" />, label: 'Resume' };
      case 'next':
        return { icon: <SkipForward className="h-4 w-4" />, label: 'Next Track' };
      case 'previous':
        return { icon: <SkipBack className="h-4 w-4" />, label: 'Previous Track' };
      case 'shuffle':
        return { icon: <Shuffle className="h-4 w-4" />, label: 'Toggle Shuffle' };
      case 'search':
        return { icon: <Search className="h-4 w-4" />, label: `Search "${detectedCommand.query}"` };
      default:
        return null;
    }
  };

  const commandDisplay = getCommandDisplay();

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={isListening ? stopListening : startListening}
        className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors ${
          isListening
            ? 'bg-primary text-primary-foreground shadow-primary/30'
            : 'bg-card text-foreground shadow-black/20 hover:bg-accent'
        }`}
        style={{ bottom: 'calc(8rem + env(safe-area-inset-bottom))' }}
        aria-label={isListening ? "Stop voice search" : "Start voice search"}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
            >
              <MicOff className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -180 }}
            >
              <Mic className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-primary"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-primary"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
      </motion.button>

      {/* Transcript overlay */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-x-4 z-50 overflow-hidden rounded-2xl bg-card/95 p-4 shadow-2xl backdrop-blur-xl"
            style={{ bottom: 'calc(10rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                {isListening ? (
                  <>
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          className="h-4 w-1 rounded-full bg-primary"
                          animate={{ scaleY: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">Listening...</span>
                  </>
                ) : isProcessing ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    Processing...
                  </span>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    Executing command...
                  </span>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-lg font-medium text-foreground">
              {transcript || "Say something..."}
            </p>

            {/* Command detection badge */}
            {commandDisplay && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
                  {commandDisplay.icon}
                  {commandDisplay.label}
                </span>
              </motion.div>
            )}

            {/* Available commands hint */}
            {isListening && !transcript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-xs text-muted-foreground"
              >
                <p className="mb-1 font-medium">Try saying:</p>
                <div className="flex flex-wrap gap-1">
                  {['Play [song]', 'Pause', 'Next', 'Previous', 'Shuffle'].map((cmd) => (
                    <span key={cmd} className="rounded bg-white/5 px-2 py-0.5">
                      {cmd}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {!isListening && transcript && !isProcessing && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const command = parseVoiceCommand(transcript);
                    executeCommand(command);
                  }}
                  className="flex-1 rounded-full bg-primary py-2 text-sm font-medium text-primary-foreground"
                >
                  {commandDisplay ? 'Execute' : 'Search'}
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop when showing transcript */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </>
  );
}
