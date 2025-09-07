import React, { useState, useRef, useEffect } from "react";
import "./FrequencyCaptureModal.css";

const FrequencyCaptureModal = ({
  isOpen,
  note,
  onClose,
  onCaptureComplete,
  analyser,
  audioContext,
  dataArray,
  timeData,
  currentFrequency,
  setCurrentFrequency,
  noiseReducer,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [soundDetected, setSoundDetected] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [capturedFrequency, setCapturedFrequency] = useState(null);
  const captureFrequenciesRef = useRef([]);

  const CAPTURE_DURATION_MS = 8000; // 8 seconds - easily configurable

  // Autocorrelation frequency detection
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

  // Start capture when modal opens
  useEffect(() => {
    if (!isOpen || !analyser || !audioContext || !dataArray || !timeData)
      return;

    setIsCapturing(true);
    setCaptureProgress(0);
    setCapturedFrequency(null);
    captureFrequenciesRef.current = [];

    const startTime = performance.now();

    const sample = () => {
      if (!analyser || !audioContext || !dataArray || !timeData) return;

      analyser.getByteFrequencyData(dataArray);
      analyser.getFloatTimeDomainData(timeData);

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

      const hasSignal = maxValue > 20 && totalEnergy > 500;
      setSoundDetected(hasSignal);

      if (hasSignal) {
        const autocorrFreq = detectFundamentalFrequency(
          timeData,
          audioContext.sampleRate
        );
        const fftFreq = (maxIndex * audioContext.sampleRate) / analyser.fftSize;

        let finalFreq;
        if (autocorrFreq > 0 && autocorrFreq < 2000) {
          finalFreq = autocorrFreq * 0.7 + fftFreq * 0.3;
        } else {
          finalFreq = fftFreq;
        }

        if (finalFreq >= 200 && finalFreq <= 2000) {
          captureFrequenciesRef.current.push(finalFreq);
        }
      }

      const elapsed = performance.now() - startTime;
      setCaptureProgress(
        Math.min(100, Math.round((elapsed / CAPTURE_DURATION_MS) * 100))
      );

      if (elapsed < CAPTURE_DURATION_MS) {
        requestAnimationFrame(sample);
      } else {
        finalizeCapture();
      }
    };

    requestAnimationFrame(sample);
  }, [isOpen, analyser, audioContext, dataArray, timeData]);

  const finalizeCapture = () => {
    setIsCapturing(false);
    const samples = captureFrequenciesRef.current;

    if (!samples || samples.length === 0) {
      setCapturedFrequency(null);
      return; // keep modal open to let user retry/close
    }

    // Build histogram with adaptive bin size (approx 15 Hz or 4% of median)
    const median = samples.slice().sort((a, b) => a - b)[
      Math.floor(samples.length / 2)
    ];
    const binSize = Math.max(10, Math.min(25, median * 0.04));
    const bins = new Map();

    for (const f of samples) {
      const binKey = Math.round(f / binSize);
      const arr = bins.get(binKey) || [];
      arr.push(f);
      bins.set(binKey, arr);
    }

    // Find densest bin and compute robust center
    let bestBin = null;
    for (const [key, arr] of bins.entries()) {
      if (!bestBin || arr.length > bestBin.length) bestBin = arr;
    }

    const sortedBest = bestBin.slice().sort((a, b) => a - b);
    const center = sortedBest[Math.floor(sortedBest.length / 2)];
    const robustMean = Math.round(center);

    // Show captured frequency in modal
    setCapturedFrequency(robustMean);

    // Notify parent component with the captured frequency
    if (onCaptureComplete) {
      onCaptureComplete(note, robustMean);
    }
  };

  const handleClose = () => {
    setIsCapturing(false);
    setCaptureProgress(0);
    setSoundDetected(false);
    setCapturedFrequency(null);
    captureFrequenciesRef.current = [];
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Capturing {note} frequency</h3>
        </div>
        <div className="modal-body">
          <div className={`breathing-icon ${soundDetected ? "active" : ""}`} />
          <div className="capture-info">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: captureProgress + "%" }}
              />
            </div>
            <div className="capture-stats">
              <span>Listening {captureProgress}%</span>
              <span>
                Live: {currentFrequency > 0 ? `${currentFrequency} Hz` : "--"}
              </span>
            </div>
            {noiseReducer && (
              <div className="noise-status-capture">
                {!noiseReducer.noiseProfileReady ? (
                  <span className="noise-learning-small">
                    🎵 Learning noise...
                  </span>
                ) : (
                  <span className="noise-ready-small">
                    ✅ Noise reduction active
                  </span>
                )}
              </div>
            )}
            {capturedFrequency && (
              <div className="capture-result">
                <div className="result-label">Captured Frequency:</div>
                <div className="result-value">{capturedFrequency} Hz</div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="secondary-btn"
            onClick={handleClose}
            disabled={isCapturing}
          >
            {isCapturing ? "Listening..." : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrequencyCaptureModal;
