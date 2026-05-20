import glob
import json
import re
import sys

BLOCKING = re.compile(r'^(E\d+|W007|W008|W012)$')


def load_ignores(path='.snyk-agent-scan-ignore.json'):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def ignored_reason(code, message, ignores, skill=None):
    for entry in ignores:
        if entry.get('code') != code:
            continue
        entry_skills = entry.get('skills')
        if entry_skills and (not skill or skill not in entry_skills):
            continue
        url = entry.get('url', '')
        url_pattern = entry.get('url_pattern', '')
        if url and re.search(r'(?<![/\w])' + re.escape(url) + r'(?![a-zA-Z0-9_/\-])', message):
            return entry.get('reason', 'no reason given')
        if url_pattern and re.search(url_pattern, message):
            return entry.get('reason', 'no reason given')
    return None


def check_findings(report_glob='snyk-agent-scan-*.json', ignores=None):
    if ignores is None:
        ignores = load_ignores()

    failed = False
    for path in sorted(glob.glob(report_glob)):
        if path == 'snyk-agent-scan-combined.json':
            continue
        try:
            with open(path) as f:
                data = json.load(f)
        except Exception as e:
            print(f'ERROR: could not parse {path}: {e}')
            failed = True
            continue

        # Extract skill name from filename (e.g. "snyk-agent-scan-skill-plugins-auth0-skills-auth0-expo.json" -> "auth0-expo")
        skill = None
        match = re.search(r'snyk-agent-scan-skill-.*?-skills-(.+)\.json$', path)
        if match:
            skill = match.group(1)

        for scan_result in data.values() if isinstance(data, dict) else [data]:
            for issue in scan_result.get('issues', []):
                code = issue.get('code', '')
                if not BLOCKING.match(code):
                    continue
                message = issue.get('message', '') + ' ' + json.dumps(issue.get('extra_data', {}))
                reason = ignored_reason(code, message, ignores, skill=skill)
                title = issue.get('extra_data', {}).get('title', code)
                if reason:
                    print(f'IGNORED [{path}]: {code} ({title}) — {reason}')
                else:
                    print(f'BLOCKED [{path}]: {code} ({title})')
                    print(f'  {issue.get("message", "")[:300]}')
                    failed = True

    return failed


if __name__ == '__main__':
    sys.exit(1 if check_findings() else 0)