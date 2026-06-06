import json
import os
import signal
import sys
import time
from datetime import datetime, timezone
from threading import Lock, Thread

import roslibpy # type: ignore
import websocket # type: ignore


ROBOT_ID = os.getenv("ROBOT_ID", "robot-1")
ROSBRIDGE_HOST = os.getenv("ROSBRIDGE_HOST", "web-ros")
ROSBRIDGE_PORT = int(os.getenv("ROSBRIDGE_PORT", "9090"))
BACKEND_WS_URL = os.getenv("BACKEND_WS_URL", "ws://backend:4000/ws/plugin")

latest_position = {"x": 0.0, "y": 0.0}
latest_battery = None
state_lock = Lock()
running = True


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def log(message):
    print(f"[ros-plugin] {message}", flush=True)


def handle_pose(message):
    global latest_position

    with state_lock:
        latest_position = {
            "x": float(message.get("x", 0.0)),
            "y": float(message.get("y", 0.0)),
        }


def handle_battery(message):
    global latest_battery

    with state_lock:
        latest_battery = float(message.get("data", 0.0))


def build_telemetry():
    with state_lock:
        battery = latest_battery if latest_battery is not None else 0.0

        return {
            "type": "telemetry",
            "payload": {
                "robot_id": ROBOT_ID,
                "position": {
                    "x": latest_position["x"],
                    "y": latest_position["y"],
                },
                "battery_percentage": battery,
                "timestamp": now_iso(),
            },
        }


def connect_ros():
    log(f"connecting to ROS bridge ws://{ROSBRIDGE_HOST}:{ROSBRIDGE_PORT}")

    ros = roslibpy.Ros(host=ROSBRIDGE_HOST, port=ROSBRIDGE_PORT)
    ros.run()

    if not ros.is_connected:
        raise RuntimeError("failed to connect to ROS bridge")

    log("connected to ROS bridge")

    pose_topic = roslibpy.Topic(ros, "/pose", "geometry_msgs/Point")
    battery_topic = roslibpy.Topic(ros, "/battery_percentage", "std_msgs/Float64")
    cmd_topic = roslibpy.Topic(ros, "/cmd", "std_msgs/String")

    pose_topic.subscribe(handle_pose)
    log("subscribed to /pose")

    battery_topic.subscribe(handle_battery)
    log("subscribed to /battery_percentage")

    return ros, pose_topic, battery_topic, cmd_topic


def backend_loop(cmd_topic):
    global running

    while running:
        ws = None

        try:
            log(f"connecting to backend {BACKEND_WS_URL}")
            ws = websocket.create_connection(BACKEND_WS_URL, timeout=5)
            ws.settimeout(None)
            log("connected to backend websocket")

            def receive_commands():
                while running:
                    try:
                        raw = ws.recv()
                        data = json.loads(raw)

                        if data.get("type") != "command":
                            log(f"ignored unknown backend message: {data}")
                            continue

                        command = data.get("payload", {}).get("command")

                        if command not in ["w", "a", "s", "d"]:
                            log(f"ignored invalid command from backend: {command}")
                            continue

                        log(f"publishing command to /cmd: {command}")
                        cmd_topic.publish(roslibpy.Message({"data": command}))

                    except Exception as error:
                        if running:
                            log(f"backend receive loop stopped: {error}")
                        break

            receiver = Thread(target=receive_commands, daemon=True)
            receiver.start()

            while running:
                telemetry = build_telemetry()
                ws.send(json.dumps(telemetry))

                payload = telemetry["payload"]
                log(
                    f"sent telemetry robot={payload['robot_id']} "
                    f"x={payload['position']['x']} "
                    f"y={payload['position']['y']} "
                    f"battery={payload['battery_percentage']}"
                )

                time.sleep(1)

        except Exception as error:
            if running:
                log(f"backend connection error: {error}")

        finally:
            if ws:
                try:
                    ws.close()
                except Exception:
                    pass

        if running:
            log("reconnecting to backend in 3 seconds")
            time.sleep(3)


def shutdown(_signum, _frame):
    global running
    log("shutdown requested")
    running = False


def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    ros = None

    try:
        ros, pose_topic, battery_topic, cmd_topic = connect_ros()
        backend_loop(cmd_topic)
    finally:
        if ros:
            log("terminating ROS connection")
            ros.terminate()


if __name__ == "__main__":
    main()
