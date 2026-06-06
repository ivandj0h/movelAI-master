# Movel AI ROS Plugin Integration

A small robot-to-cloud integration system for the Movel AI ROS Plugin Integration assignment.

This repository does **not** build the ROS simulation. The ROS simulation is provided separately by Movel AI through `docker-compose-assignment.yaml`.

This repository builds only:

1. ROS Plugin
2. Cloud Backend
3. Frontend

The goal is to demonstrate clean service boundaries, robot-to-cloud communication, Docker networking, and reliable state flow.

---

## Architecture

```text
Provided ROS Simulation
  topics:
    /pose
    /battery_percentage
    /cmd
        |
        | ROSBridge WebSocket
        v
ROS Plugin
        |
        | WebSocket
        v
Cloud Backend
        |
        | REST API
        v
Frontend
```

## Service Boundaries

- Only the ROS Plugin talks to ROS.
- The Cloud Backend does not read ROS topics directly.
- The Frontend does not connect to ROS directly.
- The Frontend only talks to the Cloud Backend.
- The ROS Plugin forwards telemetry upward and commands downward.

---

## Technology Stack

### ROS Plugin

- Python
- `roslibpy`
- `websocket-client`
- Connects to ROSBridge on port `9090`
- Subscribes to:
  - `/pose`
  - `/battery_percentage`
- Publishes to:
  - `/cmd`

### Cloud Backend

- Node.js
- TypeScript
- Express
- `ws`
- In-memory latest robot state
- REST API for frontend
- WebSocket endpoint for ROS Plugin

### Frontend

- React
- TypeScript
- Vite
- Simple robot dashboard
- Keyboard control using `W`, `A`, `S`, `D`

---

## Backend API

### `GET /health`

Returns backend health, plugin connection status, and latest telemetry timestamp.

```json
{
  "status": "ok",
  "plugin_connected": true,
  "last_telemetry_at": "2026-06-06T08:09:36.497280Z"
}
```

### `GET /api/robot/state`

Returns latest robot state.

```json
{
  "robot_id": "robot-1",
  "position": {
    "x": 1,
    "y": -1
  },
  "battery_percentage": 101,
  "timestamp": "2026-06-06T08:12:19.253069Z"
}
```

### `POST /api/robot/command`

Sends a movement command.

```json
{
  "command": "w"
}
```

Valid commands:

| Key | Direction |
| --- | --- |
| `w` | Up |
| `a` | Left |
| `s` | Down |
| `d` | Right |

---

## Environment Variables

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

Current example:

```env
BACKEND_PORT=4000
BACKEND_HOST=0.0.0.0

FRONTEND_PORT=3000
VITE_API_BASE_URL=http://localhost:4000

ROBOT_ID=robot-1
BACKEND_WS_URL=ws://127.0.0.1:4000/ws/plugin

ROSBRIDGE_HOST=127.0.0.1
ROSBRIDGE_PORT=9090
```

Note for Docker Desktop on macOS:

The provided `web-ros` container uses `network_mode: "host"`. Because of that, the ROS Plugin also runs with `network_mode: "host"` and connects to ROSBridge through `127.0.0.1:9090`.

---

## How to Run

### 1. Use Node 22

```bash
nvm use
```

### 2. Start the Provided ROS Simulation

Download the Movel AI provided compose file as:

```text
docker-compose-assignment.yaml
```

Start it:

```bash
docker compose -f docker-compose-assignment.yaml up -d
```

Check the ROS container:

```bash
docker ps --filter "name=web-ros"
```

### 3. Verify ROS Topics

List topics:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && rostopic list'
```

Check `/pose`:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && timeout 5 rostopic echo /pose || true'
```

Check `/battery_percentage`:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && timeout 5 rostopic echo /battery_percentage || true'
```

Send manual command:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && rostopic pub -1 /cmd std_msgs/String "data: '\''w'\''"'
```

### 4. Start This Project

```bash
docker compose up --build -d
```

This starts:

- `movel-backend`
- `movel-frontend`
- `movel-ros-plugin`

### 5. Check Backend Health

```bash
curl http://localhost:4000/health
```

Expected:

```json
{
  "status": "ok",
  "plugin_connected": true,
  "last_telemetry_at": "..."
}
```

### 6. Check Robot State

```bash
curl http://localhost:4000/api/robot/state
```

Expected:

```json
{
  "robot_id": "robot-1",
  "position": {
    "x": 1,
    "y": -1
  },
  "battery_percentage": 101,
  "timestamp": "..."
}
```

### 7. Open Frontend

```text
http://localhost:3000
```

The frontend shows:

- Robot position
- Battery percentage
- Connected / stale status
- Keyboard controls
- Last command status

Use keyboard:

```text
W A S D
```

---

## Verification Checklist

### ROS Simulation

- `/pose` publishes position.
- `/battery_percentage` publishes battery value.
- `/cmd` accepts `w`, `a`, `s`, `d`.

### ROS Plugin

Check logs:

```bash
docker compose logs -f ros-plugin
```

Expected logs:

```text
connected to ROS bridge
subscribed to /pose
subscribed to /battery_percentage
connected to backend websocket
sent telemetry robot=robot-1 ...
publishing command to /cmd: w
```

### Backend

Check health:

```bash
curl http://localhost:4000/health
```

Check state:

```bash
curl http://localhost:4000/api/robot/state
```

Send command:

```bash
curl -X POST http://localhost:4000/api/robot/command \
  -H "Content-Type: application/json" \
  -d '{"command":"a"}'
```

### Frontend

- Open `http://localhost:3000`
- Confirm robot dot is displayed.
- Confirm battery percentage is displayed.
- Press `W`, `A`, `S`, `D`.
- Confirm robot position changes.

---

## Communication Protocol

The ROS Plugin communicates with the Cloud Backend using WebSocket.

Reason:

- Telemetry needs to flow from ROS Plugin to Backend.
- Movement commands need to flow from Backend to ROS Plugin.
- WebSocket supports bidirectional communication in one persistent connection.
- It is simple enough for this assignment without adding unnecessary infrastructure.

Trade-offs:

- Requires reconnect handling.
- Requires connection state tracking.
- Current implementation supports one plugin connection.
- A production version should add authentication, robot identity validation, and stronger multi-robot routing.

---

## Known Issues and Limitations

- Latest robot state is stored in memory only.
- Backend restart clears the latest state.
- Authentication is not implemented.
- Current setup is designed for one robot: `robot-1`.
- Frontend uses polling for robot state.
- ROSBridge networking may behave differently outside Docker Desktop macOS.
- The provided mock battery value can be above 100.
- The UI is intentionally simple and focuses on integration correctness.

---

## Walkthrough Video Notes

Recommended walkthrough order:

1. Explain that ROS simulation is provided by Movel AI.
2. Explain that this repo builds only ROS Plugin, Cloud Backend, and Frontend.
3. Show `docker-compose-assignment.yaml` running `web-ros`.
4. Show ROS topics: `/pose`, `/battery_percentage`, `/cmd`.
5. Start custom stack with `docker compose up --build -d`.
6. Show ROS Plugin logs connected to ROSBridge and backend.
7. Show backend `/health`.
8. Show backend `/api/robot/state`.
9. Open frontend.
10. Press `W`, `A`, `S`, `D`.
11. Show command logs from ROS Plugin.
12. Explain why WebSocket was used.
13. Mention known limitations and possible improvements.
