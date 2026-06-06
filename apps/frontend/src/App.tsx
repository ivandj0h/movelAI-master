import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

type RobotState = {
  robot_id: string;
  position: {
    x: number;
    y: number;
  };
  battery_percentage: number;
  timestamp: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const VALID_COMMANDS = ["w", "a", "s", "d"] as const;

type Command = (typeof VALID_COMMANDS)[number];

function App() {
  const [robotState, setRobotState] = useState<RobotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [initialRobotState, setInitialRobotState] = useState<RobotState | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const fetchRobotState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/robot/state`);

      if (!response.ok) {
        throw new Error(`Failed to fetch robot state: ${response.status}`);
      }

      const data = (await response.json()) as RobotState;

      setRobotState(data);
      setInitialRobotState((current) => current ?? data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown API error");
    } finally {
      setLoading(false);
    }
  }, []);

  const sendCommand = useCallback(async (command: Command) => {
    try {
      setLastCommand(command.toUpperCase());
      setCommandStatus("Sending command...");

      const response = await fetch(`${API_BASE_URL}/api/robot/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error(`Command failed: ${response.status}`);
      }

      setCommandStatus(`Command ${command.toUpperCase()} sent`);
    } catch (err) {
      setCommandStatus(err instanceof Error ? err.message : "Command failed");
    }
  }, []);

  useEffect(() => {
    fetchRobotState();

    const interval = window.setInterval(() => {
      fetchRobotState();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [fetchRobotState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (VALID_COMMANDS.includes(key as Command)) {
        event.preventDefault();
        sendCommand(key as Command);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sendCommand]);

  const isStale = useMemo(() => {
    if (!robotState) {
      return true;
    }

    const lastUpdate = new Date(robotState.timestamp).getTime();
    const now = Date.now();

    return now - lastUpdate > 5000;
  }, [robotState]);

  const dotPosition = useMemo(() => {
    const x = robotState?.position.x ?? 0;
    const y = robotState?.position.y ?? 0;

    return {
      left: `${50 + Math.max(-10, Math.min(10, y)) * 4}%`,
      top: `${50 - Math.max(-10, Math.min(10, x)) * 4}%`,
    };
  }, [robotState]);

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="header">
          <div>
            <p className="eyebrow">Movel AI Assignment</p>
            <h1>ROS Robot Control Dashboard</h1>
          </div>

          <div className={`status-pill ${error || isStale ? "stale" : "connected"}`}>
            {error || isStale ? "Disconnected" : "Connected"}
          </div>
        </div>

        <div className="content-grid">
          <section className="card robot-map-card">
            <div className="card-title-row">
              <h2>Robot Position</h2>
              <span className="robot-id">{robotState?.robot_id ?? "robot-1"}</span>
            </div>

            <div className="map">
              <div className="axis horizontal" />
              <div className="axis vertical" />
              <div className={`robot-dot ${error || isStale ? "disconnected" : "connected"}`} style={dotPosition} />
            </div>

            <p className="hint">
              Press <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to move the robot.
            </p>

            <section className="debug-accordion">
              <button
                className="debug-toggle"
                type="button"
                onClick={() => setIsDebugOpen((value) => !value)}
              >
                {isDebugOpen ? "Hide" : "Show"} Position Data
              </button>

              {isDebugOpen ? (
                <div className="debug-panel">
                  <div>
                    <h3>Initial Position Data</h3>
                    <p>Robot ID: {initialRobotState?.robot_id ?? "-"}</p>
                    <p>X Position: {initialRobotState?.position.x ?? "-"}</p>
                    <p>Y Position: {initialRobotState?.position.y ?? "-"}</p>
                    <p>
                      Battery:{" "}
                      {initialRobotState
                        ? `${initialRobotState.battery_percentage}%`
                        : "-"}
                    </p>
                    <p>
                      Timestamp:{" "}
                      {initialRobotState
                        ? new Date(initialRobotState.timestamp).toLocaleString()
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <h3>Latest Position After W/A/S/D</h3>
                    <p>Last Command: {lastCommand ?? "-"}</p>
                    <p>X Position: {robotState?.position.x ?? "-"}</p>
                    <p>Y Position: {robotState?.position.y ?? "-"}</p>
                    <p>
                      Battery:{" "}
                      {robotState ? `${robotState.battery_percentage}%` : "-"}
                    </p>
                    <p>
                      Timestamp:{" "}
                      {robotState
                        ? new Date(robotState.timestamp).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          </section>

          <section className="card telemetry-card">
            <h2>Telemetry</h2>

            {loading ? (
              <p className="muted">Loading robot state...</p>
            ) : error ? (
              <p className="error">{error}</p>
            ) : robotState ? (
              <div className="telemetry-list">
                <div>
                  <span>X Position</span>
                  <strong>{robotState.position.x}</strong>
                </div>
                <div>
                  <span>Y Position</span>
                  <strong>{robotState.position.y}</strong>
                </div>
                <div>
                  <span>Battery</span>
                  <strong>{robotState.battery_percentage}%</strong>
                </div>
                <div>
                  <span>Last Update</span>
                  <strong>{new Date(robotState.timestamp).toLocaleTimeString()}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">No telemetry received yet.</p>
            )}
          </section>

          <section className="card command-card">
            <h2>Command Control</h2>

            <div className="keypad">
              <button onClick={() => sendCommand("w")}>W</button>
              <div>
                <button onClick={() => sendCommand("a")}>A</button>
                <button onClick={() => sendCommand("s")}>S</button>
                <button onClick={() => sendCommand("d")}>D</button>
              </div>
            </div>

            <p className="muted">
              Last command: <strong>{lastCommand ?? "-"}</strong>
            </p>

            {commandStatus ? <p className="command-status">{commandStatus}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
