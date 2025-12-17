import { useCallback, useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneIcon, PhoneOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { VolumeWaveform } from "@/components/ui/volume-waveform";
import { LiveWaveform } from "@/components/ui/live-waveform";

const DEFAULT_AGENT = {
  agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID,
  name: "Villion AI",
  description:
    "Welcome to Villion AI. Press the button to start a conversation",
};

export default function Page() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const conversation = useConversation({
    onConnect: () => console.log("Connected"),
    onDisconnect: () => console.log("Disconnected"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => {
      console.error("Error:", error);
      setIsConnecting(false);
    },
  });

  // Track conversation status - the hook exposes 'status' property
  const conversationStatus = conversation.status;

  // Sync connecting state based on conversation status
  useEffect(() => {
    if (conversationStatus === "connected") {
      setIsConnecting(false);
    }
  }, [conversationStatus]);

  const startConversation = useCallback(async () => {
    try {
      setErrorMessage(null);
      setIsConnecting(true);
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: DEFAULT_AGENT.agentId,
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      setIsConnecting(false);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage(
          "Please enable microphone permissions in your browser."
        );
      }
    }
  }, [conversation]);

  const handleCall = useCallback(() => {
    if (conversationStatus === "disconnected") {
      startConversation();
    } else if (conversationStatus === "connected") {
      conversation.endSession();
    }
  }, [conversationStatus, conversation, startConversation]);

  // Compute state flags
  const isCallActive = conversationStatus === "connected";
  const isDisconnected = conversationStatus === "disconnected";

  // Volume getters with normalization for smoother visualization
  const getInputVolume = useCallback(() => {
    const rawValue = conversation.getInputVolume?.() ?? 0;
    return Math.min(1.0, Math.pow(rawValue, 0.5) * 2.5);
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    const rawValue = conversation.getOutputVolume?.() ?? 0;
    return Math.min(1.0, Math.pow(rawValue, 0.5) * 1.5);
  }, [conversation]);

  // Track user speaking state based on input volume
  useEffect(() => {
    if (!isCallActive) {
      setIsUserSpeaking(false);
      return;
    }

    // Only track user speaking when agent is not speaking
    if (conversation.isSpeaking) {
      setIsUserSpeaking(false);
      return;
    }

    let animationFrameId;
    let lastVolumeCheck = 0;
    const volumeThreshold = 0.1; // Threshold to consider user as speaking
    const checkInterval = 100; // Check every 100ms

    const checkUserSpeaking = (currentTime) => {
      if (currentTime - lastVolumeCheck >= checkInterval) {
        lastVolumeCheck = currentTime;
        const volume = getInputVolume();
        setIsUserSpeaking(volume > volumeThreshold);
      }
      animationFrameId = requestAnimationFrame(checkUserSpeaking);
    };

    animationFrameId = requestAnimationFrame(checkUserSpeaking);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isCallActive, conversation.isSpeaking, getInputVolume]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center overflow-hidden p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {/* Connecting State - Bar Visualizer */}
        <AnimatePresence mode="wait">
          {isConnecting && (
            <motion.div
              key="connecting-visualizer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <BarVisualizer
                state="connecting"
                demo={true}
                barCount={24}
                minHeight={12}
                maxHeight={85}
                className="h-14 rounded-xl"
              />
              <p className="text-muted-foreground mt-3 text-center text-sm">
                <ShimmeringText text="Establishing connection..." />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content - Orb and Controls */}
        <AnimatePresence mode="wait">
          {!isConnecting && (
            <motion.div
              key="main-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex w-full flex-col items-center gap-6"
            >
              {/* Orb Visualizer */}
              <div className="relative size-48">
                <div className="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                  <div className="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]">
                    <Orb
                      className="h-full w-full"
                      volumeMode="manual"
                      getInputVolume={getInputVolume}
                      getOutputVolume={getOutputVolume}
                    />
                  </div>
                </div>
              </div>

              {/* Agent Info */}
              <div className="flex flex-col items-center gap-2">
                <h2 className="text-xl font-semibold">{DEFAULT_AGENT.name}</h2>
                <AnimatePresence mode="wait">
                  {errorMessage ? (
                    <motion.p
                      key="error"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-destructive text-center text-sm"
                    >
                      {errorMessage}
                    </motion.p>
                  ) : isDisconnected ? (
                    <motion.p
                      key="disconnected"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-muted-foreground text-sm text-center"
                    >
                      {DEFAULT_AGENT.description}
                    </motion.p>
                  ) : (
                    <motion.div
                      key="status"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full bg-green-500 transition-all duration-300"
                        )}
                      />
                      <span className="text-sm text-green-600">Connected</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Live Waveforms - Only visible when call is active */}
              <AnimatePresence>
                {isCallActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex w-full flex-col gap-4 overflow-hidden"
                  >
                    {conversation.isSpeaking ? (
                      <VolumeWaveform
                        getVolume={getOutputVolume}
                        isActive={isCallActive}
                        height={40}
                        barWidth={3}
                        barGap={2}
                        barColor="hsl(142.1 76.2% 36.3%)"
                        historySize={100}
                        updateRate={20}
                      />
                    ) : (
                      <LiveWaveform
                        active={isUserSpeaking}
                        processing={!isUserSpeaking}
                        height={80}
                        barWidth={3}
                        barGap={2}
                        mode="static"
                        fadeEdges={true}
                        barColor="gray"
                        historySize={120}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Call Button */}
              <Button
                onClick={handleCall}
                disabled={isConnecting}
                size="icon"
                variant={isCallActive ? "secondary" : "default"}
                className="h-12 w-12 rounded-full"
              >
                <AnimatePresence mode="wait">
                  {isCallActive ? (
                    <motion.div
                      key="end"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <PhoneOffIcon className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="start"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <PhoneIcon className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
