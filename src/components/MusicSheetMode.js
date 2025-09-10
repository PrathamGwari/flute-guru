import React, { useState, useEffect, useRef } from "react";
import "./MusicSheetMode.css";

const MusicSheetMode = ({
  calibratedNotes,
  currentFrequency,
  isListening,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onStopPlayback,
  isRecording,
  isPlaying,
  recordedData,
  currentPlaybackTime,
  currentPlaybackNote,
  playbackFeedback,
}) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [hasRecordedData, setHasRecordedData] = useState(false);

  // Update recording duration
  useEffect(() => {
    let interval;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        setRecordingDuration(
          Math.floor((Date.now() - recordingStartTime) / 1000)
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // Check if we have recorded data
  useEffect(() => {
    setHasRecordedData(recordedData && recordedData.length > 0);
  }, [recordedData]);

  const handleStartRecording = () => {
    setRecordingDuration(0);
    setRecordingStartTime(Date.now());
    setHasRecordedData(false);
    onStartRecording();
  };

  const handleStopRecording = () => {
    setRecordingStartTime(null);
    onStopRecording();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getNoteFromFrequency = (freq) => {
    if (!calibratedNotes || freq === 0) return null;

    const tolerance = 0.05; // 5% tolerance
    for (const [note, calibratedFreq] of Object.entries(calibratedNotes)) {
      if (Math.abs(freq - calibratedFreq) <= calibratedFreq * tolerance) {
        return note;
      }
    }
    return null;
  };

  const downloadJSON = () => {
    if (!hasRecordedData) return;

    const dataStr = JSON.stringify(recordedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `music-sheet-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="music-sheet-mode">
      <h2>Generate Music Sheet</h2>
      <p>Record your flute playing to create a practice sheet</p>

      {/* Recording Controls */}
      <div className="recording-controls">
        {!isRecording && !isPlaying && (
          <div className="recording-section">
            <button
              onClick={handleStartRecording}
              className="start-recording-btn"
              disabled={!isListening}
            >
              {!isListening ? "Microphone Not Ready" : "Start Recording"}
            </button>
            <p className="recording-instructions">
              Play your flute and we'll capture the notes automatically
            </p>
          </div>
        )}

        {isRecording && (
          <div className="recording-active">
            <div className="recording-indicator">
              <div className="recording-dot"></div>
              <span>Recording...</span>
            </div>
            <div className="recording-timer">
              {formatTime(recordingDuration)}
            </div>
            <button
              onClick={handleStopRecording}
              className="stop-recording-btn"
            >
              Stop Recording
            </button>
            <div className="current-note-display">
              <span>Current Note: </span>
              <span className="current-note">
                {getNoteFromFrequency(currentFrequency) || "None"}
              </span>
            </div>
          </div>
        )}

        {hasRecordedData && !isRecording && !isPlaying && (
          <div className="recorded-data-section">
            <div className="recording-summary">
              <h3>Recording Complete!</h3>
              <p>Duration: {formatTime(recordedData.length)}</p>
              <p>
                Notes Captured:{" "}
                {recordedData.filter((entry) => entry.note).length}
              </p>
            </div>

            <div className="action-buttons">
              <button onClick={onPlayRecording} className="play-recording-btn">
                Practice This Recording
              </button>
              <button onClick={downloadJSON} className="download-json-btn">
                Download JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Playback Section */}
      {isPlaying && (
        <div className="playback-section">
          <div className="playback-header">
            <h3>Practice Mode</h3>
            <div className="playback-timer">
              {formatTime(currentPlaybackTime)}
            </div>
          </div>

          <div className="playback-feedback">
            <div className="target-note">
              <span>Target Note: </span>
              <span className="target-note-name">
                {currentPlaybackNote || "None"}
              </span>
            </div>

            <div className="playback-status">
              {playbackFeedback === "correct" && (
                <div className="feedback correct">✅ Correct!</div>
              )}
              {playbackFeedback === "incorrect" && (
                <div className="feedback incorrect">❌ Try Again</div>
              )}
              {playbackFeedback === "waiting" && (
                <div className="feedback waiting">🎵 Play the note above</div>
              )}
            </div>
          </div>

          <div className="playback-controls">
            <button onClick={onStopPlayback} className="stop-playback-btn">
              Stop Practice
            </button>
          </div>
        </div>
      )}

      {/* Calibration Status */}
      <div className="calibration-status">
        <h4>Calibration Status</h4>
        <div className="calibrated-notes">
          {Object.entries(calibratedNotes).map(([note, freq]) => (
            <span key={note} className="calibrated-note">
              {note}: {freq}Hz
            </span>
          ))}
        </div>
        {Object.keys(calibratedNotes).length === 0 && (
          <p className="no-calibration">
            Please complete calibration first to use this feature
          </p>
        )}
      </div>
    </div>
  );
};

export default MusicSheetMode;

