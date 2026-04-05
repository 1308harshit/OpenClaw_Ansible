#!/usr/bin/env python3
"""
EC2-side remote MCP client.

Reuses the same newline-delimited JSON-RPC over stdio pattern as:
  - clos-medium/ansible-mcp-project/mcp_server.py
  - clos-medium/ansible-mcp-project/frontend/server.js

Supports multiple executors (config-driven):
  - ec2-localhost (default): spawns local mcp_server.py
  - laptop-wsl (opt-in): spawns WSL mcp_server.py over Tailscale SSH
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


def _eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


def _sh_single_quote(s: str) -> str:
    # abc'def -> 'abc'"'"'def'
    return "'" + s.replace("'", "'\"'\"'") + "'"


@dataclass
class McpProc:
    proc: subprocess.Popen[str]
    stderr_buf: str = ""
    next_id: int = 1
    initialized: bool = False

    def close(self) -> None:
        try:
            self.proc.terminate()
        except Exception:
            pass

    def rpc(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        req_id = self.next_id
        self.next_id += 1
        msg = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
        assert self.proc.stdin is not None
        assert self.proc.stdout is not None
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()

        while True:
            line = self.proc.stdout.readline()
            if line == "":
                raise RuntimeError("MCP process exited unexpectedly")
            try:
                resp = json.loads(line)
            except Exception:
                continue
            if resp.get("id") == req_id:
                return resp

    def call_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if not self.initialized:
            init = self.rpc("initialize", {"protocolVersion": "0.1"})
            if "error" in init:
                raise RuntimeError(f"MCP initialize error: {init['error']}")
            self.initialized = True

        resp = self.rpc("tools/call", {"name": name, "arguments": args or {}})
        if "error" in resp:
            raise RuntimeError(f"MCP tools/call error: {resp['error']}")
        text = (((resp.get("result") or {}).get("content") or [{}])[0]).get("text") or "{}"
        try:
            return json.loads(text)
        except Exception:
            return {"raw": text}


def _spawn_local(project_root: Path) -> McpProc:
    cmd = os.environ.get("MCP_SERVER_CMD") or str(project_root / "venv" / "bin" / "python")
    server_path = os.environ.get("MCP_SERVER_PATH") or str(project_root / "mcp_server.py")
    env = {**os.environ, "ANSIBLE_PROJECT_ROOT": str(project_root)}
    proc = subprocess.Popen(  # noqa: S603
        [cmd, server_path],
        cwd=str(project_root),
        text=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    return McpProc(proc=proc)


def _spawn_laptop_wsl() -> McpProc:
    # Laptop host connectivity (Tailscale SSH recommended)
    ssh_bin = os.environ.get("LAPTOP_SSH_BIN", "tailscale")
    ssh_target = os.environ.get("LAPTOP_SSH_TARGET", "").strip()
    if not ssh_target:
        raise RuntimeError(
            "LAPTOP_SSH_TARGET is required for executorTarget=laptop-wsl (e.g. harshit@100.69.92.79 or harshit@harshit)"
        )

    wsl_project_root = os.environ.get("LAPTOP_WSL_PROJECT_ROOT", "~/local-server/ansible-mcp-project")
    wsl_python = os.environ.get("LAPTOP_WSL_PYTHON", "python3")
    wsl_server_path = os.environ.get("LAPTOP_WSL_MCP_SERVER_PATH", "mcp_server.py")

    inner = " && ".join(
        [
            f"cd {_sh_single_quote(wsl_project_root)}",
            'export ANSIBLE_PROJECT_ROOT="$(pwd)"',
            f"{wsl_python} {_sh_single_quote(wsl_server_path)}",
        ]
    )
    remote_cmd = f"wsl bash -lc {_sh_single_quote(inner)}"

    extra_args: List[str] = []
    extra_json = os.environ.get("LAPTOP_SSH_ARGS_JSON", "").strip()
    if extra_json:
        try:
            parsed = json.loads(extra_json)
            if not isinstance(parsed, list) or not all(isinstance(x, str) for x in parsed):
                raise ValueError
            extra_args = parsed
        except Exception as exc:
            raise RuntimeError(f"Invalid LAPTOP_SSH_ARGS_JSON: {exc}") from exc

    if ssh_bin == "tailscale":
        argv = ["tailscale", "ssh", *extra_args, ssh_target, "--", remote_cmd]
    else:
        argv = [ssh_bin, *extra_args, ssh_target, remote_cmd]

    proc = subprocess.Popen(  # noqa: S603
        argv,
        text=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ},
    )
    return McpProc(proc=proc)


def start_executor(project_root: Path, executor_target: str) -> McpProc:
    if executor_target == "ec2-localhost":
        return _spawn_local(project_root)
    if executor_target == "laptop-wsl":
        return _spawn_laptop_wsl()
    raise RuntimeError(f"Unknown executor target: {executor_target}")


def main() -> int:
    parser = argparse.ArgumentParser(description="EC2-side MCP client (multi-executor).")
    parser.add_argument(
        "--executor",
        default=os.environ.get("EXECUTOR_TARGET", "ec2-localhost"),
        choices=["ec2-localhost", "laptop-wsl"],
        help="Executor target (config-driven). Default: ec2-localhost.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list-tools")
    sub.add_parser("list-playbooks")

    install = sub.add_parser("install-postgres-wsl")
    install.add_argument("--check", action="store_true")

    uninstall = sub.add_parser("uninstall-postgres-wsl")
    uninstall.add_argument("--check", action="store_true")

    status = sub.add_parser("status")
    status.add_argument("service", help="Service name (e.g. postgres, postgresql)")

    args = parser.parse_args()
    project_root = Path(__file__).resolve().parent

    mcp = start_executor(project_root=project_root, executor_target=args.executor)
    try:
        if args.cmd == "list-tools":
            resp = mcp.rpc("tools/list", {})
            print(json.dumps(resp.get("result") or {}, indent=2))
            return 0

        if args.cmd == "list-playbooks":
            out = mcp.call_tool("list_playbooks", {})
            print(json.dumps(out, indent=2))
            return 0

        if args.cmd == "install-postgres-wsl":
            tool = "run_playbook_check" if args.check else "run_playbook"
            out = mcp.call_tool(tool, {"playbook": "postgres_wsl_install.yml"})
            print(json.dumps(out, indent=2))
            return 0

        if args.cmd == "uninstall-postgres-wsl":
            tool = "run_playbook_check" if args.check else "run_playbook"
            out = mcp.call_tool(tool, {"playbook": "postgres_wsl_uninstall.yml"})
            print(json.dumps(out, indent=2))
            return 0

        if args.cmd == "status":
            out = mcp.call_tool("check_service_status", {"service_name": args.service})
            print(json.dumps(out, indent=2))
            return 0

        raise RuntimeError("unreachable")
    finally:
        mcp.close()


if __name__ == "__main__":
    raise SystemExit(main())


