import { Vault, Plugin, FileSystemAdapter, MarkdownPostProcessorContext, MarkdownRenderer, PluginSettingTab, Setting, App, MarkdownRenderChild, request } from 'obsidian';
import { readFile, stat } from "fs"
import html2md from 'html-to-md'

const URISCHEME = "file://"
const MDDIVCLASS = "obsidian-iframe-md"
const ERRORMD = "# Obsidian-iframes cannot access the internet"
const CONVERTMD = "iframe-md"
const IGNOREDTAGS = [CONVERTMD, "src", "sandbox"]
const PREFIX = "!!!"
const IMPORTNAME = "import"
const IFRAMENAME = "iframe"
const PASTENAME = "paste"
const EMPTYCACHE = { value: { "true": {}, "false": {} }, time: { "true": {}, "false": {} } }

let CACHE: cacheType = EMPTYCACHE
let SETTINGS: dynamicImportSettings

type cacheItem<T> = Record<string, Record<string, T>>

type extraCallback = (element: Element, context: MarkdownPostProcessorContext, MDtext: string, recursionDepth: number) => Promise<void> | void

interface cacheType {
	value: cacheItem<string>
	time: cacheItem<Date>
}

interface settingItem<T> {
	value: T
	name?: string
	desc?: string
}

interface dynamicImportSettings {
	allowInet: settingItem<boolean>
	recursionDepth: settingItem<number>
	useCacheForFiles: settingItem<boolean>
	cacheRefreshTime: settingItem<number>
}

const DEFAULT_SETTINGS: dynamicImportSettings = {
	allowInet: { value: false, name: "Access Internet", desc: "Allows this plugin to access the internet to render remote MD files." },
	recursionDepth: { value: 20, name: "Recusion Depth", desc: "Sets the amount of nested imports that can be called." },
	useCacheForFiles: { value: false, name: "Cache Local Files", desc: "Cache files instead of loading them on every rerender. (Remote Files will always be cached)" },
	cacheRefreshTime: { value: 30000, name: "Cache Refresh Time (miliseconds)", desc: "Cached filed called over this time ago will be refreshed when rendered." }
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
	URI = URI.split("<")[0]
	if (!URI.contains("://")) {
		if (URI.startsWith("/")) {
			return [URISCHEME, root, URI].join("")
		}
		else if (URI.startsWith("./")) {
			return [URISCHEME, root, "/", source.substring(0, source.lastIndexOf("/")), URI.substring(2)].join("")
		}
		else {
			return [URISCHEME, root, "/", source.substring(0, source.lastIndexOf("/")), URI].join("")
		}
	}
	return URI
}

let getURI = (URI: string, convert?: boolean): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		let c = convert.toString()
		let url = new URL(URI)
		if (url.protocol == "file:") {
			if (SETTINGS.useCacheForFiles.value && CACHE.value[c].hasOwnProperty(URI) && (new Date().getTime() - CACHE.time[c][URI].getTime() < SETTINGS.cacheRefreshTime.value)) {
				resolve(CACHE.value[c][URI])
				return
			}
			readFile(url.pathname, (e, d) => {
				if (e) {
					if (e.code == "ENOENT" || e.code == "ENOTDIR") {
						resolve("")
						return
					} else {
						reject(e)
						reject(e.code)
						return
					}
				}
				let dString = d.toString()
				if (convert) {
					dString = html2md(dString)
				}
				if (SETTINGS.useCacheForFiles.value) {
					CACHE.value[c][URI] = dString
					CACHE.time[c][URI] = new Date()
				}
				resolve(dString)
			})
		} else {
			if (CACHE.value[c].hasOwnProperty(URI) && (new Date().getTime() - CACHE.time[c][URI].getTime() < SETTINGS.cacheRefreshTime.value)) {
				resolve(CACHE.value[c][URI])
				return
			}
			if (SETTINGS.allowInet.value) {
				request({ url: url.href }).then((a) => {
					if (convert) {
						a = html2md(a)
					}
					CACHE.value[c][URI] = a
					CACHE.time[c][URI] = new Date()
					resolve(a)
				}).catch(console.error)
			} else {
				resolve(ERRORMD)
			}
		}
	})
}

let renderMD = (source: string, div: HTMLElement, context: MarkdownPostProcessorContext, recursiveDepth: number, additionalCallback?: extraCallback): Promise<void> => {

	const sourcePath = context.sourcePath;
	let renderDiv = new MarkdownRenderChild(div)
	context.addChild(renderDiv)
	if (recursiveDepth > SETTINGS.recursionDepth.value) {
		div.createEl("p", source)
		return new Promise((resolve, reject) => { resolve })
	}
	return MarkdownRenderer.renderMarkdown(
		source,
		div,
		sourcePath,
		renderDiv
	).then(() => {
		if (additionalCallback) {
			additionalCallback(div, context, source, recursiveDepth + 1)
		}
	})
}

let renderURI = async (src: string, element: Element, context: MarkdownPostProcessorContext, recursiveDepth: number, attributes?: NamedNodeMap, convertHTML?: boolean, additionalCallback?: extraCallback): Promise<void> => {
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
				await renderMD(source, div, context, recursiveDepth, additionalCallback)
				resolve()
			}

			getURI(src, convertHTML && !endsMD).then(fileContentCallback).catch(console.error)
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

export default class ObsidianDynamicImport extends Plugin {

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new ObsidianDynamicImportSettings(this.app, this));

		let processIframe = (element: Element, context: MarkdownPostProcessorContext, recursionDepth: number = 0) => {
			let iframes = element.querySelectorAll("iframe")
			for (let child of Array.from(iframes)) {
				let src = processURI(child.getAttribute("src"), context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath())

				child.setAttribute("src", src)

				let classAttrib = child.getAttribute("class")
				let convertHTML = classAttrib ? classAttrib.split(" ").contains(CONVERTMD) : false

				renderURI(src, element, context, recursionDepth + 1, child.attributes, convertHTML, markdownPostProcessor)
			}
		}

		let processCustomCommands = async (element: Element, context: MarkdownPostProcessorContext, MDtextString?: string, recursionDepth: number = 0) => {
			let textContent = element.textContent
			let MDtext
			if (MDtextString == null) {
				let ctx = context.getSectionInfo(element as HTMLElement)
				if (ctx == null) {
					return
				}
				MDtext = ctx.text.split("\n").slice(ctx.lineStart, ctx.lineEnd + 1)
			} else {
				MDtext = MDtextString.split("\n")
			}
			if (textContent.contains(PREFIX + IMPORTNAME) || textContent.contains(PREFIX + IFRAMENAME) || textContent.contains(PREFIX + PASTENAME)) {
				let mappedMD = MDtext.map(async (line) => {
					if (line.contains(PREFIX + IMPORTNAME) || line.contains(PREFIX + IFRAMENAME) || line.contains(PREFIX + PASTENAME)) {
						let words = line.split(" ")
						{
							let contains
							for (let i = recursionDepth; i < SETTINGS.recursionDepth.value; i++) {
								words = words.map(i => i.trim())
								contains = false
								for (let index = words.length - 1; index >= 1; index--) {
									let prevWord = words[index - 1]
									if (prevWord.endsWith(PREFIX + PASTENAME)) {
										contains = true
										let beforeTag = words[index - 1].replace(PREFIX + PASTENAME, "")

										let replaceString = (await getURI(processURI(words[index], context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath()), false)).split(" ")


										let last = index + 1 < words.length
										if (beforeTag.endsWith(PREFIX[0]) && last) {
											beforeTag = beforeTag.slice(0, beforeTag.length - 2)
											replaceString[replaceString.length - 1] = replaceString[replaceString.length - 1] + words[index + 1]
										} else {
											replaceString.push(words[index + 1])
										}
										console.log()
										words.splice(index - 1, 3, ...replaceString)
										words[index - 1] = beforeTag + words[index - 1]

									}
								}
								line = words.join(" ")
								words = line.split(" ")
								if (!contains) {
									continue
								}
							}
						}


						words[words.length - 1] = words[words.length - 1].replace(PREFIX + IMPORTNAME, "").replace(PREFIX + IFRAMENAME, "").replace(PREFIX + PASTENAME, "")
						line = words.join(" ")




						let strings: { string: string, URI: string, type: string }[] = []
						for (let [index, word] of Array.from(words).slice(1).entries()) {
							word = word.trim()
							let commandname = (words[index].endsWith(PREFIX + IMPORTNAME) ? PREFIX + IMPORTNAME : "") || (words[index].endsWith(PREFIX + IFRAMENAME) ? PREFIX + IFRAMENAME : "")
							if (commandname) {
								strings.push({ string: commandname + " " + word, URI: processURI(word, context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath()), type: commandname })
							}
						}
						for (let promiseString of strings) {
							let replaceString = ""
							if (promiseString.type == PREFIX + IMPORTNAME) {
								let div = createEl("div")
								await renderURI(promiseString.URI, div, context, recursionDepth + 1, div.attributes, !promiseString.URI.endsWith(".md"), markdownPostProcessor)
								replaceString = div.innerHTML.replace("\n", "")
							} else if (promiseString.type == PREFIX + IFRAMENAME) {
								let div = createEl("div")
								await renderURI(promiseString.URI, div, context, recursionDepth + 1, div.attributes, false, markdownPostProcessor)
								replaceString = div.innerHTML.replace("\n", "")
							}
							line = line.replace(promiseString.string, replaceString)
						}
					}
					return line
				})
				Promise.all(mappedMD).then((mappedMDResolved) => {
					Array.from(element.children).forEach((i) => {
						element.removeChild(i)
					})
					renderMD(mappedMDResolved.join("\n"), element.createEl("div"), context, recursionDepth + 1, markdownPostProcessor)
				})
			}
		}

		let markdownPostProcessor = (element: Element, context: MarkdownPostProcessorContext, MDtext?: string, recursion: number = 0) => {
			processCustomCommands(element, context, MDtext, recursion);
			processIframe(element, context, recursion)
		}

		this.registerMarkdownPostProcessor(markdownPostProcessor);

		this.addCommand({
			id: "clear_cache", name: "Clear Iframe Cache", callback: () => {
				CACHE = EMPTYCACHE
			}
		})
	}

	onunload() {

	}

	async loadSettings() {
		SETTINGS = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(SETTINGS);
	}
}

class ObsidianDynamicImportSettings extends PluginSettingTab {
	plugin: ObsidianDynamicImport;

	constructor(app: App, plugin: ObsidianDynamicImport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for Obsidian Dynamic Import' });

		let keyvals = Object.entries(DEFAULT_SETTINGS)

		for (let keyval of keyvals) {
			new Setting(containerEl)
				.setName(keyval[1].name)
				.setDesc(keyval[1].desc)
				.addText(text => text
					.setPlaceholder(String(keyval[1].value))
					.setValue(String((SETTINGS as any)[keyval[0]].value))
					.onChange((value) => {
						keyval[1].value = parseObject(value, typeof keyval[1].value);
						this.plugin.saveSettings();
					}));
		}
	}
}