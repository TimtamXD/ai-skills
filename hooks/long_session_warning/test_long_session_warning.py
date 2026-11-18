import json
import tempfile
import unittest
from pathlib import Path

from long_session_warning import build_hook_reply, read_transcript_path

FRESH_START = "2026-11-18T08:00:00Z"
NOW = "2026-11-18T09:00:00Z"


def write_transcript(entries):
    folder = Path(tempfile.mkdtemp())
    transcript = folder / "session.jsonl"
    transcript.write_text("\n".join(json.dumps(entry) for entry in entries), encoding="utf-8")
    return str(transcript)


def assistant_turn(timestamp, context_tokens):
    return {
        "type": "assistant",
        "timestamp": timestamp,
        "message": {"usage": {"input_tokens": 10, "cache_read_input_tokens": context_tokens - 10, "output_tokens": 500}},
    }


def user_turn(timestamp):
    return {"type": "user", "timestamp": timestamp, "message": {"content": "hello"}}


class LongSessionWarningTest(unittest.TestCase):
    def test_a_short_fresh_session_gets_no_warning(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(FRESH_START, 90_000)])

        reply = build_hook_reply(transcript, NOW)

        self.assertIsNone(reply)

    def test_a_session_carrying_over_150k_tokens_is_warned_about(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 240_000)])

        reply = build_hook_reply(transcript, NOW)

        self.assertIn("240k tokens", reply["systemMessage"])

    def test_a_session_open_for_more_than_a_day_is_warned_about(self):
        transcript = write_transcript([user_turn("2026-11-16T08:00:00Z"), assistant_turn(NOW, 90_000)])

        reply = build_hook_reply(transcript, NOW)

        self.assertIn("49 hours", reply["systemMessage"])

    def test_the_warning_asks_claude_to_tell_the_person_and_suggest_a_new_thread(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 240_000)])

        reply = build_hook_reply(transcript, NOW)

        instructions = reply["hookSpecificOutput"]["additionalContext"]
        self.assertEqual(reply["hookSpecificOutput"]["hookEventName"], "UserPromptSubmit")
        self.assertIn("new thread", instructions)
        self.assertIn("first line", instructions)

    def test_a_missing_transcript_gets_no_warning_instead_of_an_error(self):
        reply = build_hook_reply("C:/nowhere/missing.jsonl", NOW)

        self.assertIsNone(reply)

    def test_broken_lines_in_the_transcript_are_skipped(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 240_000)])
        with open(transcript, "a", encoding="utf-8") as file:
            file.write("\n{not json")

        reply = build_hook_reply(transcript, NOW)

        self.assertIn("240k tokens", reply["systemMessage"])

    def test_hook_input_with_a_windows_byte_order_mark_still_gives_the_transcript_path(self):
        raw_input = "\ufeff".encode("utf-8") + b'{"transcript_path": "C:/logs/session.jsonl"}'

        transcript_path = read_transcript_path(raw_input)

        self.assertEqual(transcript_path, "C:/logs/session.jsonl")

    def test_unreadable_hook_input_gives_no_transcript_path(self):
        transcript_path = read_transcript_path(b"not json")

        self.assertEqual(transcript_path, "")


if __name__ == "__main__":
    unittest.main()
