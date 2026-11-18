import datetime
import json
import re
import sys

CONTEXT_WARNING_TOKENS = 150_000
AGE_WARNING_HOURS = 24
CONTEXT_FIELDS = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
MESSAGE_TAG = re.compile(r"<message\b[^>]*>")
ATTRIBUTE = re.compile(r'([\w-]+)="([^"]*)"')


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


def describe_size(latest_context, age_hours):
    facts = [f"{latest_context // 1000}k tokens"]
    if age_hours >= AGE_WARNING_HOURS:
        facts.append(f"open {int(age_hours)} hours")
    return ", ".join(facts)


def find_person_message_id(prompt):
    for tag in MESSAGE_TAG.findall(prompt or ""):
        attributes = dict(ATTRIBUTE.findall(tag))
        if attributes.get("trigger") == "true" and attributes.get("from") == "human":
            return attributes.get("id")
    return None


def build_button_instructions(size):
    warning_line = f"**[⚠️ Long thread: {size}. Use the button below to start the next task fresh.]**"
    return (
        f"Make this exact bold line the first line of your reply: {warning_line} "
        "Then give the person a button that moves the next task to a fresh thread with a short brief, "
        "never a bare suggestion: in a Claude Code session, a start_session proposal card. "
        "If no tool can draw a button, offer to hand the next task to a new thread yourself and say so."
    )


def build_handoff_instructions(size, message_id):
    warning_line = f"**[⚠️ Long thread: {size}. Your message moved to a fresh thread.]**"
    return (
        f"This project thread is past its limit, so hand the person's new message {message_id} to a fresh thread. "
        "Do not start the task here and do not ask first. "
        "1) Call send_message with session_id \"@parent\", visibility \"sent_to_shared_agent\" and a message that says: "
        f"\"Auto handoff: this thread is past its token limit. Please open a fresh thread for the person's message "
        f"{message_id}\", followed by a brief of at most five lines: the task the message asks for, and any repo, "
        "branch, PR or file it depends on. "
        f"2) Post one reply in this thread whose only line is: {warning_line} "
        "3) Call set_thread_resolved with resolved true. "
        "One exception: if the message only answers a question this thread is waiting on (an approval, a pick, "
        "a yes), finish that one step here, then do steps 1 to 3 for whatever is left, skipping step 1 when nothing is."
    )


def build_hook_reply(transcript_path, now_text, prompt=""):
    entries = read_entries(transcript_path)
    if not entries:
        return None
    latest_context, started_at = measure_session(entries)
    age_hours = (parse_timestamp(now_text) - started_at).total_seconds() / 3600 if started_at else 0
    problems = describe_problems(latest_context, age_hours)
    if not problems:
        return None
    summary = "Long session: " + " and ".join(problems) + ". Every message re-reads all of it."
    size = describe_size(latest_context, age_hours)
    message_id = find_person_message_id(prompt)
    advice = build_handoff_instructions(size, message_id) if message_id else build_button_instructions(size)
    return {
        "systemMessage": summary,
        "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": f"{summary} {advice}"},
    }


def read_hook_input(raw_input):
    try:
        hook_input = json.loads(raw_input.decode("utf-8-sig"))
    except ValueError:
        return {}
    return hook_input if isinstance(hook_input, dict) else {}


def read_transcript_path(raw_input):
    return read_hook_input(raw_input).get("transcript_path") or ""


def read_prompt(raw_input):
    return read_hook_input(raw_input).get("prompt") or ""


def main():
    raw_input = sys.stdin.buffer.read()
    now_text = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reply = build_hook_reply(read_transcript_path(raw_input), now_text, read_prompt(raw_input))
    if reply:
        print(json.dumps(reply))


if __name__ == "__main__":
    main()
