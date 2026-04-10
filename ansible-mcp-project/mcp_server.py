#!/usr/bin/env python3
"""
Minimal MCP (stdio) server for safe Ansible execution (PoC).

Transport: JSON-RPC 2.0 over stdio, newline-delimited JSON objects.
Implements methods:
  - initialize
  - tools/list
  - tools/call

Guardrails:
  - Hard restricted to ANSIBLE_PROJECT_ROOT
  - Allow-listed tools only (no arbitrary shell, no arbitrary file ops)
  - Only runs ansible-playbook / ansible-inventory with explicit args (shell=False)
"""

from __future__ import annotations

import json
import os
import re
import difflib
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
from dotenv import load_dotenv


SAFE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.,:-]+$")

# Curated playbook metadata — overlaid on top of auto-extracted info.
# Provides intent-level descriptions and keywords so Gemini can accurately
# select playbooks from natural-language requests.
PLAYBOOK_CATALOG: Dict[str, Dict[str, Any]] = {
    "show_interfaces_all.yml": {
        "description": "Collects interface status from all fabric devices and routers. Saves per-device reports to reports/.",
        "intent_keywords": ["interfaces", "interface status", "show interfaces", "port status", "link status", "show all interfaces"],
        "hosts": "fabric + routers",
        "produces": "reports/*_interfaces_all.txt",
        "order_hint": 1,
    },
    "show_unused_ports.yml": {
        "description": "Identifies unused, disabled, or notconnect ports on all fabric devices. Saves per-device unused port reports.",
        "intent_keywords": ["unused ports", "disabled ports", "notconnect", "idle ports", "port utilization", "unused"],
        "hosts": "fabric + routers",
        "produces": "reports/*_unused_ports.txt",
        "order_hint": 2,
    },
    "check_vlan_consistency.yml": {
        "description": "Verifies VLAN database consistency across all fabric switches. Saves per-device VLAN reports.",
        "intent_keywords": ["vlan", "vlan consistency", "check vlan", "vlan check", "vlan verification", "layer 2"],
        "hosts": "fabric",
        "produces": "reports/*_vlans.txt",
        "order_hint": 3,
    },
    "harden_fabric_simple.yml": {
        "description": "Applies baseline security hardening to fabric devices: login banner, NTP, SSH config, idle timeout.",
        "intent_keywords": ["harden", "hardening", "security", "baseline", "banner", "ntp", "ssh", "secure"],
        "hosts": "fabric",
        "produces": "reports/hardening/*_hardening.txt",
        "order_hint": 4,
    },
    "generate_fabric_compliance_report.yml": {
        "description": "Generates an HTML compliance dashboard at reports/fabric_compliance/index.html. Requires prior interface, unused ports, VLAN, and hardening data.",
        "intent_keywords": ["compliance report", "fabric report", "html report", "dashboard", "audit report", "generate report"],
        "hosts": "fabric + routers",
        "produces": "reports/fabric_compliance/index.html",
        "order_hint": 5,
    },
    "show_topology_status.yml": {
        "description": "Checks containerlab topology node status: version, uptime, LLDP neighbors, and interface status for all fabric devices.",
        "intent_keywords": ["topology", "topology status", "node status", "containerlab", "lab status", "clos topology", "are nodes up"],
        "hosts": "fabric + routers",
        "produces": "reports/*_topology_status.txt",
        "order_hint": 6,
    },
    "fabric_audit_all.yml": {
        "description": "LEGACY ORCHESTRATOR — do not select. Use individual playbooks instead.",
        "intent_keywords": [],
        "hosts": "fabric + routers",
        "produces": "reports/fabric_compliance/index.html",
        "order_hint": 99,
    },
    "ssl_cert_check_expiry.yml": {
        "description": "Checks the SSL certificate expiry date and status for snoopy.timlam007.com. Reports days remaining, valid/expired/expiring-soon status.",
        "intent_keywords": ["ssl expiry", "cert expiry", "certificate status", "check ssl", "ssl status", "is cert expired", "certificate check"],
        "hosts": "localhost_linux",
        "produces": "stdout report",
        "order_hint": 10,
    },
    "ssl_cert_deploy_new.yml": {
        "description": "Renews and deploys a new SSL certificate from HashiCorp Vault for snoopy.timlam007.com. Backs up old cert, requests new one, reloads Nginx.",
        "intent_keywords": ["renew ssl", "renew certificate", "deploy ssl", "fix ssl", "ssl renewal", "new certificate", "replace cert"],
        "hosts": "localhost_linux",
        "produces": "new cert at /etc/nginx/ssl/server.crt",
        "order_hint": 11,
    },
    "ssl_cert_generate_report.yml": {
        "description": "Generates an HTML report for the SSL certificate at reports/ssl_report/index.html with full cert details, expiry, fingerprints.",
        "intent_keywords": ["ssl report", "certificate report", "ssl html report", "cert report"],
        "hosts": "localhost_linux",
        "produces": "reports/ssl_report/index.html",
        "order_hint": 12,
    },
    "ssl_cert_make_expire.yml": {
        "description": "Demo trick — replaces the current SSL certificate with an expired one to simulate expiry for demonstration purposes.",
        "intent_keywords": ["make cert expire", "expire certificate", "simulate expiry", "demo expire", "make ssl expire"],
        "hosts": "localhost_linux",
        "produces": "expired cert at /etc/nginx/ssl/server.crt",
        "order_hint": 13,
    },
    "ssl_cert_show_details.yml": {
        "description": "Shows full SSL certificate details: subject, issuer, serial, fingerprints, key algorithm, validity period.",
        "intent_keywords": ["ssl details", "cert details", "show ssl", "certificate info", "ssl info"],
        "hosts": "localhost_linux",
        "produces": "stdout report",
        "order_hint": 14,
    },
}


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: Dict[str, Any]


def _eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


def _read_json_lines() -> Any:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        yield json.loads(line)


def _write(obj: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _jsonrpc_result(req_id: Any, result: Any) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _jsonrpc_error(req_id: Any, code: int, message: str, data: Any = None) -> Dict[str, Any]:
    err: Dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": req_id, "error": err}


def _must_be_under(root: Path, p: Path) -> Path:
    root_resolved = root.resolve()
    p_resolved = p.resolve()
    try:
        p_resolved.relative_to(root_resolved)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("path is outside ANSIBLE_PROJECT_ROOT") from exc
    return p_resolved


def _run(cmd: List[str], cwd: Path, timeout_s: int = 3600) -> Dict[str, Any]:
    proc = subprocess.run(  # noqa: S603
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        timeout=timeout_s,
        env={**os.environ},
    )
    return {
        "cmd": cmd,
        "returncode": proc.returncode,
        "stdout": proc.stdout[-200_000:],
        "stderr": proc.stderr[-200_000:],
    }


class AnsibleMcpServer:
    def __init__(self, project_root: Path, extra_playbooks_dirs: Optional[List[Path]] = None):
        self.project_root = project_root
        self.inventory_file = _must_be_under(self.project_root, self.project_root / "inventory" / "inventory.yml")
        self.playbooks_dir = _must_be_under(self.project_root, self.project_root / "playbooks")
        self.reports_dir = _must_be_under(self.project_root, self.project_root / "reports")
        self.backups_dir = _must_be_under(self.project_root, self.project_root / "backups")
        # Additional playbook directories to scan (e.g. ansible-project/playbooks)
        self.extra_playbooks_dirs: List[Path] = [p for p in (extra_playbooks_dirs or []) if p.is_dir()]

        self.tools: Dict[str, ToolSpec] = {
            "list_inventory": ToolSpec(
                name="list_inventory",
                description="List Ansible inventory (groups/hosts). Read-only.",
                input_schema={"type": "object", "properties": {}, "additionalProperties": False},
            ),
            "list_playbooks": ToolSpec(
                name="list_playbooks",
                description="List runnable playbooks under playbooks/. Read-only.",
                input_schema={"type": "object", "properties": {}, "additionalProperties": False},
            ),
            "list_playbooks_with_summary": ToolSpec(
                name="list_playbooks_with_summary",
                description="List runnable playbooks under playbooks/ with a short semantic summary (name/hosts/modules/vars). Read-only.",
                input_schema={"type": "object", "properties": {}, "additionalProperties": False},
            ),
            "list_reports": ToolSpec(
                name="list_reports",
                description="List generated report files under reports/ (relative paths) with metadata. Optionally filter by prefix (e.g. 'switch_summary/'). Read-only.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "prefix": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            ),
            "read_report_file": ToolSpec(
                name="read_report_file",
                description="Read a generated report file under reports/. Useful for HTML/text reports. Read-only.",
                input_schema={
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                    "additionalProperties": False,
                },
            ),
            "list_backups": ToolSpec(
                name="list_backups",
                description="List backup files under backups/ (relative paths) with metadata. Read-only.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "prefix": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            ),
            "read_backup_file": ToolSpec(
                name="read_backup_file",
                description=(
                    "Read a backup file under backups/. Backup configs may contain sensitive strings; "
                    "output is truncated and common secret patterns are redacted. Read-only."
                ),
                input_schema={
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                    "additionalProperties": False,
                },
            ),
            "summarize_unused_ports_reports": ToolSpec(
                name="summarize_unused_ports_reports",
                description=(
                    "Summarize unused ports reports created by show_unused_ports.yml. "
                    "Computes per-device unused-port counts and identifies the max. Read-only."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "limit": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            ),
            "run_playbook": ToolSpec(
                name="run_playbook",
                description="Run an allow-listed playbook via ansible-playbook. Supports optional --limit, --tags, and --extra-vars.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "playbook": {"type": "string"},
                        "limit": {"type": "string"},
                        "tags": {"type": "string"},
                        "extra_vars": {"type": "object"},
                    },
                    "required": ["playbook"],
                    "additionalProperties": False,
                },
            ),
            "run_playbook_check": ToolSpec(
                name="run_playbook_check",
                description="Run an allow-listed playbook in check mode (--check --diff). Supports optional --limit, --tags, and --extra-vars.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "playbook": {"type": "string"},
                        "limit": {"type": "string"},
                        "tags": {"type": "string"},
                        "extra_vars": {"type": "object"},
                    },
                    "required": ["playbook"],
                    "additionalProperties": False,
                },
            ),
            "read_playbook_file": ToolSpec(
                name="read_playbook_file",
                description="Read content of a playbook file from playbooks/ directory. Use this to understand what a playbook does before running it. Read-only.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                    },
                    "required": ["filename"],
                    "additionalProperties": False,
                },
            ),
            "get_playbook_info": ToolSpec(
                name="get_playbook_info",
                description="Get semantic description of what a playbook does. This helps map user requests to the correct playbook. Returns keywords, hosts, modules, and variable inputs.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "playbook": {"type": "string"},
                    },
                    "required": ["playbook"],
                    "additionalProperties": False,
                },
            ),
            "check_service_status": ToolSpec(
                name="check_service_status",
                description="Check if a service (e.g., postgresql) is installed and running on localhost. Returns installation status, service status, and version if available.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "service_name": {"type": "string"},
                    },
                    "required": ["service_name"],
                    "additionalProperties": False,
                },
            ),
            "check_https_endpoint": ToolSpec(
                name="check_https_endpoint",
                description="Check if an HTTPS endpoint is reachable and healthy. Returns HTTP status code, response content, and SSL certificate validity. Use this to verify HTTPS health endpoints like https://localhost/health or https://snoopy.timlam007.com/health.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "Full HTTPS URL to check (e.g., https://localhost/health or https://snoopy.timlam007.com/health)"},
                        "validate_certs": {"type": "boolean", "description": "Whether to validate SSL certificates (default: false for self-signed certs)"},
                    },
                    "required": ["url"],
                    "additionalProperties": False,
                },
            ),
            "run_playbooks": ToolSpec(
                name="run_playbooks",
                description=(
                    "Run multiple playbooks in sequence with a single tool call. "
                    "Use this when the user asks for multiple operations in one prompt (e.g. 'show interfaces AND check VLANs AND harden'). "
                    "Each playbook runs in order; results are returned per-playbook. "
                    "Set stop_on_failure=false to continue even if one playbook fails."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "playbooks": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Ordered list of playbook names to run (e.g. ['show_interfaces_all.yml', 'check_vlan_consistency.yml'])",
                        },
                        "limit": {"type": "string"},
                        "tags": {"type": "string"},
                        "extra_vars": {"type": "object"},
                        "stop_on_failure": {
                            "type": "boolean",
                            "description": "Stop the sequence if any playbook fails. Defaults to true.",
                        },
                    },
                    "required": ["playbooks"],
                    "additionalProperties": False,
                },
            ),
            "intelligent_playbook_orchestration": ToolSpec(
                name="intelligent_playbook_orchestration",
                description=(
                    "Intelligently analyze user intent and automatically select and execute the appropriate combination of playbooks. "
                    "This tool uses LLM reasoning to understand natural language requests and map them to available playbooks. "
                    "Example: 'I want to audit the fabric and check for unused ports' -> automatically runs fabric_audit_all.yml + show_unused_ports.yml. "
                    "Returns the execution plan and results."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "user_request": {
                            "type": "string",
                            "description": "Natural language description of what the user wants to accomplish (e.g., 'audit the network and check security', 'install SQL server and verify it works')",
                        },
                        "limit": {"type": "string"},
                        "tags": {"type": "string"},
                        "extra_vars": {"type": "object"},
                        "dry_run": {
                            "type": "boolean",
                            "description": "If true, only return the execution plan without running playbooks. Defaults to false.",
                        },
                    },
                    "required": ["user_request"],
                    "additionalProperties": False,
                },
            ),
        }

    def handle_tools_list(self) -> Dict[str, Any]:
        return {
            "tools": [
                {"name": t.name, "description": t.description, "inputSchema": t.input_schema}
                for t in self.tools.values()
            ]
        }

    def _validate_token(self, value: Optional[str], field: str) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if value == "":
            return None
        if not SAFE_TOKEN_RE.match(value):
            raise ValueError(f"invalid {field}: only [A-Za-z0-9_.,:-] allowed")
        return value

    def _normalize_playbook_key(self, s: str) -> str:
        s2 = s.strip().lower()
        s2 = re.sub(r"\.(ya?ml)$", "", s2)
        # Remove non-alphanumerics to be robust to spaces/underscores/hyphens.
        s2 = re.sub(r"[^a-z0-9]+", "", s2)
        return s2

    def _playbook_index(self) -> Tuple[Dict[str, Path], List[str]]:
        # Collect playbooks from primary dir first, then extra dirs (primary takes precedence on name clash)
        all_dirs = [self.playbooks_dir] + self.extra_playbooks_dirs
        by_key: Dict[str, Path] = {}
        names: List[str] = []
        seen_names: set = set()
        for pb_dir in all_dirs:
            for p in sorted(pb_dir.glob("*.y*ml")):
                if not p.is_file():
                    continue
                if p.name not in seen_names:
                    seen_names.add(p.name)
                    names.append(p.name)
                key = self._normalize_playbook_key(p.name)
                by_key.setdefault(key, p)
                if key.endswith("s"):
                    by_key.setdefault(key[:-1], p)
        return by_key, names

    def _resolve_playbook(self, playbook: str) -> Path:
        q = playbook.strip()
        by_key, names = self._playbook_index()
        key = self._normalize_playbook_key(q)
        if key in by_key:
            pb_path = by_key[key]
            # Allow paths from extra_playbooks_dirs without project_root restriction
            return pb_path

        # Try close matches on filename list for a helpful error.
        close = difflib.get_close_matches(q, names, n=5, cutoff=0.45)
        hint = f" Did you mean: {', '.join(close)}" if close else ""
        raise FileNotFoundError(f"playbook not found in playbooks/: {playbook}.{hint}")

    def _extract_playbook_info(self, pb_path: Path) -> Dict[str, Any]:
        """Extract semantic information about a playbook to help with query matching."""
        content = pb_path.read_text(encoding="utf-8")
        info: Dict[str, Any] = {
            "filename": pb_path.name,
            "name": pb_path.name,
            "hosts": "",
            "keywords": [],
            "modules": [],
            "inputs": [],
            "summary": "",
        }
        try:
            playbook_data = yaml.safe_load(content)
        except Exception as yaml_exc:  # noqa: BLE001
            info["summary"] = "Could not parse playbook"
            info["error"] = str(yaml_exc)
            return info

        if not isinstance(playbook_data, list) or len(playbook_data) == 0 or not isinstance(playbook_data[0], dict):
            info["summary"] = "Unknown playbook structure"
            return info

        play = playbook_data[0]
        name = str(play.get("name", "") or "").strip()
        hosts = play.get("hosts", "")
        tasks = play.get("tasks", []) or []
        vars_block = play.get("vars", {}) or {}

        keywords = set()
        modules = set()
        inputs = set()

        if name:
            info["name"] = name
            keywords.update(re.findall(r"[a-z0-9_]+", name.lower()))

        if isinstance(hosts, str):
            info["hosts"] = hosts
            keywords.add(hosts.lower())

        if isinstance(vars_block, dict):
            for k in vars_block.keys():
                if isinstance(k, str):
                    inputs.add(k)
                    keywords.add(k.lower())

        if isinstance(tasks, list):
            for task in tasks:
                if not isinstance(task, dict):
                    continue
                tname = str(task.get("name", "") or "").strip().lower()
                if tname:
                    keywords.update(re.findall(r"[a-z0-9_]+", tname))
                # Identify module keys (skip meta keys)
                for k in task.keys():
                    if k in {"name", "when", "vars", "register", "tags", "delegate_to", "run_once", "changed_when", "failed_when", "no_log"}:
                        continue
                    if isinstance(k, str):
                        modules.add(k)
                        base = k.split(".")[-1].lower()
                        keywords.add(base)

        # Heuristic keywords (network automation oriented)
        joined = " ".join(sorted(keywords))
        if "vlan" in joined:
            keywords.add("vlan")
        if "interface" in joined or "interfaces" in joined:
            keywords.add("interface")
        if "backup" in joined:
            keywords.add("backup")
        if "report" in joined or "summary" in joined:
            keywords.add("report")
        if "unused" in joined or "ports" in joined or "port" in joined:
            keywords.add("unused_ports")

        info["keywords"] = sorted(keywords)
        info["modules"] = sorted(modules)
        info["inputs"] = sorted(inputs)
        info["summary"] = name or pb_path.name

        # Overlay curated PLAYBOOK_CATALOG metadata (takes precedence over auto-extracted)
        catalog_entry = PLAYBOOK_CATALOG.get(pb_path.name)
        if catalog_entry:
            info["description"] = catalog_entry.get("description", info["summary"])
            info["intent_keywords"] = catalog_entry.get("intent_keywords", [])
            info["produces"] = catalog_entry.get("produces", "")
            info["order_hint"] = catalog_entry.get("order_hint", 99)
            # Merge intent_keywords into keywords so the plan model sees them
            info["keywords"] = sorted(set(info["keywords"]) | set(catalog_entry.get("intent_keywords", [])))
        else:
            info["description"] = info["summary"]
            info["intent_keywords"] = []
            info["produces"] = ""
            info["order_hint"] = 99

        return info

    def tool_list_inventory(self) -> Dict[str, Any]:
        res = _run(["ansible-inventory", "-i", str(self.inventory_file), "--list"], cwd=self.project_root)
        if res["returncode"] != 0:
            return {"ok": False, **res}
        try:
            inv = json.loads(res["stdout"])
        except Exception:  # noqa: BLE001
            inv = {"raw": res["stdout"]}
        return {"ok": True, "inventory": inv, **{k: res[k] for k in ("returncode", "stderr", "cmd")}}

    def tool_list_playbooks(self) -> Dict[str, Any]:
        # Use _playbook_index to get all playbooks from all directories
        _, names = self._playbook_index()
        return {"ok": True, "playbooks": names}

    def tool_list_playbooks_with_summary(self) -> Dict[str, Any]:
        # Collect playbooks from primary dir first, then extra dirs
        all_dirs = [self.playbooks_dir] + self.extra_playbooks_dirs
        seen_names: set = set()
        items: List[Dict[str, Any]] = []
        for pb_dir in all_dirs:
            for p in sorted(pb_dir.glob("*.y*ml")):
                if not p.is_file():
                    continue
                if p.name not in seen_names:
                    seen_names.add(p.name)
                    items.append(self._extract_playbook_info(p))
        return {"ok": True, "playbooks": items}

    def tool_list_reports(self, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # reports/ might not exist yet; treat as empty.
        if not self.reports_dir.exists():
            return {"ok": True, "reports": []}

        prefix = ""
        if args and isinstance(args, dict):
            prefix = str(args.get("prefix") or "").strip().lstrip("/")
        base = self.reports_dir / prefix if prefix else self.reports_dir
        base = _must_be_under(self.project_root, base)
        if prefix and not base.exists():
            return {"ok": True, "reports": []}

        items: List[Dict[str, Any]] = []
        for p in sorted(base.rglob("*")):
            if p.is_file():
                rel = str(p.relative_to(self.reports_dir)).replace("\\", "/")
                try:
                    st = p.stat()
                    items.append(
                        {
                            "path": rel,
                            "ext": p.suffix.lower().lstrip("."),
                            "size_bytes": st.st_size,
                            "mtime_epoch": int(st.st_mtime),
                        }
                    )
                except Exception:  # noqa: BLE001
                    items.append({"path": rel, "ext": p.suffix.lower().lstrip(".")})
        # Prevent huge outputs
        return {"ok": True, "reports": items[:2000]}

    def tool_read_report_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        rel = str(args["path"]).strip().lstrip("/")
        p = _must_be_under(self.project_root, self.reports_dir / rel)
        if not p.is_file():
            raise FileNotFoundError(f"report not found under reports/: {rel}")
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            return {"ok": True, "path": rel.replace("\\", "/"), "content": content[-200_000:]}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def tool_list_backups(self, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.backups_dir.exists():
            return {"ok": True, "backups": []}

        prefix = ""
        if args and isinstance(args, dict):
            prefix = str(args.get("prefix") or "").strip().lstrip("/")
        base = self.backups_dir / prefix if prefix else self.backups_dir
        base = _must_be_under(self.project_root, base)
        if prefix and not base.exists():
            return {"ok": True, "backups": []}

        items: List[Dict[str, Any]] = []
        for p in sorted(base.rglob("*")):
            if p.is_file():
                rel = str(p.relative_to(self.backups_dir)).replace("\\", "/")
                try:
                    st = p.stat()
                    items.append(
                        {
                            "path": rel,
                            "ext": p.suffix.lower().lstrip("."),
                            "size_bytes": st.st_size,
                            "mtime_epoch": int(st.st_mtime),
                        }
                    )
                except Exception:  # noqa: BLE001
                    items.append({"path": rel, "ext": p.suffix.lower().lstrip(".")})
        return {"ok": True, "backups": items[:2000]}

    def _redact_secrets(self, text: str) -> str:
        # Best-effort redaction for common config secret patterns.
        patterns = [
            r"(?im)^(\\s*(username|user)\\s+\\S+\\s+(secret|password)\\s+)(.+)$",
            r"(?im)^(\\s*(enable\\s+)?secret\\s+)(.+)$",
            r"(?im)^(\\s*password\\s+)(.+)$",
            r"(?im)^(\\s*snmp-server\\s+community\\s+)(\\S+)(.*)$",
            r"(?im)^(\\s*key\\s+)(.+)$",
        ]
        out = text
        for pat in patterns:
            out = re.sub(pat, r"\\1REDACTED", out)
        return out

    def tool_read_backup_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        rel = str(args["path"]).strip().lstrip("/")
        p = _must_be_under(self.project_root, self.backups_dir / rel)
        if not p.is_file():
            raise FileNotFoundError(f"backup not found under backups/: {rel}")
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            content = content[-200_000:]
            return {"ok": True, "path": rel.replace("\\", "/"), "content": self._redact_secrets(content)}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def _inventory_group_hosts(self) -> Dict[str, List[str]]:
        """Best-effort parse of inventory.yml to map group -> hostnames."""
        try:
            inv = yaml.safe_load(self.inventory_file.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
        if not isinstance(inv, dict):
            return {}
        all_block = inv.get("all")
        if not isinstance(all_block, dict):
            return {}
        children = all_block.get("children")
        if not isinstance(children, dict):
            return {}

        out: Dict[str, List[str]] = {}
        for group, gdata in children.items():
            if not isinstance(gdata, dict):
                continue
            hosts = gdata.get("hosts")
            if isinstance(hosts, dict):
                out[str(group)] = [str(h) for h in hosts.keys()]
        return out

    def _resolve_limit_to_hosts(self, limit: Optional[str]) -> Optional[List[str]]:
        """Resolve a limit token to hosts if it matches a group; return None to mean 'no filter'."""
        limit_v = self._validate_token(limit, "limit")
        if not limit_v:
            return None
        groups = self._inventory_group_hosts()
        if limit_v in groups:
            return groups[limit_v]
        # Otherwise treat as a single host token.
        return [limit_v]

    def tool_summarize_unused_ports_reports(self, args: Dict[str, Any]) -> Dict[str, Any]:
        # Read-only summary of reports/*_unused_ports.txt
        wanted_hosts = self._resolve_limit_to_hosts(args.get("limit"))
        if not self.reports_dir.exists():
            return {"ok": False, "error": "reports/ directory not found (run show_unused_ports.yml first)"}

        candidates = sorted(self.reports_dir.glob("*_unused_ports.txt"))
        if not candidates:
            return {"ok": False, "error": "No *_unused_ports.txt reports found (run show_unused_ports.yml first)"}

        rows: List[Dict[str, Any]] = []
        best = {"host": None, "count": -1}

        for p in candidates:
            host = p.name.replace("_unused_ports.txt", "")
            if wanted_hosts is not None and host not in wanted_hosts:
                continue
            try:
                content = p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            # Count interface-like lines under the report body.
            # Prefer counting lines that begin with an interface name.
            iface_lines = [ln for ln in content.splitlines() if re.match(r"^(Et|Ma|Lo)\\S*", ln.strip())]
            count = len(iface_lines)

            rows.append(
                {
                    "host": host,
                    "count": count,
                    "report_path": f"{host}_unused_ports.txt",
                }
            )
            if count > best["count"]:
                best = {"host": host, "count": count}

        rows_sorted = sorted(rows, key=lambda r: (-int(r["count"]), str(r["host"])))
        return {
            "ok": True,
            "limit": args.get("limit") or "",
            "results": rows_sorted,
            "max": best,
        }

    def tool_read_playbook_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        filename = args["filename"].strip()
        pb_path = self._resolve_playbook(filename)
        try:
            content = pb_path.read_text(encoding="utf-8")
            return {"ok": True, "filename": pb_path.name, "content": content}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def _run_playbook(
        self,
        playbook: str,
        limit: Optional[str],
        tags: Optional[str],
        extra_vars: Optional[Dict[str, Any]],
        check: bool,
    ) -> Dict[str, Any]:
        pb = self._resolve_playbook(playbook)
        limit_v = self._validate_token(limit, "limit")
        tags_v = self._validate_token(tags, "tags")

        # Check if playbook targets localhost and auto-add connection vars
        auto_vars: Dict[str, Any] = {}
        try:
            with pb.open(encoding="utf-8") as f:
                pb_content = yaml.safe_load(f)
                if isinstance(pb_content, list) and len(pb_content) > 0:
                    play = pb_content[0]
                    hosts = play.get("hosts", "")
                    # Check if hosts is exactly localhost or localhost_linux (avoid partial matches)
                    _hosts_lower = hosts.lower()
                    _localhost_targets = {"localhost", "localhost_linux", "127.0.0.1"}
                    if isinstance(hosts, str) and (_hosts_lower in _localhost_targets or _hosts_lower.startswith("localhost")):
                        auto_vars.update({
                            "ansible_connection": "local",
                            "ansible_network_os": "",
                            "ansible_become_method": "sudo",
                        })
        except Exception:
            pass  # If we can't parse, continue without auto-vars

        # Merge auto_vars with user-provided extra_vars (user vars take precedence)
        final_extra_vars = {**auto_vars}
        if extra_vars:
            final_extra_vars.update(extra_vars)

        # CRITICAL FIX: Always use the correct inventory path
        # This ensures network playbooks work regardless of ANSIBLE_PROJECT_ROOT setting
        inventory_path = Path("/home/ansible/NERD_clab_topologies/clos-medium/ansible-project/inventory/inventory.yml")
        
        # Debug logging to verify paths
        _eprint(f"[DEBUG] Using inventory: {inventory_path}")
        _eprint(f"[DEBUG] Using playbook: {pb}")
        _eprint(f"[DEBUG] Inventory exists: {inventory_path.exists()}")

        cmd: List[str] = ["ansible-playbook", "-i", str(inventory_path), str(pb)]
        if check:
            cmd += ["--check", "--diff"]
        if limit_v:
            cmd += ["--limit", limit_v]
        if tags_v:
            cmd += ["--tags", tags_v]
        if final_extra_vars:
            # Pass as JSON; do not allow arbitrary strings here to keep it structured.
            cmd += ["--extra-vars", json.dumps(final_extra_vars)]

        res = _run(cmd, cwd=self.project_root)
        return {"ok": res["returncode"] == 0, **res}

    def tool_run_playbook(self, args: Dict[str, Any]) -> Dict[str, Any]:
        return self._run_playbook(
            playbook=args["playbook"],
            limit=args.get("limit"),
            tags=args.get("tags"),
            extra_vars=args.get("extra_vars"),
            check=False,
        )

    def tool_run_playbook_check(self, args: Dict[str, Any]) -> Dict[str, Any]:
        return self._run_playbook(
            playbook=args["playbook"],
            limit=args.get("limit"),
            tags=args.get("tags"),
            extra_vars=args.get("extra_vars"),
            check=True,
        )

    def tool_run_playbooks(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Run multiple playbooks sequentially, returning per-playbook results."""
        playbooks = args.get("playbooks")
        if not isinstance(playbooks, list) or len(playbooks) == 0:
            raise ValueError("run_playbooks: 'playbooks' must be a non-empty list")

        limit = args.get("limit")
        tags = args.get("tags")
        extra_vars = args.get("extra_vars")
        stop_on_failure = args.get("stop_on_failure", True)

        results: List[Dict[str, Any]] = []
        overall_ok = True

        for pb_name in playbooks:
            try:
                res = self._run_playbook(
                    playbook=pb_name,
                    limit=limit,
                    tags=tags,
                    extra_vars=extra_vars,
                    check=False,
                )
            except (FileNotFoundError, ValueError) as exc:
                res = {"ok": False, "playbook": pb_name, "error": str(exc)}

            res["playbook"] = pb_name
            results.append(res)

            if not res.get("ok", False):
                overall_ok = False
                if stop_on_failure:
                    # Mark remaining playbooks as skipped
                    for skipped in playbooks[playbooks.index(pb_name) + 1:]:
                        results.append({"playbook": skipped, "ok": None, "skipped": True, "reason": f"Skipped because '{pb_name}' failed"})
                    break

        return {
            "ok": overall_ok,
            "total": len(playbooks),
            "executed": len([r for r in results if r.get("ok") is not None and not r.get("skipped")]),
            "skipped": len([r for r in results if r.get("skipped")]),
            "results": results,
        }

    def tool_intelligent_playbook_orchestration(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intelligently analyze user intent and automatically select/execute appropriate playbooks.
        Uses LLM reasoning to map natural language to playbook combinations.
        """
        user_request = args.get("user_request", "").strip()
        if not user_request:
            raise ValueError("intelligent_playbook_orchestration: 'user_request' is required")

        limit = args.get("limit")
        tags = args.get("tags")
        extra_vars = args.get("extra_vars")
        dry_run = args.get("dry_run", False)

        # Get all available playbooks with their descriptions
        playbook_catalog = self.tool_list_playbooks_with_summary()
        
        # Build a knowledge base of playbooks
        playbook_descriptions = []
        for pb in playbook_catalog.get("playbooks", []):
            name = pb.get("name", "")
            summary = pb.get("summary", "")   # summary is a string (playbook display name)
            hosts = pb.get("hosts", "")
            modules = pb.get("modules", [])
            keywords = pb.get("keywords", [])

            desc = f"- {name}: hosts={hosts}, keywords={keywords}, modules={modules}"
            playbook_descriptions.append(desc)

        # Create the LLM prompt for playbook selection
        prompt = f"""You are an Ansible playbook orchestration assistant. Analyze the user's request and determine which playbooks should be executed and in what order.

Available Playbooks:
{chr(10).join(playbook_descriptions)}

User Request: "{user_request}"

Based on the user's request, determine:
1. Which playbooks are needed
2. The optimal execution order
3. Any dependencies between playbooks

Respond ONLY with a JSON object in this exact format:
{{
    "reasoning": "Brief explanation of why these playbooks were selected",
    "playbooks": ["playbook1.yml", "playbook2.yml"],
    "execution_order_rationale": "Why this order makes sense"
}}

Rules:
- Only include playbooks that exist in the available list
- Order matters: put prerequisite playbooks first
- Be conservative: only include playbooks directly related to the request
- If the request is unclear or no playbooks match, return an empty playbooks array"""

        try:
            import os
            import json
            import urllib.request

            api_key = os.getenv("GEMINI_API_KEY")
            model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

            if not api_key:
                return {
                    "ok": False,
                    "error": "GEMINI_API_KEY environment variable not set. Cannot perform intelligent orchestration.",
                    "suggestion": "Set GEMINI_API_KEY in your .env file to enable this feature."
                }

            # Gemini REST API endpoint
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

            headers = {"Content-Type": "application/json"}

            data = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 500,
                    "responseMimeType": "application/json"
                }
            }

            req = urllib.request.Request(
                gemini_url,
                data=json.dumps(data).encode('utf-8'),
                headers=headers
            )

            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                llm_response = result["candidates"][0]["content"]["parts"][0]["text"]

                # Parse LLM response - extract JSON
                import re
                json_match = re.search(r'\{.*\}', llm_response, re.DOTALL)
                if json_match:
                    plan = json.loads(json_match.group())
                else:
                    plan = json.loads(llm_response)
                
                selected_playbooks = plan.get("playbooks", [])
                reasoning = plan.get("reasoning", "")
                order_rationale = plan.get("execution_order_rationale", "")
                
                if not selected_playbooks:
                    return {
                        "ok": False,
                        "error": "No suitable playbooks found for the request",
                        "reasoning": reasoning,
                        "user_request": user_request
                    }
                
                # If dry_run, return the plan without executing
                if dry_run:
                    return {
                        "ok": True,
                        "dry_run": True,
                        "user_request": user_request,
                        "execution_plan": {
                            "playbooks": selected_playbooks,
                            "reasoning": reasoning,
                            "execution_order_rationale": order_rationale,
                            "limit": limit,
                            "tags": tags,
                            "extra_vars": extra_vars
                        }
                    }
                
                # Execute the playbooks
                execution_result = self.tool_run_playbooks({
                    "playbooks": selected_playbooks,
                    "limit": limit,
                    "tags": tags,
                    "extra_vars": extra_vars,
                    "stop_on_failure": True
                })
                
                return {
                    "ok": execution_result.get("ok", False),
                    "user_request": user_request,
                    "execution_plan": {
                        "playbooks": selected_playbooks,
                        "reasoning": reasoning,
                        "execution_order_rationale": order_rationale
                    },
                    "execution_results": execution_result
                }
                
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else str(e)
            return {
                "ok": False,
                "error": f"LLM API error: {e.code} - {error_body}"
            }
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to perform intelligent orchestration: {str(e)}"
            }

    def tool_get_playbook_info(self, args: Dict[str, Any]) -> Dict[str, Any]:
        pb_path = self._resolve_playbook(args["playbook"])
        try:
            return {"ok": True, "info": self._extract_playbook_info(pb_path)}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def tool_check_service_status(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Check if a service is installed and running."""
        service_name = args["service_name"].strip().lower()
        
        # Map common service names
        service_map = {
            "postgresql": "postgresql",
            "postgres": "postgresql",
            "pg": "postgresql",
            "sql": "postgresql",
        }
        
        actual_service = service_map.get(service_name, service_name)
        
        # Check if package is installed
        # For PostgreSQL, check both postgresql and postgresql-server packages
        if actual_service == "postgresql":
            pkg_res1 = _run(["rpm", "-q", "postgresql"], cwd=self.project_root)
            pkg_res2 = _run(["rpm", "-q", "postgresql-server"], cwd=self.project_root)
            installed = pkg_res1["returncode"] == 0 and pkg_res2["returncode"] == 0
        else:
            pkg_res = _run(["rpm", "-q", actual_service], cwd=self.project_root)
            installed = pkg_res["returncode"] == 0
        
        # Check service status
        service_res = _run(["systemctl", "is-active", actual_service], cwd=self.project_root)
        is_running = service_res["returncode"] == 0 and service_res["stdout"].strip() == "active"
        
        # Check if service is enabled
        enabled_res = _run(["systemctl", "is-enabled", actual_service], cwd=self.project_root)
        is_enabled = enabled_res["returncode"] == 0 and "enabled" in enabled_res["stdout"]
        
        # Try to get version if installed
        version = None
        if installed and actual_service == "postgresql":
            version_res = _run(["postgres", "--version"], cwd=self.project_root)
            if version_res["returncode"] == 0:
                version = version_res["stdout"].strip()
        
        status = {
            "service": actual_service,
            "installed": installed,
            "running": is_running,
            "enabled": is_enabled,
            "version": version,
        }
        
        # Create human-readable summary
        summary_parts = []
        if installed:
            summary_parts.append(f"{actual_service} is installed")
            if version:
                summary_parts.append(f"version: {version}")
        else:
            summary_parts.append(f"{actual_service} is NOT installed")
            
        if is_running:
            summary_parts.append("and is currently running")
        elif installed:
            summary_parts.append("but is NOT currently running")
            
        if is_enabled:
            summary_parts.append("and is enabled to start on boot")
        elif installed:
            summary_parts.append("and is NOT enabled to start on boot")
        
        status["summary"] = ". ".join(summary_parts) + "."
        
        return {"ok": True, "status": status}

    def tool_check_https_endpoint(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Check if an HTTPS endpoint is reachable and healthy."""
        import urllib.request
        import ssl
        
        url = args["url"].strip()
        validate_certs = args.get("validate_certs", False)
        
        if not url.startswith("https://"):
            return {
                "ok": False,
                "error": f"URL must start with https:// (got: {url})",
            }
        
        try:
            # Create SSL context
            ssl_context = ssl.create_default_context()
            if not validate_certs:
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
            
            # Make HTTPS request
            req = urllib.request.Request(url)
            req.add_header("User-Agent", "MCP-HTTPS-Health-Check/1.0")
            
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
                    status_code = response.getcode()
                    content = response.read().decode("utf-8", errors="replace")
                    headers = dict(response.headers)
                    
                    result = {
                        "url": url,
                        "status_code": status_code,
                        "healthy": status_code == 200,
                        "content": content[:500],  # Limit content length
                        "content_length": len(content),
                        "headers": {k: v for k, v in list(headers.items())[:10]},  # Limit headers
                    }
                    
                    # Create summary
                    if status_code == 200:
                        summary = f"HTTPS endpoint {url} is healthy (HTTP {status_code})"
                        if content.strip():
                            summary += f". Response: {content.strip()[:100]}"
                    else:
                        summary = f"HTTPS endpoint {url} returned HTTP {status_code}"
                    
                    return {"ok": True, "result": result, "summary": summary}
                    
            except urllib.error.HTTPError as e:
                return {
                    "ok": True,
                    "result": {
                        "url": url,
                        "status_code": e.code,
                        "healthy": False,
                        "error": str(e),
                    },
                    "summary": f"HTTPS endpoint {url} returned HTTP {e.code}: {e.reason}",
                }
            except urllib.error.URLError as e:
                return {
                    "ok": False,
                    "error": f"Failed to connect to {url}: {str(e)}",
                }
            except Exception as e:
                return {
                    "ok": False,
                    "error": f"Error checking HTTPS endpoint: {str(e)}",
                }
                
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to check HTTPS endpoint: {str(e)}",
            }

    def handle_tools_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if name not in self.tools:
            raise ValueError("unknown tool")
        if name == "list_inventory":
            return self.tool_list_inventory()
        if name == "list_playbooks":
            return self.tool_list_playbooks()
        if name == "list_playbooks_with_summary":
            return self.tool_list_playbooks_with_summary()
        if name == "list_reports":
            return self.tool_list_reports(args)
        if name == "read_report_file":
            return self.tool_read_report_file(args)
        if name == "list_backups":
            return self.tool_list_backups(args)
        if name == "read_backup_file":
            return self.tool_read_backup_file(args)
        if name == "summarize_unused_ports_reports":
            return self.tool_summarize_unused_ports_reports(args)
        if name == "read_playbook_file":
            return self.tool_read_playbook_file(args)
        if name == "get_playbook_info":
            return self.tool_get_playbook_info(args)
        if name == "check_service_status":
            return self.tool_check_service_status(args)
        if name == "check_https_endpoint":
            return self.tool_check_https_endpoint(args)
        if name == "run_playbook":
            return self.tool_run_playbook(args)
        if name == "run_playbook_check":
            return self.tool_run_playbook_check(args)
        if name == "run_playbooks":
            return self.tool_run_playbooks(args)
        if name == "intelligent_playbook_orchestration":
            return self.tool_intelligent_playbook_orchestration(args)
        raise ValueError("tool not implemented")


def main() -> None:
    load_dotenv()
    project_root_raw = os.getenv("ANSIBLE_PROJECT_ROOT")
    if not project_root_raw:
        _eprint("ANSIBLE_PROJECT_ROOT is required")
        sys.exit(2)

    project_root = Path(project_root_raw)
    if not project_root.is_dir():
        _eprint("ANSIBLE_PROJECT_ROOT does not exist or is not a directory")
        sys.exit(2)

    # Debug: Print the project root being used
    _eprint(f"DEBUG: ANSIBLE_PROJECT_ROOT={project_root}")
    _eprint(f"DEBUG: Inventory will be at: {project_root / 'inventory' / 'inventory.yml'}")

    # Optional: colon-separated list of extra playbook directories to also scan
    extra_playbooks_dirs: List[Path] = []
    extra_raw = os.getenv("EXTRA_PLAYBOOKS_DIRS", "")
    for raw_dir in extra_raw.split(":"):
        raw_dir = raw_dir.strip()
        if raw_dir:
            p = Path(raw_dir)
            if p.is_dir():
                extra_playbooks_dirs.append(p)
            else:
                _eprint(f"EXTRA_PLAYBOOKS_DIRS: skipping non-existent dir: {raw_dir}")

    server = AnsibleMcpServer(project_root=project_root, extra_playbooks_dirs=extra_playbooks_dirs)

    for req in _read_json_lines():
        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params") or {}

        if method == "initialize":
            result = {
                "protocolVersion": params.get("protocolVersion", "unknown"),
                "serverInfo": {"name": "ansible-mcp-poc", "version": "0.1.0"},
                "capabilities": {"tools": {}},
                "instructions": "Allow-listed Ansible actions only. Project restricted to ANSIBLE_PROJECT_ROOT.",
            }
            _write(_jsonrpc_result(req_id, result))
            continue

        try:
            if method == "tools/list":
                _write(_jsonrpc_result(req_id, server.handle_tools_list()))
            elif method == "tools/call":
                name = params.get("name")
                args = params.get("arguments") or {}
                if not isinstance(name, str):
                    raise ValueError("params.name must be a string")
                if not isinstance(args, dict):
                    raise ValueError("params.arguments must be an object")
                out = server.handle_tools_call(name, args)
                _write(_jsonrpc_result(req_id, {"content": [{"type": "text", "text": json.dumps(out)}]}))
            else:
                _write(_jsonrpc_error(req_id, -32601, "Method not found"))
        except FileNotFoundError as exc:
            _write(_jsonrpc_error(req_id, -32004, str(exc)))
        except ValueError as exc:
            _write(_jsonrpc_error(req_id, -32602, str(exc)))
        except subprocess.TimeoutExpired:
            _write(_jsonrpc_error(req_id, -32001, "Command timed out"))
        except Exception as exc:  # noqa: BLE001
            _write(_jsonrpc_error(req_id, -32000, "Internal error", data=str(exc)))


if __name__ == "__main__":
    main()


