import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [status, setStatus] = useState("Connecting...");
  const [transcript, setTranscript] = useState([]);
  const [finalNotes, setFinalNotes] = useState(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000");

    ws.onopen = () => {
      setStatus("Connected to live meeting server");
      ws.send(JSON.stringify({ type: "DASHBOARD_CONNECTED" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "TRANSCRIPT_UPDATE") {
        setTranscript((prev) => [...prev, data.payload]);
      }

      if (data.type === "FINAL_NOTES") {
        setFinalNotes(data.payload);
      }
    };

    ws.onerror = () => {
      setStatus("Connection error");
    };

    ws.onclose = () => {
      setStatus("Disconnected");
    };

    return () => ws.close();
  }, []);

  return (
    <main className="app">
      <section className="hero">
        <h1>MeetMind AI</h1>
        <p>{status}</p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Live Transcript</h2>

          {transcript.length === 0 ? (
            <p className="muted">Waiting for meeting audio...</p>
          ) : (
            transcript.map((item, index) => (
              <p key={index}>
                <strong>{new Date(item.timestamp).toLocaleTimeString()}:</strong>{" "}
                {item.text}
              </p>
            ))
          )}
        </div>

        <div className="card">
          <h2>AI Notes</h2>

          {finalNotes ? (
            <>
              <h3>Summary</h3>
              <p>{finalNotes.summary}</p>

              <h3>Action Items</h3>
              <ul>
                {finalNotes.actionItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Notes will appear during/after the meeting.</p>
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);