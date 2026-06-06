# Movel AI ROS Plugin Integration

A simple robot-to-cloud integration demo for the Movel AI ROS Plugin Integration assignment.

This repository does not include the ROS simulation implementation. The simulation is provided separately by Movel AI through `docker-compose-assignment.yaml`.

This project contains three services:

1. ROS Plugin
2. Cloud Backend
3. Frontend

The main idea is to keep ROS-specific logic inside the ROS Plugin, expose robot state through the backend, and keep the frontend as a simple browser dashboard.

---

## Architecture

```text
Provided ROS Simulation
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

The ROS Plugin is the only service that talks directly to ROS. The backend receives telemetry from the plugin and exposes simple APIs for the frontend. The frontend only talks to the backend.

---

## Tech Stack

### ROS Plugin

- Python
- `roslibpy`
- `websocket-client`

### Cloud Backend

- Node.js
- TypeScript
- Express
- `ws`

### Frontend

- React
- TypeScript
- Vite

---

## Prerequisites

Required:

- Git
- Docker
- Docker Compose

Optional for local development outside Docker:

- Node.js 22
- Python 3.12+

The project is intended to run through Docker Compose, so Node.js and Python are not required on the host machine unless you want to run the services manually.

---

## How to Run

### 1. Clone the Repository

```bash
git clone https://github.com/ivandj0h/movelAI-master.git
cd movelAI-master
```

### 2. Prepare Environment File

```bash
cp .env.example .env
```

Default values:

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

### 3. Start the Provided ROS Simulation

The provided simulation compose file should be available as:

```text
docker-compose-assignment.yaml
```

Start it first:

```bash
docker compose -f docker-compose-assignment.yaml up -d
```

Check that the simulation container is running:

```bash
docker ps --filter "name=web-ros"
```

### 4. Start This Project

```bash
docker compose up --build -d
```

This starts:

- `movel-backend`
- `movel-frontend`
- `movel-ros-plugin`

### 5. Open the Frontend

```text
http://localhost:3000
```

---

## How to Verify

### 1. Check ROS Topics

List topics from the provided ROS container:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && rostopic list'
```

Expected topics include:

```text
/pose
/battery_percentage
/cmd
```

Check pose data:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && timeout 5 rostopic echo /pose || true'
```

Check battery data:

```bash
docker exec web-ros bash -lc 'source /ros_entrypoint.sh && timeout 5 rostopic echo /battery_percentage || true'
```

### 2. Check Backend Health

```bash
curl http://localhost:4000/health
```

Expected result:

```json
{
  "status": "ok",
  "plugin_connected": true,
  "last_telemetry_at": "..."
}
```

### 3. Check Robot State

```bash
curl http://localhost:4000/api/robot/state
```

Expected result:

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

### 4. Check Frontend Control

Open:

```text
http://localhost:3000
```

Then press:

```text
W A S D
```

The dashboard should update the robot position and show the latest position data.

---

## Backend API

### `GET /health`

Returns backend status and ROS Plugin connection status.

### `GET /api/robot/state`

Returns the latest robot position, battery percentage, and timestamp.

### `POST /api/robot/command`

Sends a movement command to the robot.

Request body:

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

## Protocol Choice

The ROS Plugin communicates with the backend using WebSocket.

I used WebSocket for this part because the communication is two-way:

- the plugin sends telemetry to the backend
- the backend sends movement commands back to the plugin

For the frontend, I used simple REST calls and polling because the UI only needs to show the latest robot state. This keeps the frontend easy to follow and avoids extra complexity.

---

## Known Limitations

- The backend stores only the latest robot state in memory.
- The current implementation is focused on one robot.
- Authentication is not included.
- Docker host networking can behave differently across operating systems.

---

## Notes

The provided ROS simulation uses host networking. This project was tested with Docker Desktop on macOS. On Linux, host networking is usually more direct. On Windows, Docker networking may need adjustment if the ROS Plugin cannot reach ROSBridge on port `9090`.
