"""
Tests for CardioVision AI Unified Launcher (run.py).
Focuses on argument parsing, port conflict safety, process protection, and graceful shutdown.
"""

import os
import sys
import pytest
import subprocess
import time
from unittest.mock import patch

import run


def test_launcher_argument_parsing_defaults():
    """Verify default CLI arguments."""
    with patch.object(sys, "argv", ["run.py"]):
        args = run.parse_arguments()
        assert args.backend_port == 8000
        assert args.frontend_port == 5173
        assert args.no_browser is False
        assert args.no_reload is False
        assert args.force_restart is False
        assert args.no_install is False
        assert args.timeout == 60.0


def test_launcher_argument_parsing_custom_flags():
    """Verify custom CLI arguments pass through accurately."""
    custom_argv = [
        "run.py",
        "--backend-port", "8008",
        "--frontend-port", "5005",
        "--no-browser",
        "--no-reload",
        "--force-restart",
        "--no-install",
        "--timeout", "30.0",
    ]
    with patch.object(sys, "argv", custom_argv):
        args = run.parse_arguments()
        assert args.backend_port == 8008
        assert args.frontend_port == 5005
        assert args.no_browser is True
        assert args.no_reload is True
        assert args.force_restart is True
        assert args.no_install is True
        assert args.timeout == 30.0


def test_is_cardiovision_process_protection_unrelated_pids():
    """Verify that system and unrelated processes are never flagged as CardioVision."""
    # System PID 4
    assert run.is_cardiovision_process(4) is False
    # Self PID (the test runner itself)
    assert run.is_cardiovision_process(os.getpid()) is False
    # Invalid/non-existent PID
    assert run.is_cardiovision_process(99999999) is False
    # Negative PID
    assert run.is_cardiovision_process(-1) is False


def test_get_port_pids_does_not_false_match_suffix():
    """Verify that parsing port 8000 does not false-match ports 18000 or 28000."""
    fake_netstat = (
        "  TCP    127.0.0.1:18000        0.0.0.0:0              LISTENING       11111\n"
        "  TCP    127.0.0.1:28000        0.0.0.0:0              LISTENING       22222\n"
        "  TCP    127.0.0.1:8000         0.0.0.0:0              LISTENING       33333\n"
        "  TCP    [::]:8000              [::]:0                 LISTENING       44444\n"
    )
    with patch("subprocess.check_output", return_value=fake_netstat):
        with patch("sys.platform", "win32"):
            pids = run.get_port_pids(8000)
            assert 33333 in pids
            assert 44444 in pids
            assert 11111 not in pids
            assert 22222 not in pids


def test_free_port_refuses_to_kill_unrelated_process():
    """Verify that free_port raises RuntimeError when an unrelated process occupies the port."""
    with patch("run.get_port_pids", return_value=[99999]), \
         patch("run.is_cardiovision_process", return_value=False):
        with pytest.raises(RuntimeError) as excinfo:
            run.free_port(8000)
        assert "occupied by an external/unrelated process" in str(excinfo.value)


def test_free_port_terminates_verified_cardiovision_process():
    """Safety: cleanup uses the correct platform-specific process termination."""
    with patch("run.get_port_pids", side_effect=[[88888], []]), \
         patch("run.is_cardiovision_process", return_value=True), \
         patch("subprocess.run") as mock_run, \
         patch("run.os.kill") as mock_kill, \
         patch("run.time.sleep"):
        run.free_port(8000)
        if run.sys.platform == "win32":
            assert mock_run.called
            call_args = [str(arg) for call in mock_run.call_args_list for arg in call[0][0]]
            assert "88888" in call_args
        else:
            assert mock_kill.called
            assert mock_kill.call_args_list[0].args[0] == 88888


def test_free_port_no_pids_noop():
    """Verify that free_port on an empty port does nothing without error."""
    with patch("run.get_port_pids", return_value=[]):
        run.free_port(59999)


def test_check_url_health_responsive():
    """Verify check_url_health returns True on HTTP 200 response."""
    from unittest.mock import MagicMock
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    with patch("urllib.request.urlopen", return_value=mock_resp):
        assert run.check_url_health("http://127.0.0.1:8000/api/health") is True


def test_check_url_health_non_responsive():
    """Verify that check_url_health returns False when target is not listening."""
    assert run.check_url_health("http://127.0.0.1:54328/nonexistent") is False


def test_verify_backend_identity_healthy():
    """Verify backend identity check returns True when health response confirms Cleveland dataset and readiness."""
    import json
    from unittest.mock import MagicMock
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps({
        "dataset": "UCI Heart Disease (Cleveland)",
        "ready": True
    }).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    with patch("urllib.request.urlopen", return_value=mock_resp):
        assert run.verify_backend_identity(8000) is True


def test_verify_backend_identity_unrelated_or_down():
    """Verify backend identity check returns False when endpoint is down or returns different dataset."""
    import json
    from unittest.mock import MagicMock
    # Mismatched payload
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps({
        "dataset": "Unknown Dataset",
        "ready": False
    }).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    with patch("urllib.request.urlopen", return_value=mock_resp):
        assert run.verify_backend_identity(8000) is False

    # Connection failure
    with patch("urllib.request.urlopen", side_effect=OSError("Connection refused")):
        assert run.verify_backend_identity(8000) is False


def test_verify_frontend_identity():
    """Verify frontend identity check accurately detects CardioVision Vite app."""
    from unittest.mock import MagicMock
    # Matching CardioVision HTML
    mock_resp_cv = MagicMock()
    mock_resp_cv.status = 200
    mock_resp_cv.read.return_value = b"<!DOCTYPE html><html><head><title>CardioVision AI</title></head></html>"
    mock_resp_cv.__enter__.return_value = mock_resp_cv
    with patch("urllib.request.urlopen", return_value=mock_resp_cv):
        assert run.verify_frontend_identity(5173) is True

    # Generic or unrelated HTML
    mock_resp_other = MagicMock()
    mock_resp_other.status = 200
    mock_resp_other.read.return_value = b"<!DOCTYPE html><html><head><title>Apache Test</title></head></html>"
    mock_resp_other.__enter__.return_value = mock_resp_other
    with patch("urllib.request.urlopen", return_value=mock_resp_other):
        assert run.verify_frontend_identity(5173) is False


def test_is_port_in_use_behavior():
    """Verify is_port_in_use correctly identifies port status."""
    with patch("run.get_port_pids", return_value=[1234]):
        assert run.is_port_in_use(8000) is True

    with patch("run.get_port_pids", return_value=[]), \
         patch("socket.socket") as mock_sock_cls:
        mock_sock = mock_sock_cls.return_value.__enter__.return_value
        mock_sock.bind.return_value = None
        assert run.is_port_in_use(59998) is False


def test_preflight_checks_valid():
    """Verify preflight check passes on the repository workspace."""
    err = run.run_preflight_checks(run.BACKEND_DIR, run.FRONTEND_DIR)
    assert err is None, f"Preflight checks failed: {err}"


def test_kill_process_tree_graceful():
    """Verify kill_process_tree terminates a managed test child process cleanly."""
    child = subprocess.Popen(
        [sys.executable, "-c", "import time; time.sleep(15)"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    assert child.poll() is None
    run.kill_process_tree(child, timeout=2.0)
    time.sleep(0.5)
    assert child.poll() is not None

