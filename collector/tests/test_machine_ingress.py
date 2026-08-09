from __future__ import annotations

import os
import shutil
import ssl
import subprocess
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

import pytest


def _openssl_binary() -> str:
    binary = shutil.which("openssl")
    if binary:
        return binary
    git_binary = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "usr" / "bin" / "openssl.exe"
    if git_binary.is_file():
        return str(git_binary)
    pytest.skip("openssl is required for the local HTTPS capture")


def _create_loopback_certificate(directory: Path) -> tuple[Path, Path]:
    certificate = directory / "loopback-cert.pem"
    private_key = directory / "loopback-key.pem"
    subprocess.run(
        [
            _openssl_binary(),
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            str(private_key),
            "-out",
            str(certificate),
            "-days",
            "1",
            "-subj",
            "/CN=127.0.0.1",
            "-addext",
            "subjectAltName=IP:127.0.0.1",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return certificate, private_key


@contextmanager
def _local_https_capture() -> Iterator[tuple[str, Path, dict[str, str]]]:
    capture: dict[str, str] = {}

    class CaptureHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib handler API.
            machine_headers = [name for name, _ in self.headers.items() if name.lower() == "oai-sites-authorization"]
            capture.update(
                {
                    "authorization": self.headers.get("Authorization", ""),
                    "machine_header_count": str(len(machine_headers)),
                    "machine_header_name": machine_headers[0] if machine_headers else "",
                    "machine_header_value": self.headers.get("OAI-Sites-Authorization", ""),
                    "path": self.path,
                    "request_count": "1",
                }
            )
            self.send_response(202)
            self.end_headers()

        def log_message(self, format: str, *args: str) -> None:
            return None

    with TemporaryDirectory() as temporary_directory:
        certificate, private_key = _create_loopback_certificate(Path(temporary_directory))
        server = ThreadingHTTPServer(("127.0.0.1", 0), CaptureHandler)
        tls_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls_context.load_cert_chain(certfile=certificate, keyfile=private_key)
        server.socket = tls_context.wrap_socket(server.socket, server_side=True)
        listener = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        listener.start()
        try:
            yield f"https://127.0.0.1:{server.server_port}", certificate, capture
        finally:
            server.shutdown()
            listener.join(timeout=5)
            server.server_close()
            assert not listener.is_alive()


def _push_environment(certificate: Path, machine_authorization: str | None = None) -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(
        {
            "PYTHONDONTWRITEBYTECODE": "1",
            "SITE_INGEST_TOKEN": "test-site-ingest-token",
            "SSL_CERT_FILE": str(certificate),
        }
    )
    if machine_authorization is None:
        environment.pop("OAI_SITES_AUTHORIZATION", None)
    else:
        environment["OAI_SITES_AUTHORIZATION"] = machine_authorization
    return environment


def _run_push(snapshot: Path, base_url: str, environment: dict[str, str], machine_header_env: str | None = None) -> subprocess.CompletedProcess[str]:
    command = [
        sys.executable,
        "-m",
        "collector.cli",
        "push",
        "--input",
        str(snapshot),
        "--url",
        base_url,
        "--path",
        "/api/internal/ingest/snapshot",
        "--token-env",
        "SITE_INGEST_TOKEN",
    ]
    if machine_header_env:
        command.extend(["--machine-header-env", machine_header_env])
    return subprocess.run(command, capture_output=True, check=False, cwd=".", env=environment, text=True, timeout=10)


def test_push_keeps_canonical_path_and_bearer_without_machine_header() -> None:
    # Given: the legacy push invocation and a task-owned local HTTPS capture.
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        snapshot = temporary_path / "snapshot.json"
        snapshot.write_text("{}", encoding="utf-8")

        with _local_https_capture() as (base_url, certificate, capture):
            # When: push runs without a configured machine header.
            result = _run_push(snapshot, base_url, _push_environment(certificate))

    # Then: the canonical request preserves Bearer authorization and has no machine header.
    assert result.returncode == 0
    assert result.stdout == ""
    assert result.stderr == ""
    assert capture["authorization"] == "Bearer test-site-ingest-token"
    assert capture["machine_header_count"] == "0"
    assert capture["path"] == "/api/internal/ingest/snapshot"


def test_push_sends_machine_header_from_declared_environment() -> None:
    # Given: a named environment value and a task-owned local HTTPS capture.
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        snapshot = temporary_path / "snapshot.json"
        snapshot.write_text("{}", encoding="utf-8")

        with _local_https_capture() as (base_url, certificate, capture):
            # When: push is asked to source the machine header from its environment name.
            result = _run_push(
                snapshot,
                base_url,
                _push_environment(certificate, "test-machine-authorization"),
                machine_header_env="OAI_SITES_AUTHORIZATION",
            )

    # Then: exactly one source-bound machine header reaches the request boundary.
    assert result.returncode == 0
    assert result.stdout == ""
    assert result.stderr == ""
    assert capture["authorization"] == "Bearer test-site-ingest-token"
    assert capture["machine_header_count"] == "1"
    assert capture["machine_header_name"].lower() == "oai-sites-authorization"
    assert capture["machine_header_value"] == "test-machine-authorization"
    assert capture["path"] == "/api/internal/ingest/snapshot"


def test_push_blocks_before_http_when_declared_machine_header_is_blank() -> None:
    # Given: a declared machine-header environment name with a blank value.
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        snapshot = temporary_path / "snapshot.json"
        snapshot.write_text("{}", encoding="utf-8")

        with _local_https_capture() as (base_url, certificate, capture):
            # When: push receives an all-whitespace machine authorization value.
            result = _run_push(
                snapshot,
                base_url,
                _push_environment(certificate, " \t"),
                machine_header_env="OAI_SITES_AUTHORIZATION",
            )

    # Then: it fails deterministically before the listener observes HTTP.
    assert result.returncode == 3
    assert result.stdout == ""
    assert result.stderr == "OAI_SITES_AUTHORIZATION is required\n"
    assert capture == {}
