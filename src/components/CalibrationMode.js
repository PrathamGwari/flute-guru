import React from "react";
import "./CalibrationMode.css";

const CalibrationMode = ({
  notes,
  calibratedNotes,
  onCaptureFrequency,
  onUseDefaultFrequencies,
  isCalibrationComplete,
}) => {
  return (
    <div className="calibration-mode">
      <h2>Calibration Mode</h2>
      <p>Play each note and capture its frequency</p>

      <div className="calibration-actions">
        <button onClick={onUseDefaultFrequencies} className="default-freq-btn">
          Use Default Frequencies
        </button>
      </div>

      <div className="notes-grid">
        {notes.map((note) => (
          <div key={note} className="note-item">
            <span className="note-name">{note}</span>
            <span className="note-frequency">
              {calibratedNotes[note]
                ? `${calibratedNotes[note]} Hz`
                : "Not set"}
            </span>
            <button
              onClick={() => onCaptureFrequency(note)}
              className="capture-btn"
            >
              Capture Frequency
            </button>
          </div>
        ))}
      </div>

      {isCalibrationComplete && (
        <div className="calibration-complete">
          <h3>✅ Calibration Complete!</h3>
          <p>
            All notes have been calibrated. You can now switch to Practice Mode.
          </p>
        </div>
      )}
    </div>
  );
};

export default CalibrationMode;
