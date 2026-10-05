#!/usr/bin/env python3
"""Create a reviewable source inventory; does not boot Rails or contact Canvas.

Usage: python3 inventory_canvas.py --source /path/to/canvas-lms --output ./inventory
Python standard library only. The source is never modified. Static route parsing
is deliberately conservative: unresolved interpolation and Ruby DSL constructs
are emitted as diagnostics, never silently advertised as callable endpoints.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import itertools
import json
from pathlib import Path
import re
import subprocess


REPO = "https://github.com/instructure/canvas-lms"
LIMITATIONS = [
    "This is a source inventory, not implemented MCP tools or a live API contract.",
    "Controller @API tags and checked-in GraphQL schema are scanned exhaustively within the listed source roots.",
    "Route matching statically handles explicit verb declarations within ApiRouteSet blocks, controller scopes, simple %w loops, and tuple %w loops. It does not execute Ruby.",
    "Computed path prefixes, resources/concerns, route-generating helper methods, plugins loaded at runtime, conditions, and arbitrary interpolation require runtime validation; unresolved records remain in diagnostics.",
    "Even resolved static routes may depend on feature flags, deployment version, permissions, installed plugins, and account configuration.",
    "HTTP verbs do not prove read-only semantics; some GET actions mutate state. Review each tool's controller before exposing it.",
    "Undocumented routes are not assumed public or stable. LTI uses a separate authorization and service model.",
    "GraphQL field existence does not imply REST parity, universal role access, or a stable endpoint in a different Canvas deployment.",
    "The authoritative next step is Canvas's doc:openapi task inside its configured web container, with its Rails environment and database available.",
]


def git_value(source: Path, *args: str) -> str | None:
    result = subprocess.run(["git", "-C", str(source), *args], text=True, capture_output=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def source_ref(path: Path, source: Path, line: int, revision: str | None) -> dict:
    rel = path.relative_to(source).as_posix()
    return {"file": rel, "line": line, "url": f"{REPO}/blob/{revision or 'master'}/{rel}#L{line}"}


def controller_inventory(source: Path, revision: str | None) -> tuple[list, list, list]:
    paths = sorted(set(source.glob("app/controllers/**/*_controller.rb")) |
                   set(source.glob("gems/plugins/*/app/controllers/**/*_controller.rb")) |
                   set(source.glob("vendor/plugins/*/app/controllers/**/*_controller.rb")))
    groups, operations, unmatched = [], [], []
    for path in paths:
        lines = path.read_text().splitlines()
        controller = str(path).split("/app/controllers/", 1)[1].removesuffix("_controller.rb")
        group, subtopic = None, None
        for index, line in enumerate(lines):
            tag = re.match(r"\s*#\s*@API\s+(.+)", line)
            if not tag:
                continue
            end = index + 1
            while end < len(lines) and (not lines[end].strip() or lines[end].lstrip().startswith("#")):
                end += 1
            declaration = lines[end].strip() if end < len(lines) else ""
            block = "\n".join(lines[index:end])
            record = {"title": tag[1].strip(), "controller": controller,
                      "source": source_ref(path, source, index + 1, revision)}
            topic = re.search(r"@subtopic\s+(.+)", block)
            if declaration.startswith(("class ", "module ")):
                group = record["title"]
                subtopic = topic[1].strip() if topic else None
                groups.append({**record, "subtopic": subtopic})
            elif match := re.match(r"def\s+(?:self\.)?([\w!?]+)", declaration):
                record.update({"group": group, "subtopic": subtopic, "action": match[1],
                               "declaration_line": end + 1,
                               "arguments": re.findall(r"@argument\s+([^\n]+)", block),
                               "returns": re.findall(r"@returns?\s+([^\n]+)", block)})
                operations.append(record)
            else:
                unmatched.append({**record, "following_declaration": declaration})
    return groups, operations, unmatched


def option(statement: str, name: str) -> str | None:
    match = re.search(rf"\b{name}:\s*(?::([\w/]+)|[\"']([^\"']+)[\"'])", statement)
    return next((value for value in match.groups() if value is not None), None) if match else None


def interpolate(value: str, bindings: dict) -> str:
    def replacement(match):
        expression = match[1]
        if expression in bindings:
            return bindings[expression]
        if expression.endswith(".pluralize") and expression[:-10] in bindings:
            # These words are the current route-loop vocabulary; no pretend
            # generic implementation of Rails's full inflection system.
            word = bindings[expression[:-10]]
            if word in {"course", "section", "group", "user", "account"}:
                return word + "s"
        return match[0]
    return re.sub(r"#\{([^}]+)\}", replacement, value)


def route_inventory(source: Path, revision: str | None) -> tuple[list, list, list]:
    paths = sorted(set([source / "config/routes.rb"]) |
                   set(source.glob("gems/plugins/*/config/*routes.rb")) |
                   set(source.glob("vendor/plugins/*/config/*routes.rb")))
    routes, diagnostics, declarations = [], [], []
    for path in paths:
        lines, stack = path.read_text().splitlines(), []
        for index, line in enumerate(lines):
            clean = line.strip()
            if not clean or clean.startswith("#"):
                continue
            indent = len(line) - len(line.lstrip())
            while stack and stack[-1]["indent"] >= indent:
                stack.pop()
            state = {"prefix": None, "controller": None, "bindings": [{}], "conditions": []}
            for frame in stack:
                state.update({key: value for key, value in frame.items() if key != "indent"})
            if "ApiRouteSet" in clean and ".draw(" in clean:
                prefix_match = re.search(r"ApiRouteSet\.draw\([^,]+,\s*[\"']([^\"']+)", clean)
                prefix = "/api/v1" if "ApiRouteSet::V1" in clean else (prefix_match[1] if prefix_match else None)
                stack.append({"indent": indent, "prefix": prefix})
                continue
            if not state["prefix"]:
                continue
            if clean.startswith("scope"):
                controller = option(clean, "controller")
                if controller:
                    stack.append({"indent": indent, "controller": controller})
                else:
                    diagnostics.append({"kind": "unsupported_scope", "statement": clean,
                                        "source": source_ref(path, source, index + 1, revision)})
                continue
            if ".each do" in clean:
                simple = re.fullmatch(r"%w\[([^]]+)\]\.each do \|(\w+)\|", clean)
                tuples = re.fullmatch(r"\[(.+)\]\.each do \|\(([^)]+)\)\|", clean)
                values = []
                if simple:
                    values = [{simple[2]: word} for word in simple[1].split()]
                elif tuples:
                    names = [name.strip() for name in tuples[2].split(",")]
                    values = [dict(zip(names, row.split())) for row in re.findall(r"%w\[([^]]+)\]", tuples[1])]
                if values:
                    bindings = [{**outer, **inner} for outer, inner in itertools.product(state["bindings"], values)]
                    stack.append({"indent": indent, "bindings": bindings})
                else:
                    diagnostics.append({"kind": "unsupported_loop", "statement": clean,
                                        "source": source_ref(path, source, index + 1, revision)})
                continue
            if clean.startswith(("if ", "unless ", "case ", "def ")):
                stack.append({"indent": indent, "conditions": state["conditions"] + [clean]})
            if clean.startswith(("resources ", "resource ", "concerns ", "def ")):
                diagnostics.append({"kind": "ruby_dsl_requires_runtime", "statement": clean,
                                    "source": source_ref(path, source, index + 1, revision)})
            match = re.match(r"(get|put|post|delete|patch|options|head|match)\s+[\"'](.*?)[\"'](?:,|\s*=>|\s*$)", clean)
            if not match:
                continue
            statement, stop = clean, index + 1
            while statement.rstrip().endswith(",") and stop < len(lines):
                statement += " " + lines[stop].strip()
                stop += 1
            controller = option(statement, "controller") or state["controller"]
            action = option(statement, "action")
            target = option(statement, "to")
            if target and "#" in target:
                controller, action = target.split("#", 1)
            declaration = {"method": match[1].upper(), "path_expression": match[2],
                           "controller": controller, "action": action, "statement": statement,
                           "source": source_ref(path, source, index + 1, revision)}
            declarations.append(declaration)
            for bindings in state["bindings"]:
                path_value = interpolate(match[2], bindings)
                resolved = "#{" not in path_value and controller is not None and action is not None
                # match() is forwarded to Rails instead of ApiRouteSet#route and
                # therefore does not receive the automatic prefix.
                methods = [match[1].upper()]
                if match[1] == "match":
                    via = re.search(r"via:\s*\[([^]]+)\]", statement)
                    methods = re.findall(r":(\w+)", via[1]) if via else ["UNKNOWN"]
                for method in methods:
                    record = {**declaration, "method": method.upper(),
                              "path": path_value if match[1] == "match" else state["prefix"] + "/" + path_value,
                              "bindings": bindings, "conditions": state["conditions"],
                              "resolution": "static" if resolved else "unresolved",
                              "surface": "lti" if state["prefix"].startswith("/api/lti") else
                                         "sis" if state["prefix"] == "/api/sis" else "rest"}
                    routes.append(record)
                    if not resolved:
                        diagnostics.append({"kind": "unresolved_route", **record})
    return routes, diagnostics, declarations


def graphql_inventory(source: Path, revision: str | None) -> dict:
    path = source / "schema.graphql"
    roots, definitions = defaultdict(list), Counter()
    current, in_description = None, False
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if line.strip().startswith('"""'):
            if line.count('"""') == 1:
                in_description = not in_description
            continue
        if in_description:
            continue
        if match := re.match(r"^(type|input|enum|interface|union|scalar)\s+(\w+)", line):
            definitions[match[1]] += 1
            current = match[2] if match[2] in {"Query", "Mutation", "Subscription"} else None
        if line == "}":
            current = None
        if current and (match := re.match(r"^  (\w+)(?:\(|:)", line)):
            roots[current].append({"name": match[1], "source": source_ref(path, source, number, revision)})
    return {"root_fields": dict(roots), "definition_counts": dict(definitions)}


def write_outputs(source: Path, output: Path) -> dict:
    revision = git_value(source, "rev-parse", "HEAD")
    groups, operations, unmatched = controller_inventory(source, revision)
    routes, diagnostics, declarations = route_inventory(source, revision)
    graphql = graphql_inventory(source, revision)
    by_action = defaultdict(list)
    for route in routes:
        by_action[(route["controller"], route["action"])].append(route)
    for operation in operations:
        operation["routes"] = by_action[(operation["controller"], operation["action"])]
        operation["coverage"] = "matched_static" if any(route["resolution"] == "static" for route in operation["routes"]) else "needs_route_review"
    documented = {(item["controller"], item["action"]) for item in operations}
    events = [{"name": path.stem, "source": source_ref(path, source, 1, revision)}
              for path in sorted(source.glob("doc/api/data_services/json/canvas/event-types/*.json"))]
    counts = {"api_group_annotations": len(groups), "distinct_api_groups": len({group["title"] for group in groups}),
              "documented_operations": len(operations), "matched_documented_operations": sum(item["coverage"] == "matched_static" for item in operations),
              "route_declarations": len(declarations), "expanded_route_records": len(routes),
              "resolved_static_route_records": sum(route["resolution"] == "static" for route in routes),
              "unresolved_route_records": sum(route["resolution"] != "static" for route in routes),
              "route_records_without_api_annotation": sum((route["controller"], route["action"]) not in documented for route in routes),
              "unclassified_api_annotations": len(unmatched), "graphql_query_fields": len(graphql["root_fields"].get("Query", [])),
              "graphql_mutation_fields": len(graphql["root_fields"].get("Mutation", [])), "canvas_event_types": len(events)}
    data = {"schema_version": 1, "upstream": REPO, "source_revision": revision,
            "generation_command": "python3 inventory_canvas.py --source /path/to/canvas-lms --output ./inventory",
            "limitations": LIMITATIONS, "counts": counts, "groups": groups, "operations": operations,
            "routes": routes, "route_diagnostics": diagnostics, "unclassified_annotations": unmatched,
            "graphql": graphql, "canvas_live_event_types": events}
    output.mkdir(parents=True, exist_ok=True)
    (output / "canvas-inventory.json").write_text(json.dumps(data, indent=2) + "\n")
    with (output / "documented-endpoints.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["group", "subtopic", "title", "controller", "action", "surface", "method", "path", "resolution", "documentation_source", "route_source"])
        for operation in operations:
            for route in operation["routes"] or [{}]:
                writer.writerow([operation["group"], operation["subtopic"], operation["title"], operation["controller"], operation["action"],
                                 route.get("surface", ""), route.get("method", ""), route.get("path", ""), route.get("resolution", "unmatched"),
                                 operation["source"]["url"], route.get("source", {}).get("url", "")])
    lines = ["# Canvas source inventory", "", f"Pinned upstream: `{revision}` from [{REPO}]({REPO}).", "",
             "Generated without booting Rails or contacting a live institution. Counts describe source evidence, not delivered MCP tools.", "",
             "| Metric | Count |", "| --- | ---: |"]
    lines.extend(f"| {key.replace('_', ' ')} | {value} |" for key, value in counts.items())
    lines.extend(["", "## Coverage limits", ""] + [f"- {item}" for item in LIMITATIONS])
    lines.extend(["", "## Documented capability groups", "", "All discovered group names appear below. Role eligibility must be checked at runtime; group names are not permission grants.", "",
                  "| Group | Documented actions | Statically matched | Controllers |", "| --- | ---: | ---: | --- |"])
    for group in sorted({item["title"] for item in groups} | {item["group"] or "(Ungrouped source annotations)" for item in operations}):
        members = [item for item in operations if (item["group"] or "(Ungrouped source annotations)") == group]
        controllers = sorted({item["controller"] for item in members} | {item["controller"] for item in groups if item["title"] == group})
        lines.append(f"| {group} | {len(members)} | {sum(item['coverage'] == 'matched_static' for item in members)} | {', '.join('`' + name + '`' for name in controllers)} |")
    lines.extend(["", "## Documented actions needing route review", ""])
    for item in operations:
        if item["coverage"] != "matched_static":
            lines.append(f"- [{item['controller']}#{item['action']}]({item['source']['url']}): {item['title']}")
    lines.extend(["", "## GraphQL entry points", ""])
    for root, fields in graphql["root_fields"].items():
        lines.extend([f"### {root}", "", ", ".join(f"[`{field['name']}`]({field['source']['url']})" for field in fields), ""])
    lines.extend(["## Canvas Live Events names", "", ", ".join(f"`{event['name']}`" for event in events), "",
                  "## Regenerate", "", "```sh", "python3 inventory_canvas.py --source /path/to/canvas-lms --output ./inventory", "```", "",
                  "The JSON includes all parsed route declarations, conditions, unresolved records, argument annotations, exact source locations, GraphQL roots, and event definitions. The CSV is a review worksheet; unmatched actions retain a row.", ""])
    (output / "inventory-summary.md").write_text("\n".join(lines))
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Local Canvas LMS source checkout (read only)")
    parser.add_argument("--output", type=Path, required=True, help="Directory for JSON, CSV, and Markdown output")
    args = parser.parse_args()
    if not (args.source / "config/routes.rb").is_file() or not (args.source / "schema.graphql").is_file():
        parser.error("--source must point to a Canvas LMS checkout containing config/routes.rb and schema.graphql")
    print(json.dumps(write_outputs(args.source.resolve(), args.output.resolve()), indent=2))


if __name__ == "__main__":
    main()
