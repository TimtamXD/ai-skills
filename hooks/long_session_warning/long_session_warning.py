import datetime
import json
import sys

CONTEXT_WARNING_TOKENS = 150_000
AGE_WARNING_HOURS = 24
CONTEXT_FIELDS = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")


def parse_timestamp(text):
    return datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))


def read_entries(transcript_path):
    try:
        with open(transcript_path, encoding="utf-8", errors="ignore") as transcript:
            lines = transcript.readlines()
    except OSError:
        return []
    entries = []
    for line in lines:
        try:
            entries.append(json.loads(line))
        except ValueError:
            continue
    return entries


def measure_session(entries):
    timestamps = [parse_timestamp(entry["timestamp"]) for entry in entries if entry.get("timestamp")]
    usages = [
        entry["message"]["usage"]
        for entry in entries
        if entry.get("type") == "assistant" and isinstance(entry.get("message"), dict) and entry["message"].get("usage")
    ]
    latest_context = sum(usages[-1].get(field) or 0 for field in CONTEXT_FIELDS) if usages else 0
    started_at = min(timestamps) if timestamps else None
    return latest_context, started_at


def describe_problems(latest_context, age_hours):
    problems = []
    if latest_context >= CONTEXT_WARNING_TOKENS:
        problems.append(f"it carries {latest_context // 1000}k tokens of context")
    if age_hours >= AGE_WARNING_HOURS:
        problems.append(f"it has been open for {int(age_hours)} hours")
    return problems


def build_hook_reply(transcript_path, now_text):
    entries = read_entries(transcript_path)
    if not entries:
        return None
    latest_context, started_at = measure_session(entries)
    age_hours = (parse_timestamp(now_text) - started_at).total_seconds() / 3600 if started_at else 0
    problems = describe_problems(latest_context, age_hours)
    if not problems:
        return None
    summary = "Long session: " + " and ".join(problems) + ". Every message re-reads all of it."
    instructions = (
        f"{summary} Put a one-line warning as the first line of your reply to the person, "
        "and suggest moving the next task to a new thread (or a new session) instead of this one."
    )
    return {
        "systemMessage": summary,
        "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": instructions},
    }


def read_transcript_path(raw_input):
    try:
        hook_input = json.loads(raw_input.decode("utf-8-sig"))
    except ValueError:
        return ""
    return hook_input.get("transcript_path") or "" if isinstance(hook_input, dict) else ""


def main():
    transcript_path = read_transcript_path(sys.stdin.buffer.read())
    now_text = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reply = build_hook_reply(transcript_path, now_text)
    if reply:
        print(json.dumps(reply))


if __name__ == "__main__":
    main()
