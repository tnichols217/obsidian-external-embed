import { Vault, Plugin, FileSystemAdapter, MarkdownPostProcessorContext, MarkdownRenderer, PluginSettingTab, Setting, App, MarkdownRenderChild, request } from 'obsidian';
import html2md from 'html-to-md'

const URISCHEME = "file://"
const DIVCLASS = "obsidian-external-embed"
const MDDIVCLASS = "obsidian-external-embed-markdown"
const IFRAMECLASS = "obsidian-external-embed-iframe"
const INLINECLASS = "obsidian-external-embed-inline"
const ERRORMD = "# Obsidian-external-embed cannot access the internet"
const ERRORINLINE = "Obsidian-external-embed cannot use the inline command"
const CONVERTMD = "iframe-md"
const IGNOREDTAGS = ["src", "sandbox"]
const PREFIX = "!!!"
const IMPORTNAME = "import"
const IFRAMENAME = "iframe"
const INLINENAME = "inline"
const PASTENAME = "paste"
const EMPTYCACHE = { value: { "true": {}, "false": {} }, time: { "true": {}, "false": {} } }


type CacheItem<T> = Record<string, Record<string, T>>

type ExtraCallback = (element: Element, context: MarkdownPostProcessorContext, MDtext: string, recursionDepth: number) => Promise<void> | void

interface CacheType {
	value: CacheItem<string>
	time: CacheItem<Date>
}

interface SettingItem<T> {
	value: T
	name?: string
	desc?: string
}

interface ExternalEmbedSettings {
	allowInet: SettingItem<boolean>
	allowInline: SettingItem<boolean>
	recursionDepth: SettingItem<number>
	useCacheForFiles: SettingItem<boolean>
	cacheRefreshTime: SettingItem<number>
}

const DEFAULT_SETTINGS: ExternalEmbedSettings = {
	allowInet: { value: false, name: "Access Internet", desc: "Allows this plugin to access the internet to render remote MD files." },
	allowInline: { value: false, name: "Allows access to the inline command", desc: "Enables the !!!inline command, which allows arbitrary HTML code to run (insecure)" },
	recursionDepth: { value: 20, name: "Recusion Depth", desc: "Sets the amount of nested imports that can be called." },
	useCacheForFiles: { value: false, name: "Cache Local Files", desc: "Cache files instead of loading them on every rerender. (Remote Files will always be cached)" },
	cacheRefreshTime: { value: 30000, name: "Cache Refresh Time (miliseconds)", desc: "Cached filed called over this time ago will be refreshed when rendered." }
}



export default class ObsidianExternalEmbed extends Plugin {
	cache: CacheType = EMPTYCACHE
	settings: ExternalEmbedSettings

	parseBoolean = (value: string) => {
		return (value == "yes" || value == "true")
	}
	
	parseObject = (value: any, typ: string) => {
		if (typ == "string") {
			return value
		}
		if (typ == "boolean") {
			return this.parseBoolean(value)
		}
		if (typ == "number") {
			return parseFloat(value)
		}
	}
	
	processURI = (URI: string, source: string, root: string): string => {
		URI = URI.split("<")[0]
		if (!URI.contains("://")) {
			if (URI.startsWith("/")) {
				return [URISCHEME, URI].join("")
			}
			else if (URI.startsWith("./")) {
				return [URISCHEME, "/", source.substring(0, source.lastIndexOf("/")), URI.substring(2)].join("")
			}
			else {
				return [URISCHEME, "/", source.substring(0, source.lastIndexOf("/")), URI].join("")
			}
		}
		return URI
	}
	
	processFullURI = async (URI: string, FSAdapter: FileSystemAdapter): Promise<string> => {
		let url = new URL(URI)
		if (await FSAdapter.exists(url.pathname)) {
			url.pathname = FSAdapter.getBasePath() + url.pathname
		}
		return url.toString()
	}
	
	getURI = (URI: string, FSAdapter: FileSystemAdapter, convert?: boolean): Promise<string> => {
		return new Promise<string>((resolve, reject) => {
			let c = convert.toString()
			let url = new URL(URI)
			if (url.protocol == "file:") {
				if (this.settings.useCacheForFiles.value && this.cache.value[c].hasOwnProperty(URI) && (new Date().getTime() - this.cache.time[c][URI].getTime() < this.settings.cacheRefreshTime.value)) {
					resolve(this.cache.value[c][URI])
					return
				}
				FSAdapter.read(url.pathname).then((d) => {
					let dString = d.toString()
					if (convert) {
						dString = html2md(dString)
					}
					if (this.settings.useCacheForFiles.value) {
						this.cache.value[c][URI] = dString
						this.cache.time[c][URI] = new Date()
					}
					resolve(dString)
				}).catch(console.error)
			} else {
				if (this.cache.value[c].hasOwnProperty(URI) && (new Date().getTime() - this.cache.time[c][URI].getTime() < this.settings.cacheRefreshTime.value)) {
					resolve(this.cache.value[c][URI])
					return
				}
				if (this.settings.allowInet.value) {
					request({ url: url.href }).then((a) => {
						if (convert) {
							a = html2md(a)
						}
						this.cache.value[c][URI] = a
						this.cache.time[c][URI] = new Date()
						resolve(a)
					}).catch(console.error)
				} else {
					resolve(ERRORMD)
				}
			}
		})
	}

	renderMD = (source: string, div: HTMLElement, context: MarkdownPostProcessorContext, recursiveDepth: number, additionalCallback?: ExtraCallback): Promise<void> => {
	
		const sourcePath = context.sourcePath;
		let renderDiv = new MarkdownRenderChild(div)
		context.addChild(renderDiv)
		if (recursiveDepth > this.settings.recursionDepth.value) {
			div.createEl("p", source)
			return Promise.resolve()
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
	
	renderURI = async (src: string, element: Element, context: MarkdownPostProcessorContext, recursiveDepth: number, FSAdapter: FileSystemAdapter, attributes?: NamedNodeMap, convertHTML?: boolean, inline?: boolean, additionalCallback?: ExtraCallback): Promise<HTMLDivElement | HTMLSpanElement | HTMLIFrameElement> => {
		let setIframe = (iframe: HTMLIFrameElement) => {
			iframe.addClass(IFRAMECLASS, DIVCLASS)
			iframe.scroll = () => {
				iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
			}
		}
		let setMD = (div: HTMLDivElement) => {
			div.addClass(MDDIVCLASS, DIVCLASS)
		}
		let setInline = (span: HTMLSpanElement) => {
			span.addClass(INLINECLASS, DIVCLASS)
		}
		return new Promise<HTMLDivElement | HTMLSpanElement | HTMLIFrameElement>(async (resolve, reject) => {
			let endsMD = src.toLocaleLowerCase().endsWith(".md")
			Array.from(element.children).forEach((i) => {
				element.removeChild(i)
			})
			if (inline) {
				this.getURI(src, FSAdapter, false).then((source) => {
					let span = element.createEl("span")
					if (this.settings.allowInline.value) {
						span.innerHTML = source
					} else {
						span.innerHTML = ERRORINLINE
					}
					setInline(span)
					resolve(span)
				})
			} else if (endsMD || convertHTML) {
				let fileContentCallback = async (source: string) => {
					let div = element.createEl("div")
					Array.from(attributes).forEach((i) => {
						if (!IGNOREDTAGS.contains(i.nodeName)) {
							div.setAttribute(i.nodeName, i.nodeValue)
						}
					})
					setMD(div)
					await this.renderMD(source, div, context, recursiveDepth, additionalCallback)
					resolve(div)
				}
				this.getURI(src, FSAdapter, convertHTML && !endsMD).then(fileContentCallback).catch(reject)
			} else {
				let iframe = element.createEl("iframe")
				Array.from(attributes).forEach((i) => {
					if (!IGNOREDTAGS.contains(i.nodeName)) {
						iframe.setAttribute(i.nodeName, i.nodeValue)
					}
				})
				iframe.src = await this.processFullURI(src, FSAdapter)
				setIframe(iframe)
				resolve(iframe)
			}
		})
	}

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new ObsidianExternalEmbedSettings(this.app, this));

		let processIframe = (element: Element, context: MarkdownPostProcessorContext, recursionDepth: number = 0) => {
			let iframes = element.querySelectorAll("iframe")
			for (let child of Array.from(iframes)) {
				let attr = child.getAttribute("src")
				if (attr != null) {
					let src = this.processURI(attr, context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath())

					let classAttrib = child.getAttribute("class")
					let convertHTML = classAttrib ? classAttrib.split(" ").contains(CONVERTMD) : false
	
					this.renderURI(src, element, context, recursionDepth + 1, (this.app.vault.adapter as FileSystemAdapter), child.attributes, convertHTML, false, markdownPostProcessor).then((iframe: HTMLIFrameElement) => {
						let src = new URL(iframe.src)
						iframe.src = "app://local" + src.pathname
					})
				}
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
			if (textContent.contains(PREFIX + IMPORTNAME) || textContent.contains(PREFIX + IFRAMENAME) || textContent.contains(PREFIX + INLINENAME) || textContent.contains(PREFIX + PASTENAME)) {
				let inlines: { string: string, URI: string }[] = []
				let mappedMD = MDtext.map(async (line) => {
					if (line.contains(PREFIX + IMPORTNAME) || line.contains(PREFIX + IFRAMENAME) || line.contains(PREFIX + INLINENAME) || line.contains(PREFIX + PASTENAME)) {
						let words = line.split(" ")
						{
							let contains
							for (let i = recursionDepth; i < this.settings.recursionDepth.value; i++) {
								words = words.map(i => i.trim())
								contains = false
								for (let index = words.length - 1; index >= 1; index--) {
									let prevWord = words[index - 1]
									if (prevWord.endsWith(PREFIX + PASTENAME)) {
										contains = true
										let beforeTag = words[index - 1].replace(PREFIX + PASTENAME, "")

										let replaceString = (await this.getURI(this.processURI(words[index], context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath()), (this.app.vault.adapter as FileSystemAdapter), false)).split(" ")


										let last = index + 1 < words.length
										if (beforeTag.endsWith(PREFIX[0]) && last) {
											beforeTag = beforeTag.slice(0, beforeTag.length - 2)
											replaceString[replaceString.length - 1] = replaceString[replaceString.length - 1] + words[index + 1]
										} else {
											replaceString.push(words[index + 1])
										}
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
							let commandname = (words[index].endsWith(PREFIX + IMPORTNAME) ? PREFIX + IMPORTNAME : "") || (words[index].endsWith(PREFIX + IFRAMENAME) ? PREFIX + IFRAMENAME : "") || (words[index].endsWith(PREFIX + INLINENAME) ? PREFIX + INLINENAME : "")
							if (commandname) {
								strings.push({ string: commandname + " " + word, URI: this.processURI(word, context.sourcePath, (this.app.vault.adapter as FileSystemAdapter).getBasePath()), type: commandname })
							}
						}
						for (let promiseString of strings) {
							if (promiseString.type == PREFIX + INLINENAME) {
								let inlineTempDiv = createEl("div")
								if (line.contains(promiseString.string[0] + promiseString.string)) {
									line = line.replace(promiseString.string[0] + promiseString.string + " ", promiseString.string)
								}
								await this.renderURI(promiseString.URI, inlineTempDiv, context, recursionDepth + 1, (this.app.vault.adapter as FileSystemAdapter), inlineTempDiv.attributes, false, true, markdownPostProcessor)
								let replaceString = inlineTempDiv.innerHTML.replace("\n", "")
								inlines.push({string: replaceString, URI: promiseString.string})
								
							} else {
								let replaceString = ""
								let div = createEl("div")
								if (promiseString.type == PREFIX + IMPORTNAME) {
									await this.renderURI(promiseString.URI, div, context, recursionDepth + 1, (this.app.vault.adapter as FileSystemAdapter), div.attributes, !promiseString.URI.toLocaleLowerCase().endsWith(".md"), false, markdownPostProcessor)
								} else if (promiseString.type == PREFIX + IFRAMENAME) {
									await this.renderURI(promiseString.URI, div, context, recursionDepth + 1, (this.app.vault.adapter as FileSystemAdapter), div.attributes, false, false, markdownPostProcessor)
								}
								replaceString = div.innerHTML.replace("\n", "")
								line = line.replace(promiseString.string, replaceString)
							}
						}
					}
					return line
				})
				Promise.all(mappedMD).then((mappedMDResolved) => {
					Array.from(element.children).forEach((i) => {
						element.removeChild(i)
					})
					let newDiv = element.createEl("div")
					this.renderMD(mappedMDResolved.join("\n"), newDiv, context, recursionDepth + 1, markdownPostProcessor)
					for (let inline of inlines) {
						for (let el of Array.from(newDiv.querySelectorAll("*"))) {
							if ("innerText" in el && (el as HTMLElement).innerText.contains(inline.URI)) {
								el.innerHTML = el.innerHTML.replace(inline.URI, inline.string)
							}
						}
						for (let el of Array.from(newDiv.querySelectorAll("*"))) {
							if ("onload" in el && (el as HTMLElement).onload != null) {
								(el as HTMLElement).onload(new Event("Loading Subelements"))
							}
						}
					}
				})
			}
		}

		let markdownPostProcessor = (element: Element, context: MarkdownPostProcessorContext, MDtext?: string, recursion: number = 0) => {
			processCustomCommands(element, context, MDtext, recursion);
			// processIframe(element, context, recursion)

		}

		this.registerMarkdownPostProcessor(markdownPostProcessor);

		this.addCommand({
			id: "clear_cache", name: "Clear Iframe Cache", callback: () => {
				this.cache = EMPTYCACHE
			}
		})
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = DEFAULT_SETTINGS
		this.loadData().then((data) => {
			let items = Object.entries(data)
			items.forEach((item:[string, string]) => {
				(this.settings as any)[item[0]].value = item[1]
			})
		})
	}

	async saveSettings() {
		let saveData:any = {}
		Object.entries(this.settings).forEach((i) => {
			saveData[i[0]] = (i[1] as SettingItem<any>).value
		})
		await this.saveData(saveData);
	}
}

class ObsidianExternalEmbedSettings extends PluginSettingTab {
	plugin: ObsidianExternalEmbed;

	constructor(app: App, plugin: ObsidianExternalEmbed) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for Obsidian External Embed' });

		let keyvals = Object.entries(DEFAULT_SETTINGS)

		for (let keyval of keyvals) {
			let setting = new Setting(containerEl)
				.setName(keyval[1].name)
				.setDesc(keyval[1].desc)

			if (typeof keyval[1].value == "boolean") {
				setting.addToggle(toggle => toggle
					.setValue((this.plugin.settings as any)[keyval[0]].value)
					.onChange((bool) => {
						(this.plugin.settings as any)[keyval[0]].value = bool
						this.plugin.saveSettings()
					})
				)
			} else {
				setting.addText(text => text
					.setPlaceholder(String(keyval[1].value))
					.setValue(String((this.plugin.settings as any)[keyval[0]].value))
					.onChange((value) => {
						(this.plugin.settings as any)[keyval[0]].value = this.plugin.parseObject(value, typeof keyval[1].value)
						this.plugin.saveSettings()
					})
				)
			}
		}
	}
}