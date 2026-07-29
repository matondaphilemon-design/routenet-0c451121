import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Search, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Discovery components
import { GreetingBanner } from "@/components/discover/GreetingBanner";
import { MoodSelector } from "@/components/discover/MoodSelector";
import { AIPlaylistGenerator } from "@/components/discover/AIPlaylistGenerator";
import { DaylistSection } from "@/components/discover/DaylistSection";
import { JumpBackIn } from "@/components/discover/JumpBackIn";
import { MadeForYouSection } from "@/components/discover/MadeForYouSection";
import { QuickPicksSection } from "@/components/discover/QuickPicksSection";
import { TasteControlsSection } from "@/components/discover/TasteControlsSection";
import { GenreHubsSection } from "@/components/discover/GenreHubsSection";
import { NewEpisodesSection } from "@/components/discover/NewEpisodesSection";
import { SmartShuffleToggle } from "@/components/discover/SmartShuffleToggle";

export default function Discover() {
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood === selectedMood ? null : mood);
    if (mood !== selectedMood) {
      toast.success(`Loading ${mood} vibes...`, {
        description: "Finding the perfect tracks for your mood",
      });
    }
  };

  const handleAIGenerate = async (prompt: string) => {
    setIsGeneratingPlaylist(true);
    // Simulate AI playlist generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGeneratingPlaylist(false);
    toast.success("Playlist created!", {
      description: `"${prompt}" playlist is ready to play`,
    });
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto px-4 pb-24 pt-4">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between"
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Discover</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/search')} className="p-2">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
          <button onClick={() => navigate('/settings')} className="p-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </motion.header>

      {/* Greeting Banner */}
      <GreetingBanner />

      {/* Jump Back In - Quick resume */}
      <JumpBackIn />

      {/* Mood Selector */}
      <MoodSelector selectedMood={selectedMood} onMoodSelect={handleMoodSelect} />

      {/* AI Playlist Generator */}
      <AIPlaylistGenerator 
        onGenerate={handleAIGenerate} 
        isGenerating={isGeneratingPlaylist} 
      />

      {/* Smart Shuffle Toggle */}
      <SmartShuffleToggle />

      {/* Daylist - Time-based playlists */}
      <DaylistSection />

      {/* Made For You Section */}
      <MadeForYouSection />

      {/* Quick Picks */}
      <QuickPicksSection />

      {/* Genre Hubs */}
      <GenreHubsSection />

      {/* New Episodes */}
      <NewEpisodesSection />

      {/* Taste Controls */}
      <TasteControlsSection />

      {/* API Attribution */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-[10px] text-muted-foreground"
      >
        Personalized recommendations powered by EchoTunes AI
      </motion.p>
    </div>
  );
}
