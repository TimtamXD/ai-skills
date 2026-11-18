import json
import tempfile
import unittest
from pathlib import Path

from long_session_warning import build_hook_reply, read_prompt, read_transcript_path

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


def person_wake(message_id):
    return (
        '<wake reason="mention" current-time="2026-11-18T09:00:00Z"><project id="chan_1" type="project">'
        f'<thread ts="cmsg_root"><message trigger="true" from="human" trust="principal" author="Tim" id="{message_id}">'
        "can you also add dark mode?</message></thread></project></wake>"
    )


def coordinator_relay():
    return '<relay from="coordinator" session="session_1" reason="spawn"><note>Please do X.</note></relay>'


def long_transcript():
    return write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 240_000)])


def instructions_for(reply):
    return reply["hookSpecificOutput"]["additionalContext"]


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

    def test_the_warning_is_a_bold_bracketed_line_with_a_button_to_a_new_thread(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 240_000)])

        reply = build_hook_reply(transcript, NOW)

        instructions = reply["hookSpecificOutput"]["additionalContext"]
        self.assertIn("**[⚠️ Long thread: 240k tokens", instructions)
        self.assertIn("button", instructions)

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


class AutomaticThreadHandoffTest(unittest.TestCase):
    def test_a_persons_message_in_a_long_project_thread_is_sent_to_the_coordinator_for_a_fresh_thread(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, person_wake("cmsg_NEW42")))

        self.assertIn("send_message", instructions)
        self.assertIn("@parent", instructions)
        self.assertIn("cmsg_NEW42", instructions)

    def test_the_long_project_thread_resolves_itself_after_the_handoff(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, person_wake("cmsg_NEW42")))

        self.assertIn("set_thread_resolved", instructions)

    def test_the_handoff_happens_without_asking_the_person_to_press_a_button(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, person_wake("cmsg_NEW42")))

        self.assertIn("Do not start the task here", instructions)
        self.assertNotIn("decision card", instructions)

    def test_the_person_is_told_in_one_bold_line_that_their_message_moved(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, person_wake("cmsg_NEW42")))

        self.assertIn("**[⚠️ Long thread: 240k tokens. Your message moved to a fresh thread.]**", instructions)

    def test_a_reply_to_a_question_this_thread_is_waiting_on_is_finished_here_before_handing_off(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, person_wake("cmsg_NEW42")))

        self.assertIn("only answers a question this thread is waiting on", instructions)

    def test_a_coordinator_message_in_a_long_thread_is_not_handed_off(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, coordinator_relay()))

        self.assertNotIn("set_thread_resolved", instructions)

    def test_a_short_project_thread_keeps_the_persons_message(self):
        transcript = write_transcript([user_turn(FRESH_START), assistant_turn(NOW, 20_000)])

        self.assertIsNone(build_hook_reply(transcript, NOW, person_wake("cmsg_NEW42")))

    def test_a_long_claude_code_session_outside_a_project_still_offers_a_button(self):
        instructions = instructions_for(build_hook_reply(long_transcript(), NOW, "please add dark mode"))

        self.assertIn("start_session", instructions)
        self.assertNotIn("set_thread_resolved", instructions)

    def test_the_hook_reads_the_persons_prompt_from_its_input(self):
        raw_input = json.dumps({"transcript_path": "x.jsonl", "prompt": "hello there"}).encode("utf-8")

        self.assertEqual(read_prompt(raw_input), "hello there")

    def test_unreadable_hook_input_gives_an_empty_prompt(self):
        self.assertEqual(read_prompt(b"not json"), "")
