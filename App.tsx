import React, { useState, useRef, useCallback, useEffect } from 'react';
// Fix: Remove `LiveSession` from import as it's not an exported member from '@google/genai'.
import { GoogleGenAI, LiveServerMessage, Blob, Modality } from '@google/genai';
import type { Subtitle, CustomizationState } from './types';

// Fix: Add a local interface for `LiveSession` since it is not exported from the library.
interface LiveSession {
  sendRealtimeInput(input: { media: Blob }): void;
  close(): void;
}

// --- HELPER FUNCTIONS & CONSTANTS ---

const FONT_FAMILES = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New'];

const INITIAL_CUSTOMIZATION_STATE: CustomizationState = {
  fontSize: 24,
  color: '#FFFFFF',
  fontFamily: 'Arial',
  position: { x: 50, y: 85 }, // Center-bottom position in percentage
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- ICON COMPONENTS ---

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 12v4.001h-4V12H6.999l5.001-5.001L17.001 12H14zM12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path></svg>
);

const RecordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"></path><path d="M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20zm0-2a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path></svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-3-3h6v-6H9v6z"></path></svg>
);

// --- UI COMPONENTS ---

const UploadPlaceholder: React.FC<{ onSelectClick: () => void }> = ({ onSelectClick }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600">
      <UploadIcon className="w-24 h-24 text-gray-400 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Upload Your Video</h2>
      <p className="text-gray-400 mb-6">Select a video file to start generating subtitles.</p>
      <button onClick={onSelectClick} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors">
        Select Video
      </button>
    </div>
  );
};

interface DraggableSubtitleProps {
    subtitle: Subtitle | null;
    customization: CustomizationState;
    onPositionChange: (pos: { x: number; y: number }) => void;
    videoContainerRef: React.RefObject<HTMLDivElement>;
}

const DraggableSubtitle: React.FC<DraggableSubtitleProps> = ({ subtitle, customization, onPositionChange, videoContainerRef }) => {
    const isDragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!videoContainerRef.current) return;
        isDragging.current = true;
        const subtitleEl = e.currentTarget as HTMLDivElement;
        const subtitleRect = subtitleEl.getBoundingClientRect();
        
        offset.current = {
            x: e.clientX - subtitleRect.left,
            y: e.clientY - subtitleRect.top,
        };
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current || !videoContainerRef.current) return;
        const rect = videoContainerRef.current.getBoundingClientRect();
        let x = ((e.clientX - rect.left - offset.current.x + (rect.width * 0.5)) / rect.width) * 100;
        let y = ((e.clientY - rect.top - offset.current.y) / rect.height) * 100;

        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        onPositionChange({ x, y });
    }, [onPositionChange, videoContainerRef]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    if (!subtitle) return null;

    const subtitleStyle: React.CSSProperties = {
        fontSize: `${customization.fontSize}px`,
        color: customization.color,
        fontFamily: customization.fontFamily,
        left: `${customization.position.x}%`,
        top: `${customization.position.y}%`,
        transform: 'translate(-50%, 0)',
        backgroundColor: customization.backgroundColor,
        padding: '0.2em 0.5em',
        borderRadius: '5px',
        textShadow: '1px 1px 2px black',
    };

    return (
        <div 
            onMouseDown={handleMouseDown} 
            className="absolute cursor-move select-none text-center"
            style={subtitleStyle}
        >
            {subtitle.text}
        </div>
    );
};

interface CustomizationPanelProps {
    customization: CustomizationState;
    onUpdate: (newState: Partial<CustomizationState>) => void;
}

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ customization, onUpdate }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg space-y-4">
            <h3 className="text-xl font-bold border-b border-gray-600 pb-2">Customize Subtitles</h3>
            <div>
                <label htmlFor="font-size" className="block text-sm font-medium text-gray-300">Font Size: {customization.fontSize}px</label>
                <input id="font-size" type="range" min="12" max="72" value={customization.fontSize} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
                <label htmlFor="font-color" className="block text-sm font-medium text-gray-300">Font Color</label>
                <input id="font-color" type="color" value={customization.color} onChange={(e) => onUpdate({ color: e.target.value })} className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer" />
            </div>
             <div>
                <label htmlFor="bg-color" className="block text-sm font-medium text-gray-300">Background Color</label>
                <input id="bg-color" type="color" value={customization.backgroundColor} onChange={(e) => onUpdate({ backgroundColor: e.target.value })} className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer" />
            </div>
            <div>
                <label htmlFor="font-family" className="block text-sm font-medium text-gray-300">Font Family</label>
                <select id="font-family" value={customization.fontFamily} onChange={(e) => onUpdate({ fontFamily: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {FONT_FAMILES.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
            </div>
        </div>
    );
};

interface SubtitleListProps {
  subtitles: Subtitle[];
  onUpdate: (id: number, text: string) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number;
}
const SubtitleList: React.FC<SubtitleListProps> = ({ subtitles, onUpdate, videoRef, currentTime }) => {
    const activeSubtitleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        activeSubtitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [currentTime]);

    const handleSeek = (time: number) => {
        if(videoRef.current) {
            videoRef.current.currentTime = time;
        }
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg flex-grow overflow-y-auto">
            <h3 className="text-xl font-bold border-b border-gray-600 pb-2 mb-2">Generated Subtitles</h3>
            <div className="space-y-2">
                {subtitles.map(sub => {
                    const isActive = currentTime >= sub.startTime && currentTime < sub.endTime;
                    return (
                        <div key={sub.id} ref={isActive ? activeSubtitleRef : null} className={`p-2 rounded-md ${isActive ? 'bg-indigo-600/50' : 'bg-gray-700'}`}>
                            <div className="text-xs text-gray-400 cursor-pointer" onClick={() => handleSeek(sub.startTime)}>
                                {new Date(sub.startTime * 1000).toISOString().substr(14, 5)} - {new Date(sub.endTime * 1000).toISOString().substr(14, 5)}
                            </div>
                            <textarea
                                value={sub.text}
                                onChange={(e) => onUpdate(sub.id, e.target.value)}
                                className="w-full bg-transparent text-white border-0 focus:ring-0 resize-none p-0"
                                rows={2}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [customization, setCustomization] = useState<CustomizationState>(INITIAL_CUSTOMIZATION_STATE);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready to generate subtitles.");
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentTranscription = useRef('');
  const utteranceStartTime = useRef<number | null>(null);
  const videoUrlRef = useRef(videoUrl);
  videoUrlRef.current = videoUrl;

  const activeSubtitle = subtitles.find(s => currentTime >= s.startTime && currentTime < s.endTime) || null;

  const handleCustomizationUpdate = (update: Partial<CustomizationState>) => {
    setCustomization(prev => ({ ...prev, ...update }));
  };

  const handleSubtitleTextUpdate = (id: number, text: string) => {
    setSubtitles(subs => subs.map(s => s.id === id ? { ...s, text } : s));
  };
  
  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;
    setIsRecording(false);
    setStatus("Ready to generate subtitles.");
    videoRef.current?.pause();
  }, []);

  const handleVideoSelected = (file: File) => {
    cleanup();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setSubtitles([]);
    setCurrentTime(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
    setStatus("Ready to generate subtitles.");
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleVideoSelected(file);
    }
    if(e.target) e.target.value = '';
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      cleanup();
      return;
    }

    if (!process.env.API_KEY) {
        setStatus("Error: API_KEY environment variable not set.");
        return;
    }

    try {
        setStatus("Initializing...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                inputAudioTranscription: {},
                responseModalities: [Modality.AUDIO],
            },
            callbacks: {
                onopen: async () => {
                    setStatus("Connecting to microphone...");
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaStreamRef.current = stream;

                    const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    audioContextRef.current = context;
                    
                    const source = context.createMediaStreamSource(stream);
                    const processor = context.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = processor;

                    processor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };

                    source.connect(processor);
                    processor.connect(context.destination);
                    
                    setIsRecording(true);
                    setStatus("Recording... Speak to create subtitles.");
                    videoRef.current?.play();
                },
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const { text } = message.serverContent.inputTranscription;
                        if (currentTranscription.current === '' && videoRef.current) {
                            utteranceStartTime.current = videoRef.current.currentTime;
                        }
                        currentTranscription.current += text;
                    }

                    if (message.serverContent?.turnComplete) {
                        if (currentTranscription.current.trim() && videoRef.current) {
                            const newSubtitle: Subtitle = {
                                id: Date.now(),
                                text: currentTranscription.current.trim(),
                                startTime: utteranceStartTime.current ?? videoRef.current.currentTime,
                                endTime: videoRef.current.currentTime,
                            };
                            setSubtitles(prev => [...prev, newSubtitle].sort((a,b) => a.startTime - b.startTime));
                        }
                        currentTranscription.current = '';
                        utteranceStartTime.current = null;
                    }
                },
                onerror: (e) => {
                    console.error("Gemini API Error:", e);
                    setStatus(`Error: ${e.type}. Please try again.`);
                    cleanup();
                },
                onclose: () => {
                    cleanup();
                },
            },
        });
        await sessionPromiseRef.current;
    } catch (error) {
        console.error("Failed to start recording:", error);
        setStatus(`Error: ${(error as Error).message}`);
        cleanup();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const handleTimeUpdate = () => {
      if(video) setCurrentTime(video.currentTime);
    };
    video?.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
        video?.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      cleanup();
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
    };
  }, [cleanup]);

  return (
    <div className="h-screen w-screen flex flex-col p-4 bg-gray-900 gap-4">
       <input 
        type="file" 
        accept="video/*" 
        ref={fileInputRef} 
        onChange={onFileInputChange} 
        className="hidden" 
      />
      <header className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-center text-indigo-400">AI Video Subtitle Generator</h1>
      </header>
      <main className="flex-grow flex flex-col md:flex-row gap-4 min-h-0">
        <div className="flex-grow flex flex-col gap-4 w-full md:w-2/3">
            <div ref={videoContainerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                {videoUrl ? (
                    <>
                        <video ref={videoRef} src={videoUrl} controls className="w-full h-full" />
                        <DraggableSubtitle 
                            subtitle={activeSubtitle} 
                            customization={customization} 
                            onPositionChange={(pos) => handleCustomizationUpdate({ position: pos })}
                            videoContainerRef={videoContainerRef}
                        />
                    </>
                ) : (
                    <UploadPlaceholder onSelectClick={() => fileInputRef.current?.click()} />
                )}
            </div>
            {videoUrl && (
                <div className="flex-shrink-0 bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                    <p className="text-gray-300">{status}</p>
                    <div className="flex items-center gap-4">
                      <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                         <UploadIcon className="w-5 h-5" />
                         Change Video
                      </button>
                      <button onClick={handleToggleRecording} className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                         {isRecording ? <StopIcon className="w-6 h-6" /> : <RecordIcon className="w-6 h-6" />}
                         {isRecording ? 'Stop Generating' : 'Start Generating'}
                      </button>
                    </div>
                </div>
            )}
        </div>
        {videoUrl && (
            <aside className="w-full md:w-1/3 flex flex-col gap-4 min-h-0">
                <CustomizationPanel customization={customization} onUpdate={handleCustomizationUpdate} />
                <SubtitleList 
                  subtitles={subtitles} 
                  onUpdate={handleSubtitleTextUpdate} 
                  videoRef={videoRef} 
                  currentTime={currentTime}
                />
            </aside>
        )}
      </main>
    </div>
  );
}
