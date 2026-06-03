let ws = null;
let mediaRecorder = null;
let capturedStream = null;

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");

startBtn.addEventListener("click", startLiveNotes);
stopBtn.addEventListener("click", stopLiveNotes);

async function startLiveNotes() {
  try {
    statusText.textContent = "Connecting to server...";

    ws = new WebSocket("ws://localhost:5000");
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      statusText.textContent = "Capturing tab audio...";

      ws.send(
        JSON.stringify({
          type: "START_STREAM"
        })
      );

      chrome.tabCapture.capture(
        {
          audio: true,
          video: false
        },
        (stream) => {
          if (chrome.runtime.lastError || !stream) {
            statusText.textContent = "Could not capture tab audio.";
            console.error(chrome.runtime.lastError);
            return;
          }

          capturedStream = stream;

          mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm"
          });

          mediaRecorder.ondataavailable = async (event) => {
            if (
              event.data.size > 0 &&
              ws &&
              ws.readyState === WebSocket.OPEN
            ) {
              const arrayBuffer = await event.data.arrayBuffer();

              // Send real audio binary to backend
              ws.send(arrayBuffer);
            }
          };

          mediaRecorder.start(1000);

          startBtn.disabled = true;
          stopBtn.disabled = false;
          statusText.textContent = "Live notes running.";
        }
      );
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      statusText.textContent = "Server connection error.";
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };
  } catch (error) {
    console.error(error);
    statusText.textContent = "Failed to start live notes.";
  }
}

function stopLiveNotes() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (capturedStream) {
    capturedStream.getTracks().forEach((track) => track.stop());
    capturedStream = null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "STOP_MEETING"
      })
    );

    ws.close();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = "Stopped.";
}