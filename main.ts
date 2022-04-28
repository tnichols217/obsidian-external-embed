import { Vault, Plugin, FileSystemAdapter, MarkdownPostProcessorContext } from 'obsidian';

const PREFIX = "!!"
const URISCHEME = "file://"

export default class MyPlugin extends Plugin {

	async onload() {
		let processList = (element: Element, context: MarkdownPostProcessorContext) => {
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
			}
		}

		this.registerMarkdownPostProcessor((element, context) => { processList(element, context) });
	}

	onunload() {

	}

}