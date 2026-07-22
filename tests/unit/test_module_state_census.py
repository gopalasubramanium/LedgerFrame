# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-54 F-10 (2e) — the permanent census guard.

AST-sweeps `app/` for module-level MUTABLE state that is written at runtime — a mutable container
assigned at module scope and later mutated (subscript/aug-assign/mutating method), or a name
reassigned via `global` — and asserts every such global is declared in the reset registry
(`tests/isolation.RESET_REGISTRY`).

This is the anti-regrow guard: a NEW module-level mutable global written at runtime, without a reset
entry, turns this RED — so the test-isolation debt class F-10 fixed can never silently return. The
reset list is thus an ENUMERATION derived from the sweep, never from memory (ruled shape 2a/2e).

Blindness pin: the sweep must find the known anchors (else the walker is broken and would pass
vacuously by protecting nothing).
"""
from __future__ import annotations

import ast
import pathlib

from tests.isolation import RESET_REGISTRY

APP = pathlib.Path(__file__).resolve().parents[2] / "app"
_MUTABLE_CTORS = {"dict", "list", "set", "defaultdict", "deque", "OrderedDict", "Counter"}
_MUTATORS = {"append", "extend", "clear", "update", "add", "pop", "setdefault",
             "insert", "remove", "discard", "popitem", "sort"}


def _module_name(path: pathlib.Path) -> str:
    rel = path.relative_to(APP.parent).with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _module_level_mutable_names(tree: ast.Module) -> dict[str, str]:
    out: dict[str, str] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            targets, value = node.targets, node.value
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            targets, value = [node.target], node.value
        else:
            continue
        kind = None
        if isinstance(value, (ast.Dict, ast.List, ast.Set, ast.ListComp, ast.DictComp, ast.SetComp)):
            kind = type(value).__name__
        elif isinstance(value, ast.Call):
            fn = value.func
            name = fn.id if isinstance(fn, ast.Name) else (fn.attr if isinstance(fn, ast.Attribute) else "")
            if name in _MUTABLE_CTORS:
                kind = name
        if kind:
            for t in targets:
                if isinstance(t, ast.Name):
                    out[t.id] = kind
    return out


def _runtime_written(tree: ast.Module, names: set[str]) -> set[str]:
    """Names (from `names`, plus module-level scalars) written INSIDE a function — runtime state."""
    written: set[str] = set()
    module_scalar_targets: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            module_scalar_targets.add(node.target.id)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    module_scalar_targets.add(t.id)

    class V(ast.NodeVisitor):
        def __init__(self) -> None:
            self.depth = 0

        def visit_FunctionDef(self, n: ast.AST) -> None:
            self.depth += 1
            self.generic_visit(n)
            self.depth -= 1

        visit_AsyncFunctionDef = visit_FunctionDef

        def _hit(self, name: str) -> None:
            if self.depth > 0 and name in names:
                written.add(name)

        def visit_Global(self, n: ast.Global) -> None:
            # a name reassigned via `global` inside a function is runtime state
            for nm in n.names:
                if nm in module_scalar_targets or nm in names:
                    written.add(nm)
            self.generic_visit(n)

        def visit_Assign(self, n: ast.Assign) -> None:
            for t in n.targets:
                if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name):
                    self._hit(t.value.id)
            self.generic_visit(n)

        def visit_AugAssign(self, n: ast.AugAssign) -> None:
            t = n.target
            if isinstance(t, ast.Name):
                self._hit(t.id)
            elif isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name):
                self._hit(t.value.id)
            self.generic_visit(n)

        def visit_Call(self, n: ast.Call) -> None:
            f = n.func
            if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.attr in _MUTATORS:
                self._hit(f.value.id)
            self.generic_visit(n)

    V().visit(tree)
    return written


def _cached_functions(tree: ast.Module) -> set[str]:
    """Module-level functions decorated with `@lru_cache`/`@cache` — process-global mutable state
    that is NOT a module-level assignment, so the assignment sweep misses it. It leaks across tests
    exactly like a cache dict (F-10 Class C: `get_settings`'s cached `base_currency`)."""
    out: set[str] = set()
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            name = None
            if isinstance(dec, ast.Name):
                name = dec.id
            elif isinstance(dec, ast.Attribute):
                name = dec.attr
            elif isinstance(dec, ast.Call):  # @lru_cache(maxsize=...)
                f = dec.func
                name = f.id if isinstance(f, ast.Name) else (f.attr if isinstance(f, ast.Attribute) else None)
            if name in {"lru_cache", "cache"}:
                out.add(node.name)
    return out


def _sweep() -> set[str]:
    found: set[str] = set()
    for path in sorted(APP.rglob("*.py")):
        try:
            tree = ast.parse(path.read_text())
        except SyntaxError:
            continue
        names = _module_level_mutable_names(tree)
        mod = _module_name(path)
        for name in _runtime_written(tree, set(names)):
            found.add(f"{mod}.{name}")
        for fn in _cached_functions(tree):
            found.add(f"{mod}.{fn}")
    return found


def test_every_runtime_mutated_module_global_has_a_reset_entry() -> None:
    found = _sweep()

    # Blindness pin: the sweep must locate the known anchors, or it is broken and would pass vacuously.
    anchors = {"app.services.fx._CACHE", "app.services.ecb_fx._RATES", "app.core.ratelimit._STATE"}
    missing_anchors = anchors - found
    assert not missing_anchors, (
        f"census sweep is broken — it did not find known runtime-mutated globals {missing_anchors}; "
        "a passing census here would be vacuous (F-10 blindness pin)"
    )

    undeclared = found - set(RESET_REGISTRY)
    assert not undeclared, (
        "NEW module-level mutable process state is not in tests/isolation.RESET_REGISTRY:\n  "
        + "\n  ".join(sorted(undeclared))
        + "\n\nEvery module global written at runtime must declare how it is reset between tests, or "
        "the F-10 test-isolation debt regrows silently. Add a reset (and wire it into "
        "reset_process_globals / an engine fixture) and register it."
    )

    # Keep the registry honest too: no stale entry that the sweep no longer sees.
    stale = set(RESET_REGISTRY) - found
    assert not stale, (
        "RESET_REGISTRY lists globals the census no longer finds (renamed/removed?): "
        + ", ".join(sorted(stale))
    )
