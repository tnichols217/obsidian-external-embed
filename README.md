# Obsidian Dynamic Import
This plugin allows you to use the iframe tag in your obsidian notes to refer to local files.\
Works by replacing the src attribute of the iframe tag with a global path using the file:// URI scheme.\
Also adds three custom syntaxes to import other files into the current file: iframe, import, and paste.\
For the iframe tag, to specify to attempt to convert the html to MD, use a class tag with the class of `iframe-md`

## Custom commands
### paste
Execute by typing `!!!paste` followed by a path to a file or URL.\
Will simply replace the command with the raw file contents before getting rerendered as MD\
Executes first out of all three commands. Put a fourth exclamation mark in the beginning to remove the whitespace after the paste command. If you want to have no whitespace before the paste, simply delete it.

### inline
Execute by typing `!!!inline` followed by a path to a file or URL. Will insert the html file into where the command was called from inline\
Similar to paste, it also has the additional `!` for removing the space afterwards

## Custom commandblocks
### inline
Just executes the arbitrary html code inside the inline block. Also runs the onload function (if enabled in settings) (insecure)

### import
Imports external HTML and loads it. Also runs the onload function on each element. (if enabled in settings)

### iframe
Iframes the file inside the commandblock. If the file ends with md, it converts it renders the external MD in the current file.\
To force the page to be converted to MD, add true after the link.

## MD files
This plugin also allows you to "iframe" an MD file, which will include its code in the document (can be another document or an online source). You can also name the iframe with a "iframe-md" class to attempt to convert html to md

## Filesystem Access
- Starting a src with "/" will start from the root of your vault
- Starting without a slash will use relative directories from the current MD file
- Files outside your vault cannot be accessed due to a limitation in the obsidian dataAdapter API

## Examples
### Inline command
![image](https://user-images.githubusercontent.com/62992267/168474961-a7e9752c-ae33-40c9-910b-215f6d3d6f97.png)

Source:
```md
# This is file example.md
Here I am inlining the code from clock.md into this file: !!!inline clock.md
### You can even put it in the middle **(!!!!inline clock.md )** of a heading
```
```html
<span onload='
	let getTime = () => {
		let date = new Date(); 
		let hh = date.getHours();
		let mm = date.getMinutes();
		let ss = date.getSeconds();
		
		hh = (hh < 10) ? "0" + hh : hh;
		mm = (mm < 10) ? "0" + mm : mm;
		ss = (ss < 10) ? "0" + ss : ss;
		
		return hh + ":" + mm + ":" + ss;
	};
	let updateTime = async () => {
		let time = getTime();
		this.innerText=time;
		setTimeout(updateTime, 100);
	};
	updateTime()'></span>
```

### Paste Command
![image](https://user-images.githubusercontent.com/62992267/168475443-3e6a51d3-9111-4d31-98d5-b9d217aa3662.png)

Source:
````md
# This is file example.md
Here I paste the contents of fileToLoad.md: **!!!paste fileToLoad.md **

You can chain the paste command into the inline command: !!!inline !!!paste fileToLoad2.md

You can chain the paste command into the other commandblocks: 
```iframe
!!!!paste fileToLoad.md .md
```
````
````md
## This is example1.md
- more random things to see

```iframe
https://linux.die.net/man/1/curl true
```
````

### Inline commandblock
![image](https://user-images.githubusercontent.com/62992267/168475601-7af78cce-bc4f-4deb-8969-72c5f56cd4b6.png)

Source:
````md
# This is file example.md
```inline
<h2 onload='
	this.innerText += ", Supports the onload function as well"
'>Hello</h2>
```
````

### Import commandblock
![image](https://user-images.githubusercontent.com/62992267/168475687-358607f9-c676-4e15-96be-4bb69a0150f3.png)

Source:
````md
# This is file example.md
```import
clock.md
```
````

### Iframe commandblock
![image](https://user-images.githubusercontent.com/62992267/168475778-72cbc549-4107-42d6-a34c-ac095e4ceb1c.png)

Source:
````md
# This is file example.md
```iframe
https://linux.die.net/man/1/curl true
```
````

## Settings
### Allow Internet
Allows the plugin to include MD files from the internet.

### Allow inline
Allows access to the inline command\
Insecure because it allows arbitrary HTML (and js) code to run

### Recursion Depth
Blocks recursive imports past this depth. 

### Cache Local Files
Cache local files instead of rereading upon every update\
Remote files are always cached

### Cache refresh time (milliseconds)
How old a cache item has to be before it is reloaded

If you enjoy my plugin, please consider supporting me:

<a href="https://www.buymeacoffee.com/tnichols217" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60" /></a>
