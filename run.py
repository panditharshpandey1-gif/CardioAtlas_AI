"""
CardioVision AI - Unified Concurrent Launcher
Runs both FastAPI Backend and Vite Frontend simultaneously.
Standard library only. Cross-platform (Windows primary).
"""

import argparse
import atexit
import concurrent.futures
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from collections import deque
from typing import Deque, List, Optional

# Root and subproject paths
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# ANSI Color codes
COLOR_RESET = "\033[0m"
COLOR_GREEN = "\033[32m"
COLOR_CYAN = "\033[36m"
COLOR_RED = "\033[31m"
COLOR_YELLOW = "\033[33m"
COLOR_BOLD = "\033[1m"

# Ring buffer for recent service logs
log_buffer: Deque[str] = deque(maxlen=100)
log_lock = threading.Lock()


def enable_ansi_colors() -> None:
    """Enable ANSI escape codes and safe encoding on Windows console."""
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            for handle_id in (-11, -12):  # STD_OUTPUT_HANDLE, STD_ERROR_HANDLE
                handle = kernel32.GetStdHandle(handle_id)
                mode = ctypes.c_ulong()
                if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                    # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
                    kernel32.SetConsoleMode(handle, mode.value | 0x0004)
        except Exception:
            pass


def get_port_pids(port: int) -> List[int]:
    """Return list of PIDs currently listening on the specified TCP port."""
    pids: List[int] = []
    my_pid = os.getpid()

    if sys.platform == "win32":
        try:
            output = subprocess.check_output(
                "netstat -ano -p tcp",
                shell=True,
                text=True,
                stderr=subprocess.DEVNULL,
            )
            for line in output.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and parts[3].upper() == "LISTENING":
                    local_addr = parts[1]
                    # Parse local address (e.g. 127.0.0.1:8000, 0.0.0.0:8000, [::]:8000)
                    if ":" in local_addr:
                        port_str = local_addr.rsplit(":", 1)[1]
                        if port_str == str(port):
                            try:
                                pid = int(parts[4])
                                if pid > 0 and pid != my_pid and pid not in pids:
                                    pids.append(pid)
                            except ValueError:
                                pass
        except Exception:
            pass
    else:
        # POSIX: Try lsof first, then fuser
        try:
            output = subprocess.check_output(
                ["lsof", "-ti", f":{port}"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            for line in output.splitlines():
                line = line.strip()
                if line.isdigit():
                    pid = int(line)
                    if pid > 0 and pid != my_pid and pid not in pids:
                        pids.append(pid)
        except Exception:
            pass

        if not pids:
            try:
                output = subprocess.check_output(
                    ["fuser", f"{port}/tcp"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
                for part in output.split():
                    part = part.strip().rstrip("/c").rstrip("/f").rstrip("/e")
                    if part.isdigit():
                        pid = int(part)
                        if pid > 0 and pid != my_pid and pid not in pids:
                            pids.append(pid)
            except Exception:
                pass

    return pids


def is_port_in_use(port: int) -> bool:
    """Check if a port has listening PIDs or cannot be bound."""
    if get_port_pids(port):
        return True
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def is_cardiovision_process(pid: int) -> bool:
    """Establish whether the process belongs to this application's managed tree or project stack."""
    if pid <= 0 or pid == os.getpid():
        return False

    cmdline = ""
    exe_path = ""

    if sys.platform == "win32":
        try:
            # Query Win32_Process for CommandLine and ExecutablePath
            ps_script = (
                f'$p = Get-CimInstance Win32_Process -Filter "ProcessId = {pid}" -ErrorAction SilentlyContinue; '
                f'if ($p) {{ "$($p.CommandLine) ::: $($p.ExecutablePath)" }}'
            )
            output = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", ps_script],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=4.0,
            )
            raw = output.strip().lower()
            if ":::" in raw:
                cmdline, exe_path = raw.split(":::", 1)
            else:
                cmdline = raw
        except Exception:
            return False
    else:
        try:
            with open(f"/proc/{pid}/cmdline", "r") as f:
                cmdline = f.read().replace("\x00", " ").lower()
        except Exception:
            return False

    if not cmdline and not exe_path:
        return False

    full_target_str = f"{cmdline} {exe_path}".lower()

    # 1. Exact repository root match
    norm_root = os.path.normpath(ROOT_DIR).lower()
    norm_root_fwd = norm_root.replace("\\", "/")
    if norm_root in full_target_str or norm_root_fwd in full_target_str:
        return True

    # 2. Match project-specific entry points with folder context
    has_cardio = "cardio" in full_target_str or "cardiovision" in full_target_str
    is_fastapi_backend = "main:app" in full_target_str and "uvicorn" in full_target_str
    is_vite_frontend = ("vite" in full_target_str or "npm" in full_target_str) and "frontend" in full_target_str

    if is_fastapi_backend and (has_cardio or "backend" in full_target_str):
        return True
    if is_vite_frontend and has_cardio:
        return True

    return False


def free_port(port: int) -> None:
    """Frees up a port ONLY if listening processes belong to CardioVision AI."""
    pids = get_port_pids(port)
    if not pids:
        return

    for pid in pids:
        if is_cardiovision_process(pid):
            print(f"   [Port Cleanup] Freeing occupied port {port} (PID: {pid}, CardioVision verified)...")
            if sys.platform == "win32":
                try:
                    # 1. Attempt graceful termination first
                    subprocess.run(
                        ["taskkill", "/T", "/PID", str(pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=False,
                    )
                    time.sleep(1.0)
                    # 2. Check if still running, only force kill if necessary
                    if pid in get_port_pids(port):
                        subprocess.run(
                            ["taskkill", "/T", "/F", "/PID", str(pid)],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            check=False,
                        )
                except Exception:
                    pass
            else:
                try:
                    os.kill(pid, signal.SIGTERM)
                    deadline = time.time() + 3.0
                    killed = False
                    while time.time() < deadline:
                        time.sleep(0.1)
                        try:
                            os.kill(pid, 0)
                        except OSError:
                            killed = True
                            break
                    if not killed:
                        os.kill(pid, signal.SIGKILL)
                except OSError:
                    pass
        else:
            print(
                f"   {COLOR_RED}[SECURITY WARNING]{COLOR_RESET} Port {port} is occupied by PID {pid}, "
                f"which does NOT belong to CardioVision AI. Refusing to terminate unrelated process."
            )
            raise RuntimeError(
                f"Port {port} is occupied by an external/unrelated process (PID: {pid}). "
                f"Please specify a different port or terminate it manually."
            )
    time.sleep(0.5)


def kill_process_tree(proc: subprocess.Popen, timeout: float = 4.0) -> None:
    """Terminate the process and all of its descendants gracefully, then forcefully if needed."""
    if proc.poll() is not None:
        return

    pid = proc.pid
    if sys.platform == "win32":
        try:
            # 1. Graceful request
            proc.terminate()
        except Exception:
            pass

        try:
            # Request graceful close across process tree
            subprocess.run(
                ["taskkill", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except Exception:
            pass

        # Wait for graceful exit
        deadline = time.time() + min(timeout, 2.5)
        while time.time() < deadline:
            if proc.poll() is not None:
                return
            time.sleep(0.1)

        # 2. Force kill fallback if tree didn't exit in time
        try:
            subprocess.run(
                ["taskkill", "/T", "/F", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except Exception:
            pass
        try:
            proc.wait(timeout=1.0)
        except Exception:
            pass
    else:
        try:
            pgid = os.getpgid(pid)
            # Never signal our own process group. A child without its own
            # session shares the launcher/test-runner group; killing it could
            # terminate the controlling shell and unrelated processes.
            separate_group = pgid != os.getpgrp()
            if separate_group:
                os.killpg(pgid, signal.SIGTERM)
            else:
                proc.terminate()
            deadline = time.time() + timeout
            while time.time() < deadline:
                if proc.poll() is not None:
                    return
                time.sleep(0.1)
            if separate_group:
                os.killpg(pgid, signal.SIGKILL)
            else:
                proc.kill()
            proc.wait(timeout=1.0)
        except ProcessLookupError:
            pass
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass



def stream_output(process: subprocess.Popen, prefix: str, color_code: str) -> None:
    """Stream process output line-by-line with prefix, saving to log buffer."""
    if not process.stdout:
        return
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            clean_line = line.rstrip()
            formatted = f"{color_code}[{prefix}]{COLOR_RESET} {clean_line}"
            with log_lock:
                log_buffer.append(formatted)
            print(formatted, flush=True)
    except Exception:
        pass


def check_url_health(url: str) -> bool:
    """Probe if a service endpoint responds with HTTP 2xx or 3xx across IPv4/localhost."""
    urls = [url]
    if "localhost" in url:
        urls.append(url.replace("localhost", "127.0.0.1"))
    elif "127.0.0.1" in url:
        urls.append(url.replace("127.0.0.1", "localhost"))

    for target in urls:
        try:
            req = urllib.request.Request(
                target,
                headers={"User-Agent": "CardioVision-Launcher/1.0"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as response:
                if 200 <= response.status < 400:
                    return True
        except Exception:
            continue
    return False


def verify_backend_identity(port: int) -> bool:
    """Verify that an endpoint on backend port is genuinely CardioVision AI."""
    url = f"http://127.0.0.1:{port}/api/health"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CardioVision-Launcher/1.0"},
        )
        with urllib.request.urlopen(req, timeout=1.5) as response:
            if response.status == 200:
                import json
                body = json.loads(response.read().decode("utf-8"))
                return (
                    body.get("dataset") == "UCI Heart Disease (Cleveland)"
                    and body.get("ready") is True
                )
    except Exception:
        return False
    return False


def verify_frontend_identity(port: int) -> bool:
    """Verify that an endpoint on frontend port is genuinely CardioVision AI."""
    for host in ("127.0.0.1", "localhost"):
        url = f"http://{host}:{port}/"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CardioVision-Launcher/1.0"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as response:
                if 200 <= response.status < 400:
                    html = response.read().decode("utf-8", errors="ignore")
                    return "CardioVision" in html or "cardiovision" in html.lower()
        except Exception:
            continue
    return False



def wait_for(
    url: str,
    timeout: float = 60.0,
    proc: Optional[subprocess.Popen] = None,
) -> bool:
    """Poll a URL until it responds successfully or until timeout expires."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc is not None and proc.poll() is not None:
            return False
        if check_url_health(url):
            return True
        time.sleep(0.4)
    return False


def run_preflight_checks(
    backend_dir: str,
    frontend_dir: str,
    no_install: bool = False,
) -> Optional[str]:
    """Verify directories, dependencies, and node_modules. Return error message or None."""
    if not os.path.isdir(backend_dir):
        return f"Backend directory does not exist: {backend_dir}"

    if not os.path.isdir(frontend_dir):
        return f"Frontend directory does not exist: {frontend_dir}"

    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_path:
        return "'npm' command was not found in PATH. Please install Node.js (https://nodejs.org/)."

    missing_modules: List[str] = []
    for mod_name in ["fastapi", "uvicorn", "pydantic", "numpy", "sklearn", "joblib"]:
        try:
            __import__(mod_name)
        except ImportError:
            missing_modules.append(mod_name)

    if missing_modules:
        missing_str = ", ".join(missing_modules)
        venv_hint = ""
        for candidate_venv in [os.path.join(ROOT_DIR, ".venv"), os.path.join(ROOT_DIR, "venv")]:
            if os.path.isdir(candidate_venv):
                venv_hint = f"\n  (Tip: A virtual environment was detected at '{candidate_venv}'. Activate it with '.\\{os.path.basename(candidate_venv)}\\Scripts\\activate' or run via 'run.bat' / 'run.ps1'.)"
                break
        return (
            f"Required Python module(s) missing: {missing_str}.\n"
            f"  Please run: pip install -r backend/requirements.txt{venv_hint}"
        )

    # Ensure dataset is available and validated before backend boot
    dataset_path = os.path.join(backend_dir, "data", "processed.cleveland.data")
    if not os.path.isfile(dataset_path):
        print("   [Preflight] Cleveland dataset not found. Initializing dataset...")
        try:
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from download_data import download_cleveland_dataset
            download_cleveland_dataset(dataset_path)
            print("   [Preflight] Cleveland dataset downloaded and validated successfully.")
        except Exception as e:
            return f"Failed to initialize Cleveland dataset at {dataset_path}: {e}"

    # Ensure model artifacts exist so backend loads instantly without retraining
    artifacts_path = os.path.join(backend_dir, "data", "model_artifacts.joblib")
    metrics_path = os.path.join(backend_dir, "data", "metrics.json")
    if not os.path.isfile(artifacts_path) or not os.path.isfile(metrics_path):
        print("   [Preflight] Pre-trained model artifacts not found. Training baseline models...")
        try:
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from train_eval import train_and_evaluate
            train_and_evaluate(force=False)
            print("   [Preflight] Models trained and evaluation metrics generated successfully.")
        except Exception as e:
            return f"Failed to generate model artifacts: {e}"

    node_modules_dir = os.path.join(frontend_dir, "node_modules")
    if not os.path.isdir(node_modules_dir):
        if no_install:
            return (
                "frontend/node_modules is missing and --no-install was specified.\n"
                "  Please run 'npm --prefix frontend install' to install dependencies."
            )
        print("   [Preflight] 'frontend/node_modules' not found. Auto-running 'npm install'...")
        try:
            res = subprocess.run([npm_path, "install"], cwd=frontend_dir, check=False)
            if res.returncode != 0:
                return f"'npm install' in frontend/ failed with code {res.returncode}."
            print("   [Preflight] Frontend dependencies installed successfully.")
        except Exception as e:
            return f"Failed to run 'npm install': {e}"

    return None


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Run CardioVision AI (FastAPI Backend + Vite Frontend)",
    )
    parser.add_argument(
        "--backend-port",
        type=int,
        default=8000,
        help="Port for FastAPI backend (default: 8000)",
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=5173,
        help="Port for Vite frontend (default: 5173)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open the browser automatically",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload for uvicorn backend",
    )
    parser.add_argument(
        "--force-restart",
        action="store_true",
        help="Kill any existing listeners on target ports before launching",
    )
    parser.add_argument(
        "--no-install",
        action="store_true",
        help="Skip auto-install of npm packages if frontend/node_modules is missing",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=60.0,
        help="Timeout in seconds for readiness checks (default: 60)",
    )
    return parser.parse_args()


def main() -> int:
    """Main launcher entrypoint. Returns an exit code."""
    enable_ansi_colors()
    args = parse_arguments()

    backend_port = args.backend_port
    frontend_port = args.frontend_port
    backend_url = f"http://127.0.0.1:{backend_port}/api/health"
    frontend_url = f"http://localhost:{frontend_port}/"

    print("=" * 68)
    print(f"   {COLOR_BOLD}[+] CARDIOVISION AI - UNIFIED WORKSTATION LAUNCHER{COLOR_RESET}")
    print(f"   FastAPI Backend (:{backend_port}) & Vite Frontend (:{frontend_port})")
    print("=" * 68)

    # Preflight checks
    preflight_error = run_preflight_checks(
        BACKEND_DIR,
        FRONTEND_DIR,
        no_install=args.no_install,
    )
    if preflight_error:
        print(f"\n{COLOR_RED}[PREFLIGHT ERROR]{COLOR_RESET} {preflight_error}\n")
        return 1

    # Check for force-restart cleanup
    if args.force_restart:
        print("\n[Port Cleanup] Freeing ports as requested by --force-restart...")
        try:
            free_port(backend_port)
            free_port(frontend_port)
        except RuntimeError as e:
            print(f"\n{COLOR_RED}[PORT ERROR]{COLOR_RESET} {e}\n")
            return 1

    # Check existing instances / busy ports with application identity verification
    backend_reused = False
    frontend_reused = False

    if not args.force_restart and verify_backend_identity(backend_port):
        backend_reused = True
        print(f"\n[1/2] CardioVision FastAPI Backend is ALREADY HEALTHY at http://127.0.0.1:{backend_port} (verified & reusing)")
    elif not args.force_restart and is_port_in_use(backend_port):
        pids = get_port_pids(backend_port)
        pid_info = f"PID {pids[0]}" if pids else "an existing process"
        print(f"\n{COLOR_RED}[ERROR]{COLOR_RESET} Backend port {backend_port} is already in use by {pid_info}.")
        print("        Use --force-restart (if CardioVision) to terminate it, or specify a different --backend-port.\n")
        return 1

    if not args.force_restart and verify_frontend_identity(frontend_port):
        frontend_reused = True
        print(f"[2/2] CardioVision Vite Frontend is ALREADY HEALTHY at http://localhost:{frontend_port} (verified & reusing)")
    elif not args.force_restart and is_port_in_use(frontend_port):
        pids = get_port_pids(frontend_port)
        pid_info = f"PID {pids[0]}" if pids else "an existing process"
        print(f"\n{COLOR_RED}[ERROR]{COLOR_RESET} Frontend port {frontend_port} is already in use by {pid_info}.")
        print("        Use --force-restart (if CardioVision) to terminate it, or specify a different --frontend-port.\n")
        return 1

    child_env = os.environ.copy()
    child_env["PYTHONUNBUFFERED"] = "1"
    child_env["BACKEND_PORT"] = str(backend_port)
    child_env["VITE_BACKEND_PORT"] = str(backend_port)
    child_env["FRONTEND_PORT"] = str(frontend_port)
    child_env["VITE_FRONTEND_PORT"] = str(frontend_port)
    popen_kwargs = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if sys.platform == "win32"
        else {"start_new_session": True}
    )

    backend_proc: Optional[subprocess.Popen] = None
    frontend_proc: Optional[subprocess.Popen] = None

    def cleanup() -> None:
        """Clean up child processes gracefully."""
        if backend_proc is not None:
            kill_process_tree(backend_proc)
        if frontend_proc is not None:
            kill_process_tree(frontend_proc)

    atexit.register(cleanup)

    stop_requested = threading.Event()

    def signal_handler(signum, frame):
        stop_requested.set()

    try:
        signal.signal(signal.SIGINT, signal_handler)
    except Exception:
        pass
    if hasattr(signal, "SIGTERM"):
        try:
            signal.signal(signal.SIGTERM, signal_handler)
        except Exception:
            pass
    if hasattr(signal, "SIGBREAK"):
        try:
            signal.signal(signal.SIGBREAK, signal_handler)
        except Exception:
            pass

    try:
        # Start Backend
        if not backend_reused:
            print(f"\n[1/2] Starting FastAPI Backend on http://127.0.0.1:{backend_port} ...")
            backend_cmd = [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(backend_port),
            ]
            if not args.no_reload:
                backend_cmd.append("--reload")

            backend_proc = subprocess.Popen(
                backend_cmd,
                cwd=BACKEND_DIR,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=child_env,
                **popen_kwargs,
            )

            t_backend = threading.Thread(
                target=stream_output,
                args=(backend_proc, f"Backend:{backend_port}", COLOR_GREEN),
                daemon=True,
            )
            t_backend.start()

        # Start Frontend
        if not frontend_reused:
            print(f"[2/2] Starting Vite Frontend on http://localhost:{frontend_port} ...")
            npm_cmd = shutil.which("npm.cmd") or shutil.which("npm") or ("npm.cmd" if sys.platform == "win32" else "npm")
            frontend_cmd = [
                npm_cmd,
                "run",
                "dev",
                "--",
                "--port",
                str(frontend_port),
            ]

            frontend_proc = subprocess.Popen(
                frontend_cmd,
                cwd=FRONTEND_DIR,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=child_env,
                **popen_kwargs,
            )

            t_frontend = threading.Thread(
                target=stream_output,
                args=(frontend_proc, f"Frontend:{frontend_port}", COLOR_CYAN),
                daemon=True,
            )
            t_frontend.start()

        # Poll both services in parallel
        print(f"\n   [Startup] Verifying readiness of services (timeout {args.timeout:.0f}s)...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_back = executor.submit(wait_for, backend_url, args.timeout, backend_proc)
            fut_front = executor.submit(wait_for, frontend_url, args.timeout, frontend_proc)
            backend_ok = fut_back.result()
            frontend_ok = fut_front.result()

        if not backend_ok or not frontend_ok:
            print("\n" + "=" * 68)
            print(f"   {COLOR_RED}[ERROR] Service readiness check timed out after {args.timeout:.0f}s:{COLOR_RESET}")
            if not backend_ok:
                print(f"     - Backend failed to respond at {backend_url}")
            if not frontend_ok:
                print(f"     - Frontend failed to respond at {frontend_url}")
            print("=" * 68)
            print("\n   --- Last 20 service log lines ---")
            with log_lock:
                recent_lines = list(log_buffer)[-20:]
            if recent_lines:
                for line in recent_lines:
                    print(f"   {line}")
            else:
                print("   (No logs captured)")
            print("   " + "-" * 32 + "\n")
            return 1

        print("\n" + "=" * 68)
        print(f"   {COLOR_GREEN}[SUCCESS] BOTH SERVERS ARE LIVE & HEALTHY!{COLOR_RESET}")
        print("=" * 68)
        print(f"   >> Web App:                  http://localhost:{frontend_port}")
        print(f"   >> FastAPI REST API:         http://127.0.0.1:{backend_port}")
        print(f"   >> Swagger Docs:             http://127.0.0.1:{backend_port}/docs")
        print(f"   >> Backend Health Check:     http://127.0.0.1:{backend_port}/api/health")
        print("=" * 68)
        print("   [*] Press Ctrl+C anytime to stop services.\n")

        # Open browser only once frontend is confirmed ready
        if not args.no_browser and frontend_ok:
            try:
                webbrowser.open(frontend_url)
            except Exception:
                pass

        # Supervise processes
        last_reused_check = time.time()
        while not stop_requested.is_set():
            time.sleep(0.5)
            if backend_proc is not None and backend_proc.poll() is not None:
                code = backend_proc.returncode
                print(f"\n{COLOR_RED}[ERROR]{COLOR_RESET} Backend process exited unexpectedly with code {code}.")
                return code if code != 0 else 1
            if frontend_proc is not None and frontend_proc.poll() is not None:
                code = frontend_proc.returncode
                print(f"\n{COLOR_RED}[ERROR]{COLOR_RESET} Frontend process exited unexpectedly with code {code}.")
                return code if code != 0 else 1

            # Monitor reused endpoints periodically
            now = time.time()
            if now - last_reused_check >= 5.0:
                last_reused_check = now
                if backend_reused and not check_url_health(backend_url):
                    print(f"\n{COLOR_YELLOW}[WARNING]{COLOR_RESET} Reused backend at {backend_url} stopped responding.")
                if frontend_reused and not check_url_health(frontend_url):
                    print(f"\n{COLOR_YELLOW}[WARNING]{COLOR_RESET} Reused frontend at {frontend_url} stopped responding.")

        return 0

    except KeyboardInterrupt:
        return 0
    finally:
        print(f"\n{COLOR_YELLOW}[INFO] Stopping CardioVision AI services gracefully...{COLOR_RESET}")
        cleanup()



if __name__ == "__main__":
    sys.exit(main())
