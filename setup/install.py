import copy
import json
import shutil
import sys
from pathlib import Path, PureWindowsPath

HOOK_FILE = "long_session_warning.py"
KIT_FOLDERS = ("skills", "agents", "hooks", "mods")
RULES_HEADING = "## One task per thread"


def build_hook_command(claude_home, platform):
    hook_path = Path(claude_home) / "hooks" / "long_session_warning" / HOOK_FILE
    if platform == "win32":
        return f'py -I "{PureWindowsPath(hook_path)}"'
    return f"python3 -I {hook_path.as_posix()}"


def has_hook(groups, hook_command):
    return any(hook.get("command") == hook_command for group in groups for hook in group.get("hooks", []))


def merge_settings(settings, hook_command, mod_folder):
    merged = copy.deepcopy(settings)
    environment = merged.setdefault("env", {})
    environment.setdefault("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", "20")
    environment.setdefault("CLAUDE_CODE_PLUGIN_DIRS", mod_folder)
    prompt_hooks = merged.setdefault("hooks", {}).setdefault("UserPromptSubmit", [])
    if not has_hook(prompt_hooks, hook_command):
        prompt_hooks.append({"hooks": [{"type": "command", "command": hook_command, "timeout": 10}]})
    return merged


def add_token_rules(claude_md_text, rules_text):
    if RULES_HEADING in claude_md_text:
        return claude_md_text
    separator = "\n\n" if claude_md_text.strip() else ""
    return claude_md_text.rstrip("\n") + separator + rules_text.strip("\n") + "\n"


def copy_kit_folders(kit_root, claude_home):
    for folder in KIT_FOLDERS:
        shutil.copytree(
            Path(kit_root) / folder,
            Path(claude_home) / folder,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("__pycache__", "test_*.py", "tests"),
        )


def update_settings_file(claude_home, platform):
    settings_path = Path(claude_home) / "settings.json"
    settings = {}
    if settings_path.exists():
        original_text = settings_path.read_text(encoding="utf-8")
        shutil.copyfile(settings_path, settings_path.with_name("settings.json.bak"))
        settings = json.loads(original_text or "{}")
    mod_folder = Path(claude_home) / "mods" / "run-meter"
    mod_text = str(PureWindowsPath(mod_folder)) if platform == "win32" else mod_folder.as_posix()
    merged = merge_settings(settings, build_hook_command(claude_home, platform), mod_text)
    settings_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")


def update_claude_md(kit_root, claude_home):
    claude_md_path = Path(claude_home) / "CLAUDE.md"
    existing_text = claude_md_path.read_text(encoding="utf-8") if claude_md_path.exists() else ""
    rules_text = (Path(kit_root) / "rules" / "token-budget.md").read_text(encoding="utf-8")
    claude_md_path.write_text(add_token_rules(existing_text, rules_text), encoding="utf-8")


def install_kit(kit_root, claude_home, platform):
    Path(claude_home).mkdir(parents=True, exist_ok=True)
    copy_kit_folders(kit_root, claude_home)
    update_settings_file(claude_home, platform)
    update_claude_md(kit_root, claude_home)


def main():
    kit_root = Path(__file__).resolve().parent.parent
    claude_home = Path.home() / ".claude"
    install_kit(kit_root, claude_home, sys.platform)
    print(f"Installed the ai-skills kit into {claude_home}. New sessions pick it up.")


if __name__ == "__main__":
    main()
