import { Vault, Plugin, FileSystemAdapter, MarkdownPostProcessorContext, MarkdownRenderer, PluginSettingTab, Setting, App } from 'obsidian';
import { readFile } from "fs"
import axios from "axios"

const URISCHEME = "file://"
const MDDIVCLASS = "obsidian-iframe-md"
const ERRORMD = "# Obsidian-iframes cannot access the internet"

interface settingItem<T> {
	value: T
	name?: string
	desc?: string
}

interface columnSettings {
	allowInet: settingItem<boolean>
}

const DEFAULT_SETTINGS: columnSettings = {
	allowInet: {value: false, name: "Access Internet", desc: "Allows this plugin to access the internet to render remote MD files."}
}

let parseBoolean = (value: string) => {
	return (value == "yes" || value == "true")
}

let parseObject = (value: any, typ: string) => {
	if (typ == "string") {
		return value
	}
	if (typ == "boolean") {
		return parseBoolean(value)
	}
	if (typ == "number") {
		return parseFloat(value)
	}
}

export default class ObsidianIframes extends Plugin {

	settings: columnSettings;

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new ObsidianColumnsSettings(this.app, this));

		let processIframe = (element: Element, context: MarkdownPostProcessorContext) => {
			let iframes = element.querySelectorAll("iframe")
			for (let child of Array.from(iframes)) {
				let src = child.getAttribute("src")
				if (!src.contains("://")) {
					let root = (this.app.vault.adapter as FileSystemAdapter).getBasePath()
					if (src.startsWith("/")) {
						child.setAttribute("src", URISCHEME + root + src)
					}
					else if (src.startsWith("./")) {
						let source = context.sourcePath
						let index = source.lastIndexOf("/")
						source = source.substring(0, index)
						let path = URISCHEME + root + "/" + source + src.substring(1)
						child.setAttribute("src", path)
					}
					else {
						let source = context.sourcePath
						let index = source.lastIndexOf("/")
						source = source.substring(0, index)
						let path = URISCHEME + root + "/" + source + "/" + src
						child.setAttribute("src", path)
					}
				}

				if (src.endsWith(".md")) {
					// Request file
					let url = new URL(child.getAttribute("src"));

					let fileContentCallback = (source: string) => {
						Array.from(element.children).forEach((i) => {
							element.removeChild(i)
						})
						let div = element.createEl("div", { cls: MDDIVCLASS })
						Array.from(child.attributes).forEach((i) => {
							if (i.nodeName != "src" && i.nodeName != "sandbox") {
								div.setAttribute(i.nodeName, i.nodeValue)
							}
						})
						const sourcePath = context.sourcePath;
						MarkdownRenderer.renderMarkdown(
							source,
							div,
							sourcePath,
							null
						);

					}

					if (url.protocol == "file:") {
						readFile(url.pathname, (e, d) => {
							if (e) console.error(e)
							fileContentCallback(d.toString())
						})
					} else {
						if (this.settings.allowInet.value) {
						axios(url.href).then((a) => fileContentCallback(a.data)).catch(console.error)
						} else {
							fileContentCallback(ERRORMD)
						}
					}
				}
			}
		}

		this.registerMarkdownPostProcessor((element, context) => { processIframe(element, context) });
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ObsidianColumnsSettings extends PluginSettingTab {
	plugin: ObsidianIframes;

	constructor(app: App, plugin: ObsidianIframes) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for obsidian-columns' });

		let keyvals = Object.entries(DEFAULT_SETTINGS)

		console.log(keyvals)

		for (let keyval of keyvals) {
			new Setting(containerEl)
				.setName(keyval[1].name)
				.setDesc(keyval[1].desc)
				.addText(text => text
					.setPlaceholder(String(keyval[1].value))
					.setValue(String((this.plugin.settings as any)[keyval[0]].value))
					.onChange((value) => {
						keyval[1].value = parseObject(value, typeof keyval[1].value);
						this.plugin.saveSettings();
					}));
		}
	}
}