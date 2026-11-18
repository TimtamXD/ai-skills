import json
import tempfile
import unittest
from pathlib import Path

from install import add_token_rules, build_hook_command, install_kit, merge_settings

KIT_ROOT = Path(__file__).resolve().parent.parent
LINUX_HOOK = "python3 -I /home/tim/.claude/hooks/long_session_warning/long_session_warning.py"


def hook_commands(settings):
    return [
        hook["command"]
        for group in settings["hooks"]["UserPromptSubmit"]
        for hook in group["hooks"]
    ]


def fresh_claude_home():
    return Path(tempfile.mkdtemp()) / ".claude"


class SettingsMergeTest(unittest.TestCase):
    def test_a_new_machine_gets_the_long_session_hook(self):
        settings = merge_settings({}, LINUX_HOOK, "/home/tim/.claude/mods/run-meter")

        self.assertEqual(hook_commands(settings), [LINUX_HOOK])

    def test_a_new_machine_compacts_at_twenty_percent(self):
        settings = merge_settings({}, LINUX_HOOK, "/home/tim/.claude/mods/run-meter")

        self.assertEqual(settings["env"]["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"], "20")

    def test_a_new_machine_loads_the_run_meter_mod(self):
        settings = merge_settings({}, LINUX_HOOK, "/home/tim/.claude/mods/run-meter")

        self.assertEqual(settings["env"]["CLAUDE_CODE_PLUGIN_DIRS"], "/home/tim/.claude/mods/run-meter")

    def test_installing_twice_does_not_add_the_hook_twice(self):
        once = merge_settings({}, LINUX_HOOK, "/mods/run-meter")

        twice = merge_settings(once, LINUX_HOOK, "/mods/run-meter")

        self.assertEqual(hook_commands(twice), [LINUX_HOOK])

    def test_existing_hooks_and_settings_are_kept(self):
        existing = {
            "model": "opus",
            "env": {"CLAUDE_CODE_PLUGIN_DIRS": "/my/own/mods"},
            "hooks": {"UserPromptSubmit": [{"hooks": [{"type": "command", "command": "echo hi"}]}]},
        }

        settings = merge_settings(existing, LINUX_HOOK, "/mods/run-meter")

        self.assertEqual(settings["model"], "opus")
        self.assertEqual(settings["env"]["CLAUDE_CODE_PLUGIN_DIRS"], "/my/own/mods")
        self.assertEqual(hook_commands(settings), ["echo hi", LINUX_HOOK])


class HookCommandTest(unittest.TestCase):
    def test_windows_runs_the_hook_with_py_and_a_quoted_windows_path(self):
        command = build_hook_command(Path("C:/Users/Tim/.claude"), "win32")

        self.assertTrue(command.startswith('py -I "C:'))
        self.assertTrue(command.endswith('long_session_warning.py"'))

    def test_linux_and_mac_run_the_hook_with_python3(self):
        command = build_hook_command(Path("/home/tim/.claude"), "linux")

        self.assertEqual(command, LINUX_HOOK)


class TokenRulesTest(unittest.TestCase):
    def test_the_token_rules_are_added_to_an_empty_claude_md(self):
        text = add_token_rules("", "## One task per thread\nrules")

        self.assertIn("## One task per thread", text)

    def test_the_token_rules_are_not_added_twice(self):
        once = add_token_rules("# Mine\n", "## One task per thread\nrules")

        twice = add_token_rules(once, "## One task per thread\nrules")

        self.assertEqual(twice.count("## One task per thread"), 1)
        self.assertTrue(twice.startswith("# Mine\n"))


class InstallKitTest(unittest.TestCase):
    def test_installing_on_a_new_machine_copies_skills_agents_hook_and_mod(self):
        claude_home = fresh_claude_home()

        install_kit(KIT_ROOT, claude_home, "linux")

        self.assertTrue((claude_home / "skills/acknowledging-code-quality/SKILL.md").exists())
        self.assertTrue((claude_home / "agents/wcgw.md").exists())
        self.assertTrue((claude_home / "hooks/long_session_warning/long_session_warning.py").exists())
        self.assertTrue((claude_home / "mods/run-meter/.claude-plugin/plugin.json").exists())

    def test_installing_writes_settings_and_the_token_rules(self):
        claude_home = fresh_claude_home()

        install_kit(KIT_ROOT, claude_home, "linux")

        settings = json.loads((claude_home / "settings.json").read_text(encoding="utf-8"))
        self.assertEqual(settings["env"]["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"], "20")
        self.assertIn("One task per thread", (claude_home / "CLAUDE.md").read_text(encoding="utf-8"))

    def test_an_existing_settings_file_is_backed_up_before_it_is_changed(self):
        claude_home = fresh_claude_home()
        claude_home.mkdir(parents=True)
        (claude_home / "settings.json").write_text('{"model": "opus"}', encoding="utf-8")

        install_kit(KIT_ROOT, claude_home, "linux")

        self.assertEqual((claude_home / "settings.json.bak").read_text(encoding="utf-8"), '{"model": "opus"}')


if __name__ == "__main__":
    unittest.main()
