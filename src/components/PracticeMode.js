import React from "react";
import "./PracticeMode.css";

const PracticeMode = ({
  currentPracticeNote,
  practiceFeedback,
  calibratedNotes,
  currentFrequency,
  onStartPractice,
  onNextNote,
  showSuccessAnimation,
  successProgress,
}) => {
  return (
    <div className="practice-mode">
      <h2>Practice Mode</h2>

      {!currentPracticeNote ? (
        <button onClick={onStartPractice} className="start-practice-btn">
          Start Practice
        </button>
      ) : (
        <div className="practice-session">
          <h3>Play: {currentPracticeNote}</h3>

          <div className="feedback-display">
            {showSuccessAnimation && (
              <div className="success-animation">
                <div className="tick-mark">✓</div>
                <div className="success-text">Great Job!</div>
              </div>
            )}
            {!showSuccessAnimation && practiceFeedback === "correct" && (
              <div className="feedback correct">
                <div className="correct-text">✅ Correct!</div>
                <div className="timer-meter">
                  <div className="timer-label">Hold for 3 seconds</div>
                  <div className="timer-bar">
                    <div
                      className="timer-fill"
                      style={{ width: `${successProgress}%` }}
                    />
                  </div>
                  <div className="timer-progress">
                    {Math.round(successProgress)}%
                  </div>
                </div>
              </div>
            )}
            {!showSuccessAnimation && practiceFeedback === "incorrect" && (
              <div className="feedback incorrect">❌ Incorrect</div>
            )}
          </div>

          <div className="target-info">
            <p>Target: {calibratedNotes[currentPracticeNote]} Hz</p>
            <p>Current: {currentFrequency} Hz</p>
            <p>
              Difference:{" "}
              {Math.abs(
                currentFrequency - calibratedNotes[currentPracticeNote]
              )}{" "}
              Hz
            </p>
          </div>

          <button onClick={onNextNote} className="next-note-btn">
            Next Note
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeMode;
