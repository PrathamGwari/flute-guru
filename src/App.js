import React, { useState, useEffect } from "react";
import "./App.css";
import CalibrationMode from "./components/CalibrationMode";
import PracticeMode from "./components/PracticeMode";
import MusicSheetMode from "./components/MusicSheetMode";
import FrequencyCaptureModal from "./components/FrequencyCaptureModal";
import { NoiseReducer } from "./utils/noiseReduction";

function App() {
  const [mode, setMode] = useState("calibration"); // 'calibration', 'practice', or 'musicSheet'
  const [currentFrequency, setCurrentFrequency] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [calibratedNotes, setCalibratedNotes] = useState({});
  const [currentPracticeNote, setCurrentPracticeNote] = useState("");
  const [practiceFeedback, setPracticeFeedback] = useState("");
  const [successTimer, setSuccessTimer] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successProgress, setSuccessProgress] = useState(0);
  const [progressInterval, setProgressInterval] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [microphone, setMicrophone] = useState(null);
  const [dataArray, setDataArray] = useState(null);
  const [timeData, setTimeData] = useState(null);
  const [animationId, setAnimationId] = useState(null);
  const [noiseReducer, setNoiseReducer] = useState(null);
  const [noiseProfileReady, setNoiseProfileReady] = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [frequencyResetTimer, setFrequencyResetTimer] = useState(null);

  // Music Sheet state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [currentPlaybackNote, setCurrentPlaybackNote] = useState("");
  const [playbackFeedback, setPlaybackFeedback] = useState("");
  const [playbackInterval, setPlaybackInterval] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);

  // Modal state
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureNote, setCaptureNote] = useState("");

  const notes = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa2"];

  // Initialize audio context and microphone
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 44100,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const audioCtx = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyserNode = audioCtx.createAnalyser();
        const microphoneNode = audioCtx.createMediaStreamSource(stream);

        // Create advanced noise reduction processor
        const noiseReducerInstance = new NoiseReducer(
          4096,
          audioCtx.sampleRate
        );
        setNoiseReducer(noiseReducerInstance);

        const noiseReductionProcessor = audioCtx.createScriptProcessor(
          4096,
          1,
          1
        );

        noiseReductionProcessor.onaudioprocess = function (
          audioProcessingEvent
        ) {
          const inputBuffer = audioProcessingEvent.inputBuffer;
          const outputBuffer = audioProcessingEvent.outputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          const outputData = outputBuffer.getChannelData(0);

          // Apply advanced noise reduction
          const cleanedData = noiseReducerInstance.process(inputData);

          // Copy cleaned data to output
          for (let i = 0; i < outputData.length; i++) {
            outputData[i] = cleanedData[i];
          }
        };

        analyserNode.fftSize = 4096; // Increased for better resolution
        analyserNode.smoothingTimeConstant = 0.8; // Smoothing for stability
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArrayBuffer = new Uint8Array(bufferLength);
        const timeDataBuffer = new Float32Array(analyserNode.fftSize);

        // Connect audio through noise reduction processor
        microphoneNode.connect(noiseReductionProcessor);
        noiseReductionProcessor.connect(analyserNode);

        setAudioContext(audioCtx);
        setAnalyser(analyserNode);
        setMicrophone(microphoneNode);
        setDataArray(dataArrayBuffer);
        setTimeData(timeDataBuffer);
        setIsListening(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Please allow microphone access to use this app.");
      }
    };

    initAudio();

    return () => {
      if (audioContext) {
        audioContext.close();
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Improved frequency detection using autocorrelation
  const detectFundamentalFrequency = (timeData, sampleRate) => {
    const bufferLength = timeData.length;
    const correlationBuffer = new Float32Array(bufferLength);

    // Find the correlation
    for (let lag = 0; lag < bufferLength; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength - lag; i++) {
        sum += timeData[i] * timeData[i + lag];
      }
      correlationBuffer[lag] = sum;
    }

    // Find the first peak after the initial peak
    let maxCorrelation = 0;
    let maxLag = 0;

    // Skip the first 100 samples to avoid DC component
    for (let lag = 100; lag < bufferLength / 2; lag++) {
      if (correlationBuffer[lag] > maxCorrelation) {
        maxCorrelation = correlationBuffer[lag];
        maxLag = lag;
      }
    }

    if (maxLag > 0) {
      return sampleRate / maxLag;
    }

    return 0;
  };

  // Enhanced frequency detection with multiple methods
  const detectFrequency = () => {
    if (!analyser || !dataArray || !timeData || !audioContext) return;

    analyser.getByteFrequencyData(dataArray);
    analyser.getFloatTimeDomainData(timeData);

    // Method 1: Improved peak detection from frequency domain
    let maxValue = 0;
    let maxIndex = 0;
    let totalEnergy = 0;

    for (let i = 0; i < dataArray.length; i++) {
      totalEnergy += dataArray[i];
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }

    // Update noise level for monitoring
    setNoiseLevel(Math.round((maxValue / 255) * 100));

    // Only process if we have sufficient signal (reduced thresholds due to noise reduction)
    if (maxValue > 20 && totalEnergy > 500) {
      // Clear any pending frequency reset
      if (frequencyResetTimer) {
        clearTimeout(frequencyResetTimer);
        setFrequencyResetTimer(null);
      }

      // Method 2: Autocorrelation on time domain data
      const autocorrFreq = detectFundamentalFrequency(
        timeData,
        audioContext.sampleRate
      );

      // Method 3: Peak frequency from FFT
      const fftFreq = (maxIndex * audioContext.sampleRate) / analyser.fftSize;

      // Combine both methods for better accuracy
      let finalFreq;
      if (autocorrFreq > 0 && autocorrFreq < 2000) {
        // Reasonable range for flute
        // Weight autocorrelation more heavily as it's better for fundamental detection
        finalFreq = autocorrFreq * 0.7 + fftFreq * 0.3;
      } else {
        finalFreq = fftFreq;
      }

      // Apply smoothing and range filtering
      if (finalFreq >= 200 && finalFreq <= 2000) {
        // Typical flute range
        setCurrentFrequency(Math.round(finalFreq));
      }
    } else {
      // No sufficient signal - set up delayed reset to prevent flickering
      if (!frequencyResetTimer) {
        const timer = setTimeout(() => {
          setCurrentFrequency(0);
          setFrequencyResetTimer(null);
        }, 200); // 200ms delay before resetting
        setFrequencyResetTimer(timer);
      }
    }

    setAnimationId(requestAnimationFrame(detectFrequency));
  };

  // Frequency detection loop
  useEffect(() => {
    if (!analyser || !dataArray || !timeData || !isListening) return;

    detectFrequency();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [analyser, dataArray, timeData, isListening]);

  // Handle frequency capture completion
  const handleCaptureComplete = (note, frequency) => {
    console.log(`Captured frequency for ${note}: ${frequency} Hz`);
    setCalibratedNotes((prev) => ({
      ...prev,
      [note]: frequency,
    }));
    // Close modal after a short delay to show the result
    setTimeout(() => {
      setIsCaptureOpen(false);
      setCaptureNote("");
    }, 1000);
  };

  // Default frequencies from your calibration
  const defaultFrequencies = {
    Sa: 330,
    Re: 376,
    Ga: 421,
    Ma: 427,
    Pa: 395,
    Dha: 389,
    Ni: 435,
    Sa2: 316,
  };

  // Use default frequencies
  const useDefaultFrequencies = () => {
    setCalibratedNotes(defaultFrequencies);
  };

  // Open capture modal
  const openCaptureModal = (note) => {
    if (!analyser || !audioContext || !dataArray || !timeData) {
      alert("Audio system not ready. Please wait a moment and try again.");
      return;
    }
    setCaptureNote(note);
    setIsCaptureOpen(true);
  };

  // Check if all notes are calibrated
  const isCalibrationComplete = () => {
    return notes.every((note) => calibratedNotes[note]);
  };

  // Start practice mode
  const startPractice = () => {
    if (isCalibrationComplete()) {
      setMode("practice");
      setCurrentPracticeNote("");
      setPracticeFeedback("");
    } else {
      alert("Please complete calibration first!");
    }
  };

  // Get random practice note
  const getRandomNote = () => {
    // Clear any existing success timer and progress interval
    if (successTimer) {
      clearTimeout(successTimer);
      setSuccessTimer(null);
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    if (frequencyResetTimer) {
      clearTimeout(frequencyResetTimer);
      setFrequencyResetTimer(null);
    }

    const availableNotes = notes.filter((note) => calibratedNotes[note]);
    const randomNote =
      availableNotes[Math.floor(Math.random() * availableNotes.length)];
    setCurrentPracticeNote(randomNote);
    setPracticeFeedback("");
    setShowSuccessAnimation(false);
    setSuccessProgress(0);
    setCurrentFrequency(0); // Reset frequency when starting new note
  };

  // Check practice note with improved tolerance and 3-second success detection
  useEffect(() => {
    if (mode === "practice" && currentPracticeNote && currentFrequency > 0) {
      const targetFreq = calibratedNotes[currentPracticeNote];
      const tolerance = targetFreq * 0.03; // Reduced to 3% tolerance for more precise detection

      if (Math.abs(currentFrequency - targetFreq) <= tolerance) {
        setPracticeFeedback("correct");

        // Start 3-second success timer with progress tracking
        if (!successTimer) {
          const startTime = Date.now();
          const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, (elapsed / 3000) * 100);
            setSuccessProgress(progress);
          }, 50); // Update every 50ms for smooth animation

          setProgressInterval(interval);

          const timer = setTimeout(() => {
            clearInterval(interval);
            setProgressInterval(null);
            setShowSuccessAnimation(true);
            setSuccessProgress(100);
            // Auto-advance to next note after animation
            setTimeout(() => {
              getRandomNote();
              setShowSuccessAnimation(false);
              setSuccessTimer(null);
              setSuccessProgress(0);
            }, 2000); // Show animation for 2 seconds
          }, 3000); // 3 seconds of correct playing

          setSuccessTimer(timer);
        }
      } else {
        setPracticeFeedback("incorrect");
        setSuccessProgress(0);
        // Clear success timer and progress interval if note becomes incorrect
        if (successTimer) {
          clearTimeout(successTimer);
          setSuccessTimer(null);
        }
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
      }
    }
  }, [
    currentFrequency,
    currentPracticeNote,
    calibratedNotes,
    mode,
    successTimer,
  ]);

  // Monitor noise profile status
  useEffect(() => {
    if (noiseReducer) {
      const checkNoiseProfile = () => {
        if (noiseReducer.noiseProfileReady !== noiseProfileReady) {
          setNoiseProfileReady(noiseReducer.noiseProfileReady);
        }
      };

      const interval = setInterval(checkNoiseProfile, 1000);
      return () => clearInterval(interval);
    }
  }, [noiseReducer, noiseProfileReady]);

  // Clean up timer on unmount or mode change
  useEffect(() => {
    return () => {
      if (successTimer) {
        clearTimeout(successTimer);
      }
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (frequencyResetTimer) {
        clearTimeout(frequencyResetTimer);
      }
    };
  }, [successTimer, progressInterval, frequencyResetTimer]);

  // Next note in practice mode
  const nextNote = () => {
    getRandomNote();
  };

  // Get note from frequency using calibrated notes
  const getNoteFromCalibratedFrequency = (freq) => {
    if (
      !calibratedNotes ||
      Object.keys(calibratedNotes).length === 0 ||
      freq === 0
    )
      return null;

    const tolerance = 0.05; // 5% tolerance
    for (const [note, calibratedFreq] of Object.entries(calibratedNotes)) {
      if (Math.abs(freq - calibratedFreq) <= calibratedFreq * tolerance) {
        return note;
      }
    }
    return null;
  };

  // Start recording music sheet
  const startRecording = () => {
    setIsRecording(true);
    setRecordedData([]);
    setRecordingStartTime(Date.now());
  };

  // Stop recording music sheet
  const stopRecording = () => {
    setIsRecording(false);
    setRecordingStartTime(null);
  };

  // Start playing recorded music sheet
  const startPlayback = () => {
    if (recordedData.length === 0) return;

    setIsPlaying(true);
    setCurrentPlaybackTime(0);
    setCurrentPlaybackNote("");
    setPlaybackFeedback("waiting");

    // Start playback timer
    const interval = setInterval(() => {
      setCurrentPlaybackTime((prev) => {
        const newTime = prev + 1;

        // Find current note for this second
        const currentEntry = recordedData.find(
          (entry) => entry.time === newTime
        );
        if (currentEntry) {
          setCurrentPlaybackNote(currentEntry.note);
        } else {
          setCurrentPlaybackNote("");
        }

        // Check if playback is complete
        if (newTime >= recordedData.length) {
          setIsPlaying(false);
          setCurrentPlaybackNote("");
          setPlaybackFeedback("");
          clearInterval(interval);
          setPlaybackInterval(null);
        }

        return newTime;
      });
    }, 1000);

    setPlaybackInterval(interval);
  };

  // Stop playing recorded music sheet
  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentPlaybackTime(0);
    setCurrentPlaybackNote("");
    setPlaybackFeedback("");
    if (playbackInterval) {
      clearInterval(playbackInterval);
      setPlaybackInterval(null);
    }
  };

  // Record note data during recording
  useEffect(() => {
    if (isRecording && currentFrequency > 0) {
      const detectedNote = getNoteFromCalibratedFrequency(currentFrequency);
      const currentTime =
        Math.floor((Date.now() - recordingStartTime) / 1000) + 1;

      setRecordedData((prev) => {
        const newData = [...prev];
        const existingEntryIndex = newData.findIndex(
          (entry) => entry.time === currentTime
        );

        if (detectedNote) {
          const entry = {
            time: currentTime,
            note: detectedNote,
            frequency: currentFrequency,
          };

          if (existingEntryIndex >= 0) {
            newData[existingEntryIndex] = entry;
          } else {
            newData.push(entry);
          }
        }

        return newData;
      });
    }
  }, [isRecording, currentFrequency, recordingStartTime, calibratedNotes]);

  // Check playback feedback during practice
  useEffect(() => {
    if (isPlaying && currentPlaybackNote && currentFrequency > 0) {
      const detectedNote = getNoteFromCalibratedFrequency(currentFrequency);
      if (detectedNote === currentPlaybackNote) {
        setPlaybackFeedback("correct");
      } else {
        setPlaybackFeedback("incorrect");
      }
    } else if (isPlaying && currentPlaybackNote && currentFrequency === 0) {
      setPlaybackFeedback("waiting");
    }
  }, [isPlaying, currentPlaybackNote, currentFrequency, calibratedNotes]);

  // Clean up playback interval on unmount
  useEffect(() => {
    return () => {
      if (playbackInterval) {
        clearInterval(playbackInterval);
      }
    };
  }, [playbackInterval]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Flute Practice App</h1>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={mode === "calibration" ? "active" : ""}
            onClick={() => setMode("calibration")}
          >
            Calibration Mode
          </button>
          <button
            className={mode === "practice" ? "active" : ""}
            onClick={() => startPractice()}
          >
            Practice Mode
          </button>
          <button
            className={mode === "musicSheet" ? "active" : ""}
            onClick={() => setMode("musicSheet")}
          >
            Generate Music Sheet
          </button>
        </div>

        {/* Current Frequency Display */}
        <div className="frequency-display">
          <h2>Current Frequency</h2>
          <div className="frequency-value">{currentFrequency} Hz</div>
          <div className="frequency-note">
            {currentFrequency > 0 && (
              <span>
                Detected Note: {getNoteFromFrequency(currentFrequency)}
              </span>
            )}
          </div>
          {noiseReducer && (
            <div className="noise-reduction-status">
              {!noiseProfileReady ? (
                <span className="noise-learning">
                  🎵 Learning noise profile...
                </span>
              ) : (
                <span className="noise-ready">✅ Noise reduction active</span>
              )}
              <div className="noise-level">Signal Level: {noiseLevel}%</div>
            </div>
          )}
        </div>

        {/* Calibration Mode */}
        {mode === "calibration" && (
          <CalibrationMode
            notes={notes}
            calibratedNotes={calibratedNotes}
            onCaptureFrequency={openCaptureModal}
            onUseDefaultFrequencies={useDefaultFrequencies}
            isCalibrationComplete={isCalibrationComplete()}
          />
        )}

        {/* Practice Mode */}
        {mode === "practice" && (
          <PracticeMode
            currentPracticeNote={currentPracticeNote}
            practiceFeedback={practiceFeedback}
            calibratedNotes={calibratedNotes}
            currentFrequency={currentFrequency}
            onStartPractice={getRandomNote}
            onNextNote={nextNote}
            showSuccessAnimation={showSuccessAnimation}
            successProgress={successProgress}
          />
        )}

        {/* Music Sheet Mode */}
        {mode === "musicSheet" && (
          <MusicSheetMode
            calibratedNotes={calibratedNotes}
            currentFrequency={currentFrequency}
            isListening={isListening}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onPlayRecording={startPlayback}
            onStopPlayback={stopPlayback}
            isRecording={isRecording}
            isPlaying={isPlaying}
            recordedData={recordedData}
            currentPlaybackTime={currentPlaybackTime}
            currentPlaybackNote={currentPlaybackNote}
            playbackFeedback={playbackFeedback}
          />
        )}
      </header>

      {/* Frequency Capture Modal */}
      <FrequencyCaptureModal
        isOpen={isCaptureOpen}
        note={captureNote}
        onClose={() => {
          setIsCaptureOpen(false);
          setCaptureNote("");
        }}
        onCaptureComplete={handleCaptureComplete}
        analyser={analyser}
        audioContext={audioContext}
        dataArray={dataArray}
        timeData={timeData}
        currentFrequency={currentFrequency}
        setCurrentFrequency={setCurrentFrequency}
        noiseReducer={noiseReducer}
      />
    </div>
  );
}

// Helper function to get approximate note name from frequency
function getNoteFromFrequency(freq) {
  if (freq < 200) return "Too Low";
  if (freq > 2000) return "Too High";

  // Rough mapping for reference (not exact)
  if (freq >= 200 && freq < 250) return "Low Sa";
  if (freq >= 250 && freq < 300) return "Re";
  if (freq >= 300 && freq < 350) return "Ga";
  if (freq >= 350 && freq < 400) return "Ma";
  if (freq >= 400 && freq < 450) return "Pa";
  if (freq >= 450 && freq < 500) return "Dha";
  if (freq >= 500 && freq < 550) return "Ni";
  if (freq >= 550 && freq < 600) return "Sa";
  if (freq >= 600 && freq < 700) return "High Re";
  if (freq >= 700 && freq < 800) return "High Ga";
  if (freq >= 800 && freq < 900) return "High Ma";
  if (freq >= 900 && freq < 1000) return "High Pa";
  if (freq >= 1000 && freq < 1100) return "High Dha";
  if (freq >= 1100 && freq < 1200) return "High Ni";
  if (freq >= 1200 && freq < 1300) return "High Sa";

  return "Unknown";
}

export default App;
