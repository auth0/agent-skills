import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import check_snyk_findings as cs


def _write(tmp_path, name, obj):
    p = tmp_path / name
    p.write_text(json.dumps(obj))
    return str(p)


def test_new_per_file_name_with_evil_url_blocks(tmp_path, monkeypatch):
    # New Task 2 naming: <...>-skills-<skill>--references-<file>-md.json
    _write(
        tmp_path,
        "snyk-agent-scan-skill-plugins-auth0-skills-auth0--references-framework-react-md.json",
        {
            "some_target": {
                "issues": [
                    {
                        "code": "W012",
                        "message": "https://evil.example/x",
                        "extra_data": {"title": "External URL"},
                    }
                ]
            }
        },
    )
    monkeypatch.chdir(tmp_path)
    # No ignore entry for evil.example -> must BLOCK (failed == True)
    failed = cs.check_findings(report_glob="snyk-agent-scan-*.json", ignores=[])
    assert failed is True


def test_new_per_file_name_with_allowlisted_skill_url_does_not_block(tmp_path, monkeypatch):
    # Regex must extract skill "auth0" (not "auth0--references-framework-react-md")
    # so the skills: ["auth0"] allowlist entry matches.
    _write(
        tmp_path,
        "snyk-agent-scan-skill-plugins-auth0-skills-auth0--references-framework-react-md.json",
        {
            "some_target": {
                "issues": [
                    {
                        "code": "W012",
                        "message": "https://github.com/auth0/Auth0.swift",
                        "extra_data": {"title": "External URL"},
                    }
                ]
            }
        },
    )
    monkeypatch.chdir(tmp_path)
    ignores = [
        {
            "code": "W012",
            "skills": ["auth0"],
            "url": "https://github.com/auth0/Auth0.swift",
            "reason": "First-party Auth0 Swift SDK repository",
        }
    ]
    failed = cs.check_findings(report_glob="snyk-agent-scan-*.json", ignores=ignores)
    assert failed is False


def test_old_style_name_still_extracts_skill(tmp_path, monkeypatch):
    # No regression: old-style "...-skills-auth0.json" name must still parse to skill "auth0".
    _write(
        tmp_path,
        "snyk-agent-scan-skill-plugins-auth0-skills-auth0.json",
        {
            "some_target": {
                "issues": [
                    {
                        "code": "W012",
                        "message": "https://github.com/auth0/Auth0.swift",
                        "extra_data": {"title": "External URL"},
                    }
                ]
            }
        },
    )
    monkeypatch.chdir(tmp_path)
    ignores = [
        {
            "code": "W012",
            "skills": ["auth0"],
            "url": "https://github.com/auth0/Auth0.swift",
            "reason": "First-party Auth0 Swift SDK repository",
        }
    ]
    failed = cs.check_findings(report_glob="snyk-agent-scan-*.json", ignores=ignores)
    assert failed is False
