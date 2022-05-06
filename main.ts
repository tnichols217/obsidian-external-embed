import { Vault, Plugin, FileSystemAdapter, MarkdownPostProcessorContext, MarkdownRenderer, PluginSettingTab, Setting, App, MarkdownRenderChild, request } from 'obsidian';
import { copyFileSync, readFile } from "fs"
import axios from "axios"
import html2md from 'html-to-md'

const URISCHEME = "file://"
const MDDIVCLASS = "obsidian-iframe-md"
const ERRORMD = "# Obsidian-iframes cannot access the internet"
const CONVERTMD = "iframe-md"
const IGNOREDTAGS = [CONVERTMD, "src", "sandbox"]
const PREFIX = "!!!"
const IMPORTNAME = "import"
const IFRAMENAME = "iframe"

let CACHE: Record<string, Record<string, string>> = {"true": {}, "false":{}}

interface settingItem<T> {
	value: T
	name?: string
	desc?: string
}

interface iframeSettings {
	allowInet: settingItem<boolean>
}

const DEFAULT_SETTINGS: iframeSettings = {
	allowInet: { value: false, name: "Access Internet", desc: "Allows this plugin to access the internet to render remote MD files." }
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

let processURI = (URI: string, source: string, root: string): string => {
	if (!URI.contains("://")) {
		if (URI.startsWith("/")) {
			return [URISCHEME, root, URI].join("")
		}
		else if (URI.startsWith("./")) {
			return [URISCHEME, root, "/", source.substring(0, source.lastIndexOf("/")), URI.substring(1)].join("")
		}
		else {
			return [URISCHEME, root, "/", source.substring(0, source.lastIndexOf("/")), "/", URI].join("")
		}
	}
	return URI
}

let getURI = (URI: string, convert?: boolean, allowInet?: boolean): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		if (CACHE[convert.toString()].hasOwnProperty(URI)) {
			resolve(CACHE[convert.toString()][URI])
			return
		}
		let url = new URL(URI)
		if (url.protocol == "file:") {
			readFile(url.pathname, (e, d) => {
				if (e) reject(e)
				let dString = d.toString()
				if (convert) {
					dString = html2md(dString)
				}
				CACHE[convert.toString()][URI] = dString
				resolve(dString)
			})
		} else {
			if (allowInet) {
				request({ url: url.href }).then((a) => {
					if (convert) {
						a = html2md(a)
					}
					CACHE[convert.toString()][URI] = a
					resolve(a)
				}).catch(console.error)
			} else {
				resolve(ERRORMD)
			}
		}
	})
}

let renderMD = (source: string, div: HTMLElement, context: MarkdownPostProcessorContext): Promise<void> => {
	const sourcePath = context.sourcePath;
	let renderDiv = new MarkdownRenderChild(div)
	context.addChild(renderDiv)
	return MarkdownRenderer.renderMarkdown(
		source,
		div,
		sourcePath,
		renderDiv
	);
}

let renderURI = async (src: string, element: Element, context: MarkdownPostProcessorContext, allowInet?: boolean, attributes?: NamedNodeMap, convertHTML?: boolean): Promise<void> => {
	return new Promise<void>(async (resolve, reject) => {
		let endsMD = src.endsWith(".md")

		Array.from(element.children).forEach((i) => {
			element.removeChild(i)
		})

		if (endsMD || convertHTML) {

			let fileContentCallback = async (source: string) => {
				let div = element.createEl("div", { cls: MDDIVCLASS })
				Array.from(attributes).forEach((i) => {
					if (!IGNOREDTAGS.contains(i.nodeName)) {
						div.setAttribute(i.nodeName, i.nodeValue)
					}
				})
				await renderMD(source, div, context)
				resolve()
			}

			getURI(src, convertHTML && !endsMD, allowInet).then(fileContentCallback).catch(console.error)
		} else {
			let div = element.createEl("iframe")
			Array.from(attributes).forEach((i) => {
				if (!IGNOREDTAGS.contains(i.nodeName)) {
					div.setAttribute(i.nodeName, i.nodeValue)
				}
			})
			div.setAttribute("src", src)
			resolve()
		}
	})
}

export default class ObsidianIframes extends Plugin {

	settings: iframeSettings;

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new ObsidianIframeSettings(this.app, this));

		let processIframe = (element: Element, context: MarkdownPostProcessorContext) => {
			let iframes = element.querySelectorAll("iframe")
			for (let child of Array.from(iframes)) {
				let src = processURI(child.getAttribute("src"), context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath())

				child.setAttribute("src", src)

				let classAttrib = child.getAttribute("class")
				let convertHTML = classAttrib ? classAttrib.split(" ").contains(CONVERTMD) : false

				renderURI(src, element, context, this.settings.allowInet.value, child.attributes, convertHTML)
			}
		}

		let processCustomCommands = async (element: Element, context: MarkdownPostProcessorContext) => {
			let textContent = element.textContent
			let ctx = context.getSectionInfo(element as HTMLElement)
			if (ctx == null) {
				return
			}
			if (textContent.contains(PREFIX + IMPORTNAME) || textContent.contains(PREFIX + IFRAMENAME)) {
				let MDtext = ctx.text.split("\n").slice(ctx.lineStart, ctx.lineEnd + 1)
				let mappedMD = await Promise.all(MDtext.map(async (line) => {
					if (line.contains(PREFIX + IMPORTNAME) || textContent.contains(PREFIX + IFRAMENAME)) {
						let words = line.split(" ")
						let strings: { string: string, URI: string, type: string }[] = []
						for (let [index, word] of Array.from(words).slice(1).entries()) {
							let commandname = (words[index].endsWith(PREFIX + IMPORTNAME) ? PREFIX + IMPORTNAME : "") || (words[index].endsWith(PREFIX + IFRAMENAME) ? PREFIX + IFRAMENAME : "")

							if (commandname) {
								strings.push({ string: commandname + " " + word, URI: processURI(word, context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath()), type: commandname })
							}
						}
						for (let promiseString of strings) {
							let div = createEl("div")
							if (promiseString.type == PREFIX + IMPORTNAME) {
								await renderURI(promiseString.URI, div, context, this.settings.allowInet.value, div.attributes, !promiseString.URI.endsWith(".md"))
								line = line.replace(promiseString.string, div.innerHTML.replace("\n", ""))
							} else {
								await renderURI(promiseString.URI, div, context, this.settings.allowInet.value, div.attributes, false)
							}
							line = line.replace(promiseString.string, div.innerHTML.replace("\n", ""))
						}
					}
					return line
				}))
				Array.from(element.children).forEach((i) => {
					element.removeChild(i)
				})
				renderMD(mappedMD.join("\n"), element.createEl("div"), context)
			}
		}

		let markdownPostProcessor = (element: Element, context: MarkdownPostProcessorContext) => {
			processCustomCommands(element, context)
			processIframe(element, context)
		}

		this.registerMarkdownPostProcessor(markdownPostProcessor);

		this.addCommand({id:"clear_cache", name: "Clear Iframe Cache", callback: () => {
			CACHE = {"true": {}, "false":{}}
		}})
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

class ObsidianIframeSettings extends PluginSettingTab {
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