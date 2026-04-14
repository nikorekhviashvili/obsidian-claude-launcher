import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { exec } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface ClaudeLauncherSettings {
	terminalApp: "Terminal" | "iTerm" | "Warp";
	skipPermissions: boolean;
	claudeFlags: string;
}

const DEFAULT_SETTINGS: ClaudeLauncherSettings = {
	terminalApp: "Terminal",
	skipPermissions: true,
	claudeFlags: "",
};

function shellQuote(s: string): string {
	return "'" + s.replace(/'/g, "'\\''") + "'";
}

function openTerminal(scriptPath: string, terminalApp: string): void {
	const quoted = scriptPath.replace(/"/g, '\\"');
	let appleScript: string;

	if (terminalApp === "Warp") {
		appleScript =
			'tell application "Warp" to activate\n' +
			"delay 0.8\n" +
			'tell application "System Events"\n' +
			'  tell process "Warp"\n' +
			'    keystroke "t" using command down\n' +
			"    delay 0.8\n" +
			'    keystroke "' + quoted + '"\n' +
			"    delay 0.3\n" +
			"    key code 36\n" +
			"  end tell\n" +
			"end tell";
	} else if (terminalApp === "iTerm") {
		appleScript =
			'tell application "iTerm"\n' +
			"  activate\n" +
			'  create window with default profile command "' + quoted + '"\n' +
			"end tell";
	} else {
		appleScript =
			'tell application "Terminal"\n' +
			"  activate\n" +
			'  do script "' + quoted + '"\n' +
			"end tell";
	}

	exec("osascript -e " + shellQuote(appleScript), (err, _stdout, stderr) => {
		if (err) {
			new Notice("Terminal error: " + (stderr || err.message));
		}
	});
}

export default class ClaudeLauncherPlugin extends Plugin {
	settings: ClaudeLauncherSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "launch-claude-code",
			name: "Launch Claude Code with selection",
			hotkeys: [{ modifiers: ["Mod", "Alt"], key: "d" }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const sel = editor.getSelection() ?? "";
				const file = view.file ?? null;
				new ClaudePromptModal(this.app, this, sel, file).open();
			},
		});

		this.addSettingTab(new ClaudeLauncherSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ClaudePromptModal extends Modal {
	private plugin: ClaudeLauncherPlugin;
	private selText: string;
	private file: TFile | null;

	constructor(
		app: App,
		plugin: ClaudeLauncherPlugin,
		selText: string,
		file: TFile | null,
	) {
		super(app);
		this.plugin = plugin;
		this.selText = selText ?? "";
		this.file = file;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h3", { text: "Claude Code" });

		if (this.file) {
			const info = contentEl.createEl("div");
			info.style.cssText =
				"font-size:13px;color:var(--text-muted);margin-bottom:8px;";
			info.textContent = "\u2192 " + this.file.path;
		}

		if (this.selText.length > 0) {
			const selDiv = contentEl.createEl("div");
			selDiv.style.cssText =
				"font-size:12px;color:var(--text-faint);background:var(--background-secondary);" +
				"padding:8px;border-radius:4px;margin-bottom:12px;max-height:80px;overflow:auto;" +
				"white-space:pre-wrap;font-family:var(--font-monospace);";
			selDiv.textContent =
				this.selText.length > 200
					? this.selText.substring(0, 200) + "\u2026"
					: this.selText;
		}

		const textArea = contentEl.createEl("textarea", {
			attr: {
				placeholder: "Prompt (optional) \u2014 \u2318+Enter to launch",
				rows: "4",
			},
		});
		textArea.style.cssText =
			"width:100%;resize:vertical;font-family:var(--font-monospace);" +
			"font-size:14px;padding:8px;margin-bottom:12px;";

		textArea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.launch(textArea.value);
				this.close();
			}
		});

		const btnRow = contentEl.createEl("div");
		btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;";

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const launchBtn = btnRow.createEl("button", {
			text: "Launch \u2318\u21A9",
			cls: "mod-cta",
		});
		launchBtn.addEventListener("click", () => {
			this.launch(textArea.value);
			this.close();
		});

		setTimeout(() => textArea.focus(), 50);
	}

	private launch(customPrompt: string) {
		try {
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const { settings } = this.plugin;

			const parts: string[] = [];
			if (this.file) parts.push("@" + this.file.path);
			if (customPrompt.trim()) parts.push(customPrompt.trim());
			if (this.selText.trim()) {
				parts.push(
					"Selected text:\n```\n" + this.selText.trim() + "\n```",
				);
			}
			const prompt = parts.join("\n\n");

			const ts = Date.now();
			const promptFile = join(tmpdir(), "claude-obs-prompt-" + ts + ".txt");
			const scriptFile = join(tmpdir(), "claude-obs-launch-" + ts + ".sh");
			writeFileSync(promptFile, prompt, "utf8");

			const flags = [
				settings.skipPermissions ? "--dangerously-skip-permissions" : "",
				settings.claudeFlags || "",
			]
				.filter(Boolean)
				.join(" ");

			const script = [
				"#!/bin/bash",
				"cd " + shellQuote(vaultPath),
				"PROMPT=$(<" + shellQuote(promptFile) + ")",
				"rm -f " + shellQuote(promptFile) + " " + shellQuote(scriptFile),
				'exec claude ' + flags + ' "$PROMPT"',
			].join("\n");
			writeFileSync(scriptFile, script, { mode: 0o755 });

			openTerminal(scriptFile, settings.terminalApp);
			new Notice("Launching Claude Code\u2026");
		} catch (err) {
			new Notice("Claude Launcher error: " + (err as Error).message);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

class ClaudeLauncherSettingTab extends PluginSettingTab {
	plugin: ClaudeLauncherPlugin;

	constructor(app: App, plugin: ClaudeLauncherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Claude Code Launcher" });

		new Setting(containerEl)
			.setName("Terminal application")
			.setDesc("Which terminal to launch Claude Code in")
			.addDropdown((d) =>
				d
					.addOption("Terminal", "Terminal.app")
					.addOption("iTerm", "iTerm2")
					.addOption("Warp", "Warp")
					.setValue(this.plugin.settings.terminalApp)
					.onChange(async (v) => {
						this.plugin.settings.terminalApp =
							v as ClaudeLauncherSettings["terminalApp"];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skip permissions")
			.setDesc("Launch with --dangerously-skip-permissions")
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.skipPermissions)
					.onChange(async (v) => {
						this.plugin.settings.skipPermissions = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Extra CLI flags")
			.setDesc("Additional flags passed to the claude command")
			.addText((t) =>
				t
					.setPlaceholder("e.g. --model sonnet")
					.setValue(this.plugin.settings.claudeFlags)
					.onChange(async (v) => {
						this.plugin.settings.claudeFlags = v;
						await this.plugin.saveSettings();
					}),
			);
	}
}
