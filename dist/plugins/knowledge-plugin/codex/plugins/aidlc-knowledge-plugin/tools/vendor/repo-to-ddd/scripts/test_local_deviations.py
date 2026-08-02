"""Regression tests for knowledge-plugin's LOCAL deviations from vendored s_repo-to-ddd.

WHY A SEPARATE FILE. `test_ai_ready_helpers.py` is upstream's suite and is replaced
wholesale when the vendored engine is refreshed. Our fixes live inside upstream's
`ai_ready_helpers.py` (unavoidable — that is where the bugs are), so a re-vendor can
silently revert them. Keeping the tests HERE means a refresh that loses a fix fails
loudly on the next `aidlc-ai-ready-gen.ts test` run instead of quietly regressing.

Each test names the finding id from the CraftAI field test (2026-07-29) that motivated
it. Deviation inventory: ../VENDORED.md.

Every finding covered here shares one shape: the pipeline reported SUCCESS over empty
or wrong content. That is why these are tests and not just fixes — a silent-empty
regression is invisible in a green run.
"""

import pytest

from scripts.ai_ready_helpers import (
    _anchor_file_part,
    _fmt_assertion_row,
    _fmt_line_range,
    _render_domain_business_rules,
    blind_spot_scan,
    check_llm_assertion_guards,
    compute_business_rules_dimension,
    project_domain_skeleton,
    regenerate_spec_preserving_human,
)


def _rule(text="订单金额超过 5 万需二级审批", verified=True, **kw):
    r = {"rule": text, "verified": verified}
    if verified:
        r["anchor"] = kw.pop("anchor", "src/order/approve.py:88-102")
    else:
        r["absence_evidence"] = kw.pop("absence_evidence", "grep -rn 'secondLevel' src/ → 0")
    r.update(kw)
    return r


# ─── C1 (P0): domain-level business_rules must reach §5 ───────────────────────

class TestC1DomainRulesRendered:
    """The owning stage asks a senior to sign off rule-by-rule. §5 used to render
    only the [human] stub, so the sign-off package was blank while the completion
    message quoted a rule count nothing in the artifact could corroborate."""

    def _dom(self, rules):
        return {"id": "domain:orders", "name": "Orders", "summary": "s",
                "business_rules": rules}

    def test_rules_appear_in_section_5(self):
        md = project_domain_skeleton(self._dom([_rule()]), [], [])
        five = md.split("## 5.")[1].split("## 6.")[0]
        assert "订单金额超过 5 万需二级审批" in five, "domain business_rules must render in §5"

    def test_counts_line_carries_the_knowledge_maturity_numbers(self):
        rules = [_rule("A"), _rule("B", verified=False), _rule("C", verified=False)]
        five = project_domain_skeleton(self._dom(rules), [], []).split("## 5.")[1].split("## 6.")[0]
        assert "规则总数:3" in five
        assert "verified(已带锚点、待人工裁决):1" in five
        assert "unverified(需 senior 确认):2" in five

    def test_honesty_labels_preserved_not_rendered_as_fact(self):
        rules = [_rule("anchored one"), _rule("unadjudicated one", verified=False)]
        five = project_domain_skeleton(self._dom(rules), [], []).split("## 5.")[1].split("## 6.")[0]
        assert "[llm-claim] anchored one (anchor: `src/order/approve.py:88-102`)" in five
        assert "[llm-inferred] unadjudicated one" in five

    def test_empty_rule_set_says_zero_rather_than_rendering_nothing(self):
        """'no rules extracted' and 'the renderer dropped them' must not look alike —
        that indistinguishability IS the finding."""
        out = _render_domain_business_rules({"business_rules": []})
        assert any("规则总数:0" in ln for ln in out)

    def test_human_stub_still_present_so_ownership_boundary_survives(self):
        md = project_domain_skeleton(self._dom([_rule()]), [], [])
        assert "`[human]`" in md
        assert "待人工增补" in md

    def test_multiline_rule_text_cannot_break_the_list(self):
        md = project_domain_skeleton(self._dom([_rule("line one\nline two")]), [], [])
        five = md.split("## 5.")[1].split("## 6.")[0]
        assert "line one line two" in five
        rule_lines = [ln for ln in five.split("\n") if ln.startswith("1. ")]
        assert len(rule_lines) == 1, "a multi-line rule must flatten into ONE list item"

    def test_regen_with_human_blocks_keeps_the_machine_rules(self):
        """The preservation feature must not delete the other half of §5. Before the
        fix, adding one [human] block wiped every freshly rendered machine rule."""
        dom = self._dom([_rule("machine rule survives")])
        first = project_domain_skeleton(dom, [], [])
        edited = first.replace(
            "_(待人工增补 `[human]` 业务规则)_",
            "- `[human]` 客户承诺:T+1 结算",
        )
        out = regenerate_spec_preserving_human(edited, dom, [], [])
        assert "machine rule survives" in out, "machine-rendered rules must survive regen"
        assert "客户承诺:T+1 结算" in out, "human block must survive regen"
        assert "待人工增补" not in out, "the stub is replaced once a real human block exists"

    def test_regen_is_idempotent_with_both_halves_present(self):
        dom = self._dom([_rule("machine rule")])
        edited = project_domain_skeleton(dom, [], []).replace(
            "_(待人工增补 `[human]` 业务规则)_", "- `[human]` 人工规则",
        )
        once = regenerate_spec_preserving_human(edited, dom, [], [])
        twice = regenerate_spec_preserving_human(once, dom, [], [])
        assert once == twice, "regeneration must converge, not accumulate"


# ─── C2 (P0): blind_spot_scan must not fail open ──────────────────────────────

class TestC2BlindSpotShapeMismatch:
    """A clean report over a silently emptied set is indistinguishable from a
    genuinely clean scan — over the only reverse-coverage check in the pipeline."""

    def test_raises_when_spans_declared_but_none_carry_file_path(self):
        doc = {
            "steps": [], "domains": [],
            "risk_areas": [{"name": "auth", "file": "src/auth.py", "risk_score": 9}],
            "hot_zones": [{"name": "db", "file": "src/db.py", "callers": 40}],
        }
        with pytest.raises(ValueError) as ei:
            blind_spot_scan(doc)
        msg = str(ei.value)
        assert "file_path" in msg, "the error must name the field that was missing"
        assert "clean:True" in msg, "the error must say what it refused to publish"

    def test_genuinely_empty_input_is_still_a_valid_clean_scan(self):
        """Zero findings over zero declared spans is honest — do not over-raise."""
        scan = blind_spot_scan({"steps": [], "domains": [], "risk_areas": [], "hot_zones": []})
        assert scan["clean"] is True
        assert scan["total_risky"] == 0

    def test_correct_shape_reports_real_blind_spots(self):
        doc = {
            "steps": [{"file_path": "src/documented.py"}],
            "domains": [],
            "risk_areas": [
                {"name": "ok", "file_path": "src/documented.py", "reason": "r"},
                {"name": "blind", "file_path": "src/undocumented.py", "reason": "r"},
            ],
            "hot_zones": [],
        }
        scan = blind_spot_scan(doc)
        assert scan["total_risky"] == 2
        assert scan["blind"] == 1
        assert scan["clean"] is False


# ─── M1: rule anchors carry a line-spec; compare file-to-file ─────────────────

class TestM1AnchorFileComparison:
    def test_rule_anchor_documents_its_file(self):
        """documented iff step OR business_rule anchor — the docstring's promise. The
        anchor half never matched, so blind spots were systematically over-counted."""
        doc = {
            "steps": [],
            "domains": [{"id": "d", "business_rules": [_rule(anchor="src/risky.py:42")]}],
            "risk_areas": [{"name": "risky", "file_path": "src/risky.py", "reason": "r"}],
            "hot_zones": [],
        }
        scan = blind_spot_scan(doc)
        assert scan["blind"] == 0, "a file named by a rule anchor is documented"

    @pytest.mark.parametrize("anchor,expected", [
        ("src/a.py:42", "src/a.py"),
        ("src/a.py:42-88", "src/a.py"),
        ("src/a.py:42,88", "src/a.py"),
        ("src/a.py:L42", "src/a.py"),
        ("src/a.py", "src/a.py"),
        ("C:/win/a.py", "C:/win/a.py"),   # a colon that is part of the path
    ])
    def test_anchor_file_part(self, anchor, expected):
        assert _anchor_file_part(anchor) == expected


# ─── H3: an assertion with no text is not adjudicable ─────────────────────────

class TestH3AssertionTextGuard:
    def test_guard_rejects_assertion_with_no_rule_cond_or_case(self):
        """`statement` was the observed key. It passed every gate and rendered blank."""
        doc = {"domains": [], "flows": [], "steps": [{
            "id": "s1",
            "rules": [{"statement": "text under the wrong key", "verified": True,
                       "anchor": "src/a.py:10"}],
        }]}
        errors = check_llm_assertion_guards(doc)
        assert errors, "an assertion with no rule/cond/case must be flagged"
        assert "carries no text" in errors[0]
        assert "statement" in errors[0], "the error should list the keys actually present"

    @pytest.mark.parametrize("key", ["rule", "cond", "case"])
    def test_each_accepted_text_key_passes(self, key):
        doc = {"domains": [], "flows": [], "steps": [{
            "id": "s1", "rules": [{key: "real text", "verified": True, "anchor": "a.py:1"}],
        }]}
        assert check_llm_assertion_guards(doc) == []

    def test_blank_text_is_also_rejected(self):
        doc = {"domains": [], "flows": [], "steps": [{
            "id": "s1", "rules": [{"rule": "   ", "verified": True, "anchor": "a.py:1"}],
        }]}
        assert check_llm_assertion_guards(doc), "whitespace-only text is no text"

    def test_render_backstop_is_visible_not_blank(self):
        """Belt-and-braces: if anything slips past the guard it must be LOUD."""
        row = _fmt_assertion_row({"statement": "x", "verified": True, "anchor": "a.py:1"})
        assert "NO RULE TEXT" in row
        assert "statement" in row


# ─── H4: line_range type guard ────────────────────────────────────────────────

class TestH4LineRange:
    @pytest.mark.parametrize("lr,expected", [
        ([88, 102], "88-102"),
        ((71, 87), "71-87"),
        ("88-102", "88-102"),      # the string form that used to render 8-8
        ("71-87", "71-87"),        # used to render 7-1
        ("206-247", "206-247"),    # used to render 2-0
        ("88", "88"),
        (88, "88"),
        ([88], "88"),
    ])
    def test_accepted_shapes(self, lr, expected):
        assert _fmt_line_range(lr) == expected

    @pytest.mark.parametrize("lr", ["not-a-range", "", {"start": 1}, None, True, [1, 2, 3]])
    def test_rejected_shapes_raise_rather_than_emit_a_plausible_wrong_anchor(self, lr):
        with pytest.raises(ValueError):
            _fmt_line_range(lr)

    def test_string_line_range_renders_the_right_anchor_in_a_spec(self):
        """End-to-end: the garbage anchor was produced by the framework, passed the
        file-only anchor check, and misled the human review it was meant to enable."""
        flows = [{"id": "f", "domain_id": "d", "name": "F", "entry_ref": "route:x"}]
        steps = [{"id": "s", "flow_id": "f", "order": 1, "name": "Step",
                  "file_path": "src/auth.py", "line_range": "88-102"}]
        md = project_domain_skeleton({"id": "d", "name": "D"}, flows, steps)
        assert "src/auth.py:88-102" in md
        assert "src/auth.py:8-8" not in md


# ─── M2: the business-rules dimension must see this plugin's output ───────────

class TestM2BusinessRulesDimension:
    def test_domains_business_rules_make_the_dimension_applicable(self):
        """Keyed only on the legacy/SQL `domain_rules` layer, the one dimension that
        measures this plugin's core value was N/A on every repo it targets — while
        asserting the repo 'has no business rules to extract'."""
        doc = {"domains": [
            {"id": "d1", "business_rules": [_rule("a"), _rule("b")]},
            {"id": "d2", "business_rules": []},
        ]}
        got = compute_business_rules_dimension(doc)
        assert got["applicable"] is True, "domains[].business_rules must be scorable"
        assert got["coverage"] == pytest.approx(0.5), "1 of 2 domains bears rules"
        assert got["score"] is not None

    def test_anchored_ratio_is_reported(self):
        doc = {"domains": [{"id": "d1", "business_rules": [
            _rule("a"), _rule("b"), _rule("c", verified=False)]}]}
        got = compute_business_rules_dimension(doc)
        assert got["anchored"] == pytest.approx(2 / 3)

    def test_no_rules_anywhere_is_still_honestly_na(self):
        got = compute_business_rules_dimension({"modules": []})
        assert got["applicable"] is False
        assert got["score"] is None

    def test_na_detail_no_longer_claims_the_repo_has_no_rules(self):
        got = compute_business_rules_dimension({"modules": []})
        assert "non-legacy/non-SQL repo has no business rules" not in got["detail"], (
            "that claim is false for any repo carrying domains[].business_rules"
        )

    def test_legacy_domain_rules_layer_still_wins(self):
        """Backward compatibility: the SQL/legacy path must be unchanged."""
        doc = {"domain_rules": {"domains": [{"domain_id": "d", "rule_count": 3}],
                                "rules": [{"rule_id": "r1", "domain_id": "d"}]}}
        got = compute_business_rules_dimension(doc)
        assert got["applicable"] is True
        assert got["source"] == "domain_rules"


# ─── M3: a bulk/import commit is not a verification task ──────────────────────

class TestM3VerificationTaskQuality:
    """A commit touching the whole repo cannot localize anything, so it makes the
    isolated VERIFY phase run against noise — while still clearing INSTRUCTIONS'
    "skip VERIFY if fewer than 2 tasks" threshold. Flattened/squashed history is
    normal in customer deliveries, so this is load-bearing."""

    @staticmethod
    def _repo(tmp_path, commits):
        """Build a real git repo; `commits` = [(subject, [file, ...]), ...]."""
        import subprocess

        repo = tmp_path / "r"
        repo.mkdir()
        run = lambda *a: subprocess.run(a, cwd=repo, check=True,
                                        capture_output=True, text=True)
        run("git", "init", "-q")
        run("git", "config", "user.email", "t@example.com")
        run("git", "config", "user.name", "T")
        for subject, files in commits:
            for f in files:
                p = repo / f
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(f"# {subject}\n")
            run("git", "add", "-A")
            run("git", "commit", "-q", "-m", subject)
        return repo

    def test_bulk_import_commit_is_not_selected(self, tmp_path):
        from scripts.ai_ready_helpers import select_verification_tasks

        bulk = [f"src/mod{i}.py" for i in range(60)]
        repo = self._repo(tmp_path, [("Initial commit", bulk)])
        assert select_verification_tasks(repo) == [], (
            "a 60-file import commit has no discriminative power and must not "
            "become a verification task"
        )

    def test_focused_commits_are_still_selected(self, tmp_path):
        from scripts.ai_ready_helpers import select_verification_tasks

        repo = self._repo(tmp_path, [
            ("Initial commit", [f"src/mod{i}.py" for i in range(60)]),
            ("fix: rounding in payroll", ["src/payroll.py"]),
            ("feat: add export", ["src/export.py"]),
        ])
        tasks = select_verification_tasks(repo)
        files = {t["correct_file"] for t in tasks}
        assert "src/payroll.py" in files
        assert "src/export.py" in files
        assert not any(t["correct_file"].startswith("src/mod") for t in tasks), (
            "the bulk commit must stay excluded even when used as a fallback filler"
        )

    def test_small_repo_is_not_starved_by_the_fraction_rule(self, tmp_path):
        """3 files out of 4 is 75% but only 3 files — still a usable ground truth.
        The absolute floor protects small repos from the ratio test."""
        from scripts.ai_ready_helpers import select_verification_tasks

        repo = self._repo(tmp_path, [
            ("feat: seed", ["src/a.py"]),
            ("fix: three at once", ["src/b.py", "src/c.py", "src/d.py"]),
        ])
        assert select_verification_tasks(repo), "a tiny repo must still yield tasks"
